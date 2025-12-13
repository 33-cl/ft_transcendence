import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth/session.helper.js';
import { performAvatarReset } from '../../helpers/avatar/avatar.reset.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../security.js';

/**
 * POST /auth/avatar/reset
 * Réinitialise l'avatar à la valeur par défaut
 * - Authentification JWT requise
 * - Rate limiting (5/min)
 * - Mise à jour de la base de données
 * - Notification WebSocket aux amis
 */
export async function avatarResetRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);

  if (!session)
    return;

  // SECURITY: Rate limiting pour éviter le spam
  if (!checkRateLimit(`avatar_reset_${session.id}`, RATE_LIMITS.UPLOAD_AVATAR.max, RATE_LIMITS.UPLOAD_AVATAR.window)) {
    return reply.code(429).send({ error: 'Too many reset attempts. Please wait a moment.' });
  }

  try {
    const avatarUrl = performAvatarReset(session.id, fastify);

    return reply.send({
      message: 'Avatar reset successfully',
      avatar_url: avatarUrl
    });
  } catch (error) {
    return reply.code(500).send({ error: 'Failed to reset avatar' });
  }
}
