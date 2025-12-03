import jwt from 'jsonwebtoken';
import db from '../../db.js';
import { FastifyRequest, FastifyReply } from 'fastify';

export function parseCookies(header?: string): Record<string, string>
{
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export function getJwtFromRequest(request: FastifyRequest): string | undefined
{
  const cookies = parseCookies(request.headers['cookie'] as string | undefined);
  return cookies['jwt'];
}

/**
 * Vérifie l'authentification JWT et retourne l'userId si valide
 * Envoie automatiquement une réponse d'erreur si non authentifié
 * @returns userId si authentifié, null sinon (reply déjà envoyée)
 */
export function verifyAuthFromRequest(request: FastifyRequest, reply: FastifyReply): number | null {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    reply.status(500).send({ error: 'Server configuration error' });
    return null;
  }

  const jwtToken = getJwtFromRequest(request);
  
  if (!jwtToken) {
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  }

  try {
    const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
    const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
    if (!active) {
      reply.status(401).send({ error: 'Session expired or logged out' });
      return null;
    }
    return payload.userId;
  } catch (err) {
    reply.status(401).send({ error: 'Invalid token' });
    return null;
  }
}
