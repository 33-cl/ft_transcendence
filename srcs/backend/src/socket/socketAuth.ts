// Socket authentication utilities
import db from '../db.js';
import { Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';

interface SocketUser {
  id: number;
  username: string;
  email: string;
}

// Map to store authenticated socket users
const socketUsers = new Map<string, SocketUser>();

// Parse cookies from socket handshake
function parseCookiesFromSocket(socket: Socket): Record<string, string> {
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

// Authenticate socket connection using session cookie
export function authenticateSocket(socket: Socket, fastify?: FastifyInstance): SocketUser | null {
  try {
    const cookies = parseCookiesFromSocket(socket);
    const sessionToken = cookies['sid'];
    
    if (fastify) fastify.log.info(`[DEBUG] Socket ${socket.id} cookies: ${Object.keys(cookies).join(', ')}`);
    if (fastify) fastify.log.info(`[DEBUG] Socket ${socket.id} session token: ${sessionToken ? sessionToken.substring(0, 10) + '...' : 'none'}`);
    
    if (!sessionToken) {
      if (fastify) fastify.log.warn(`[DEBUG] Socket ${socket.id} has no session token`);
      return null;
    }
    
    // Query database to get user from session
    const sessionQuery = db.prepare(`
      SELECT u.id, u.username, u.email 
      FROM sessions s 
      JOIN users u ON u.id = s.user_id 
      WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
    `);
    
    const user = sessionQuery.get(sessionToken) as SocketUser | undefined;
    
    if (fastify) fastify.log.info(`[DEBUG] Socket ${socket.id} found user in DB: ${user ? `${user.username} (${user.id})` : 'null'}`);
    
    if (user) {
      // Store user info for this socket
      socketUsers.set(socket.id, user);
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
export function getSocketUser(socketId: string): SocketUser | null {
  return socketUsers.get(socketId) || null;
}

// Remove user info when socket disconnects
export function removeSocketUser(socketId: string): void {
  socketUsers.delete(socketId);
}

// Check if socket is authenticated
export function isSocketAuthenticated(socketId: string): boolean {
  return socketUsers.has(socketId);
}
