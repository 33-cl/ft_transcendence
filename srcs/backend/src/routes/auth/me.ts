import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';

/**
 * GET /auth/me
 * Récupère l'utilisateur courant via JWT
 * 
 * Flux :
 * 1. Extraction du JWT depuis les cookies
 * 2. Vérification de la validité du JWT
 * 3. Vérification que le token est dans active_tokens
 * 4. Récupération et renvoi des données utilisateur
 */
export async function meRoute(request: FastifyRequest, reply: FastifyReply, jwtSecret: string)
{
  const jwtToken = getJwtFromRequest(request);
  if (!jwtToken)
    return reply.code(401).send({ error: 'No JWT.' });

  try {
    const decodedToken = jwt.verify(jwtToken, jwtSecret) as { userId: number; username: string; email: string };
    
    // token dans active token?
    const activeT = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(decodedToken.userId, jwtToken);
    if (!activeT)
      return reply.code(401).send({ error: 'Session expired or logged out.' });
    
    // Recup user
    const user = db.prepare(
      'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider FROM users WHERE id = ?'
    ).get(decodedToken.userId);
    
    if (!user)
      return reply.code(401).send({ error: 'Utilisateur non trouvé.' });
    
    return reply.send({ user });
    
  } catch (err) {
    return reply.code(401).send({ error: 'JWT invalide ou expiré.' });
  }
}
