/**
 * POST /auth/2fa/disable
 * Désactive la 2FA pour l'utilisateur
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { disableTwoFactor, isTwoFactorEnabled } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';

export async function disable2FARoute(request: FastifyRequest, reply: FastifyReply) {
  // Rate limiting: 3 tentatives par minute
  if (!checkRateLimit(`2fa-disable-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window)) {
    return reply.status(429).send({ error: 'Too many requests. Please try again later.' });
  }

  // Authentification requise
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);
  if (!session) return;

  // Récupérer l'utilisateur
  const user = getUserById(session.id);
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }

  try {
    // Vérifier si la 2FA est activée
    if (!isTwoFactorEnabled(user.id)) {
      return reply.status(400).send({ error: 'Two-Factor Authentication is not enabled' });
    }

    // Désactiver la 2FA
    disableTwoFactor(user.id);

    return reply.send({ 
      success: true, 
      message: 'Two-Factor Authentication has been successfully disabled' 
    });
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to disable 2FA. Please try again.' });
  }
}
