import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { verifyPassword } from '../../services/auth.service.js';

// POST /auth/verify-password
// Verifies user's current password without changing it
export async function verifyPasswordRoute(request: FastifyRequest, reply: FastifyReply, jwtSecret: string)
{
  const jwtToken = getJwtFromRequest(request);
  if (!jwtToken)
    return reply.code(401).send({ error: 'Unauthorized' });

  try {
    const decodedToken = jwt.verify(jwtToken, jwtSecret) as { userId: number };
    
    // Check if token is still active
    const activeT = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(decodedToken.userId, jwtToken);
    if (!activeT)
      return reply.code(401).send({ error: 'Session expired' });

    // Get password hash from database
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(decodedToken.userId) as { password_hash: string };
    
    if (!user)
      return reply.code(404).send({ error: 'User not found' });

    // Verify provided password
    const body = request.body as { password?: string };
    const password = body.password;

    if (!password)
      return reply.code(400).send({ error: 'Password required' });

    const isValid = verifyPassword(password, user.password_hash);

    if (!isValid)
      return reply.code(401).send({ error: 'Invalid password' });

    return reply.send({ success: true });

  } catch (err) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}
