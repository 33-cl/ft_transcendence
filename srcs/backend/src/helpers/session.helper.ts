import { FastifyReply } from 'fastify';
import { verifyJwt as verifyJwtService, isTokenActive } from '../services/auth.service.js';
import db from '../db.js';

interface UserSession {
  id: number;
  email: string;
  username: string;
}

/**
 * Authentifie l'utilisateur via JWT et récupère son userId
 * @returns userId si authentifié, undefined sinon (et envoie la réponse d'erreur)
 */
export function authenticateProfileRequest(jwtToken: string | undefined, reply: FastifyReply): number | undefined {
  if (!jwtToken) {
    reply.code(401).send({ error: 'Not authenticated' });
    return undefined;
  }

  try {
    const decodedToken = verifyJwtService(jwtToken);
    if (!decodedToken) {
      reply.code(401).send({ error: 'JWT invalide ou expiré' });
      return undefined;
    }

    // Vérifier que le token est dans active_tokens
    if (!isTokenActive(decodedToken.userId, jwtToken)) {
      reply.code(401).send({ error: 'Session expired or logged out' });
      return undefined;
    }

    return decodedToken.userId;
  } catch (err) {
    reply.code(401).send({ error: 'JWT invalide ou expiré' });
    return undefined;
  }
}

/**
 * Récupère les données de session utilisateur (id, email, username)
 * @returns UserSession si trouvé, undefined sinon (et envoie la réponse d'erreur)
 */
export function getUserSession(userId: number, reply: FastifyReply): UserSession | undefined {
  const sessionRow = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(userId) as UserSession | undefined;
  
  if (!sessionRow) {
    reply.code(401).send({ error: 'Invalid or expired session/JWT' });
    return undefined;
  }
  
  return sessionRow;
}

/**
 * Authentifie via JWT et récupère la session complète (combine les 2 fonctions ci-dessus)
 * @returns UserSession si authentifié, undefined sinon (et envoie la réponse d'erreur)
 */
export function authenticateAndGetSession(jwtToken: string | undefined, reply: FastifyReply): UserSession | undefined {
  const userId = authenticateProfileRequest(jwtToken, reply);
  if (!userId) return undefined;

  const sessionRow = getUserSession(userId, reply);
  if (!sessionRow) return undefined;

  return sessionRow;
}
