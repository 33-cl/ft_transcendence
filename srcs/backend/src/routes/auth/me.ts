import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';

// GET /auth/me
// Returns current user info from JWT token
export async function meRoute(request: FastifyRequest, reply: FastifyReply, jwtSecret: string)
{
  const jwtToken = getJwtFromRequest(request);
  if (!jwtToken)
    return reply.code(401).send({ error: 'No JWT.' });

  try {
    const decodedToken = jwt.verify(jwtToken, jwtSecret) as { userId: number; username: string; email: string };
    
    // Check if token is still active
    const activeT = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(decodedToken.userId, jwtToken);
    if (!activeT)
      return reply.code(401).send({ error: 'Session expired or logged out.' });
    
    // Get user from database
    const user = db.prepare(
      'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider, two_factor_enabled FROM users WHERE id = ?'
    ).get(decodedToken.userId) as any;
    
    // Convert two_factor_enabled to boolean for frontend
    if (user)
    {
      user.twoFactorEnabled = user.two_factor_enabled === 1;
      delete user.two_factor_enabled;
    }
    
    if (!user)
      return reply.code(401).send({ error: 'User not found.' });
    
    return reply.send({ user });
    
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid or expired JWT.' });
  }
}
