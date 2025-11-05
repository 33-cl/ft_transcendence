// Socket authentication utilities
import db from '../db.js';
import { Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

interface SocketUser {
  id: number;
  username: string;
  email: string;
}

// Map to track recent disconnections (userId -> timestamp)
const recentDisconnections = new Map<number, number>();
const RECONNECTION_GRACE_PERIOD = 3000; // 3 seconds - increased from 2 seconds

// Clean up old disconnection timestamps
function cleanupRecentDisconnections() {
  const now = Date.now();
  for (const [userId, timestamp] of recentDisconnections.entries()) {
    if (now - timestamp > RECONNECTION_GRACE_PERIOD) {
      recentDisconnections.delete(userId);
    }
  }
}

// Map to store authenticated socket users
const socketUsers = new Map<string, SocketUser>();

// Map to track active users (userId -> socketId)
const activeUsers = new Map<number, string>();

// Parse cookies from socket handshake
function parseCookiesFromSocket(socket: Socket): Record<string, string>
{
  const cookies: Record<string, string> = {};
  const cookieHeader = socket.handshake.headers.cookie;
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [key, ...values] = cookie.trim().split('=');
    if (key && values.length > 0) {
      cookies[key] = decodeURIComponent(values.join('='));
    }
  });
  
  return cookies;
}

// Authenticate socket connection using JWT
export function authenticateSocket(socket: Socket, fastify?: FastifyInstance): SocketUser | null | 'USER_ALREADY_CONNECTED' {
  try {
    const cookies = parseCookiesFromSocket(socket);
    const jwtToken = cookies['jwt'];

    let user: SocketUser | undefined;
    
    if (jwtToken) {
      // JWT authentication
      try {
        if (!process.env.JWT_SECRET)
          throw new Error('JWT_SECRET environment variable is not set');
        const JWT_SECRET = process.env.JWT_SECRET;
        const payload = jwt.verify(jwtToken, JWT_SECRET);
        
        if (payload && typeof payload === 'object' && 'userId' in payload)
        {
          const userId = (payload as any).userId;
          
          // Vérifier que le token est actif dans active_tokens
          const activeToken = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(userId, jwtToken);
          
          if (activeToken)
          {
            const userRow = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId) as { id: number, username: string, email: string } | undefined;
            if (userRow) {
              user = {
                id: userRow.id,
                username: userRow.username,
                email: userRow.email
              };
            }
          }
        }
      } catch (err) {
        if (fastify) fastify.log.warn(`[DEBUG] Socket ${socket.id} JWT invalid: ${err}`);
      }
    }


    if (user) {
      // Vérifier si cet utilisateur est déjà connecté ailleurs
      const existingSocketId = activeUsers.get(user.id);
      
      if (existingSocketId && existingSocketId !== socket.id) {
        // Check if this is a reconnection shortly after a disconnect
        cleanupRecentDisconnections();
        const recentDisconnectTime = recentDisconnections.get(user.id);
        const now = Date.now();
        
        if (recentDisconnectTime && (now - recentDisconnectTime) < RECONNECTION_GRACE_PERIOD) {
          // Clean up the old socket reference and allow this new connection
          socketUsers.delete(existingSocketId);
          activeUsers.delete(user.id);
          recentDisconnections.delete(user.id);
        } else {
          if (fastify) fastify.log.warn(`User ${user.username} (${user.id}) is already connected on socket ${existingSocketId}. Refusing new connection on socket ${socket.id}`);
          return 'USER_ALREADY_CONNECTED';
        }
      }
      
      // Store user info for this socket
      socketUsers.set(socket.id, user);
      activeUsers.set(user.id, socket.id);
      if (fastify) fastify.log.info(`Socket ${socket.id} authenticated as user ${user.username} (${user.id})`);
      return user;
    }
    
    return null;
  } catch (error) {
    if (fastify) fastify.log.error(`Socket authentication error for ${socket.id}: ${error}`);
    return null;
  }
}

// Get authenticated user for a socket
export function getSocketUser(socketId: string): SocketUser | null
{
  return socketUsers.get(socketId) || null;
}

// Remove user info when socket disconnects
export function removeSocketUser(socketId: string): void {
  const user = socketUsers.get(socketId);
  if (user) {
    // Add to recent disconnections for grace period
    recentDisconnections.set(user.id, Date.now());
    
    // Remove from both maps
    activeUsers.delete(user.id);
    socketUsers.delete(socketId);
  }
}

// Check if socket is authenticated
export function isSocketAuthenticated(socketId: string): boolean {
  return socketUsers.has(socketId);
}

// Check if a user is already connected
export function isUserAlreadyConnected(userId: number): boolean {
  return activeUsers.has(userId);
}

// Get socket ID for a connected user
export function getSocketIdForUser(userId: number): string | undefined {
  return activeUsers.get(userId);
}

// Remove user info by user ID (used for logout cleanup)
export function removeUserFromActiveList(userId: number): void {
  const socketId = activeUsers.get(userId);
  if (socketId) {
    // Remove from both maps
    socketUsers.delete(socketId);
    activeUsers.delete(userId);
    
    // Also clear any recent disconnection record since this is an explicit logout
    recentDisconnections.delete(userId);
  }
}
