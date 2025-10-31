import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getJwtFromRequest } from '../../helpers/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth.helper.js';
import { performAvatarReset } from '../../helpers/avatar.reset.helper.js';

/**
 * POST /auth/avatar/reset
 * Réinitialise l'avatar à la valeur par défaut
 * - Authentification JWT requise
 * - Mise à jour de la base de données
 * - Notification WebSocket aux amis
 */
export async function avatarResetRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);

  if (!session)
    return;

  try {
    const avatarUrl = performAvatarReset(session.id, fastify);

    return reply.send({
      message: 'Avatar reset successfully',
      avatar_url: avatarUrl
    });
  } catch (error) {
    console.error('Error resetting avatar:', error);
    return reply.code(500).send({ error: 'Failed to reset avatar' });
  }
}
