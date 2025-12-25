import db from '../db.js';
import { Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

interface SocketUser
{
  id: number;
  username: string;
  email: string;
}

const recentDisconnections = new Map<number, number>();
const RECONNECTION_GRACE_PERIOD = 5000;

function cleanupRecentDisconnections()
{
  const now = Date.now();
  for (const [userId, timestamp] of recentDisconnections.entries())
  {
    if (now - timestamp > RECONNECTION_GRACE_PERIOD)
      recentDisconnections.delete(userId);
  }
}

const socketUsers = new Map<string, SocketUser>();
const activeUsers = new Map<number, string>();

function parseCookiesFromSocket(socket: Socket): Record<string, string>
{
  const cookies: Record<string, string> = {};
  const cookieHeader = socket.handshake.headers.cookie;
  
  if (!cookieHeader)
    return cookies;
  
  cookieHeader.split(';').forEach(cookie =>
  {
    const [key, ...values] = cookie.trim().split('=');
    if (key && values.length > 0)
      cookies[key] = decodeURIComponent(values.join('='));
  });
  
  return cookies;
}

export function authenticateSocket(socket: Socket, fastify?: FastifyInstance): SocketUser | null | 'USER_ALREADY_CONNECTED'
{
  try
  {
    const cookies = parseCookiesFromSocket(socket);
    const jwtToken = cookies['jwt'];

    let user: SocketUser | undefined;
    
    if (jwtToken)
    {
      try
      {
        if (!process.env.JWT_SECRET)
          throw new Error('JWT_SECRET environment variable is not set');
        const JWT_SECRET = process.env.JWT_SECRET;
        const payload = jwt.verify(jwtToken, JWT_SECRET);
        
        if (payload && typeof payload === 'object' && 'userId' in payload)
        {
          const userId = (payload as any).userId;
          
          const activeToken = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(userId, jwtToken);
          
          if (activeToken)
          {
            const userRow = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId) as { id: number, username: string, email: string } | undefined;
            if (userRow)
            {
              user = {
                id: userRow.id,
                username: userRow.username,
                email: userRow.email
              };
            }
          }
        }
      }
      catch (err)
      {
      }
    }


    if (user)
    {
      const existingSocketId = activeUsers.get(user.id);
      
      if (existingSocketId && existingSocketId !== socket.id)
      {
        cleanupRecentDisconnections();
        const recentDisconnectTime = recentDisconnections.get(user.id);
        const now = Date.now();
        
        if (recentDisconnectTime && (now - recentDisconnectTime) < RECONNECTION_GRACE_PERIOD)
        {
          socketUsers.delete(existingSocketId);
          activeUsers.delete(user.id);
          recentDisconnections.delete(user.id);
        }
        else
        {
          return 'USER_ALREADY_CONNECTED';
        }
      }
      
      socketUsers.set(socket.id, user);
      activeUsers.set(user.id, socket.id);
      return user;
    }
    
    return null;
  }
  catch (error)
  {
    return null;
  }
}

export function getSocketUser(socketId: string): SocketUser | null
{
  return socketUsers.get(socketId) || null;
}

export function removeSocketUser(socketId: string): void
{
  const user = socketUsers.get(socketId);
  if (user)
  {
    recentDisconnections.set(user.id, Date.now());
    activeUsers.delete(user.id);
    socketUsers.delete(socketId);
  }
}

export function isSocketAuthenticated(socketId: string): boolean
{
  return socketUsers.has(socketId);
}

export function isUserAlreadyConnected(userId: number): boolean
{
  return activeUsers.has(userId);
}

export function getSocketIdForUser(userId: number): string | undefined
{
  return activeUsers.get(userId);
}

export function removeUserFromActiveList(userId: number): void
{
  const socketId = activeUsers.get(userId);
  if (socketId)
  {
    socketUsers.delete(socketId);
    activeUsers.delete(userId);
    recentDisconnections.delete(userId);
  }
}
