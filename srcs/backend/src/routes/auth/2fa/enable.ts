/**
 * POST /auth/2fa/enable
 * Active la 2FA pour l'utilisateur et envoie un code de vérification par email
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { generateTwoFactorCode, storeTwoFactorCode, sendTwoFactorEmail } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';

export async function enable2FARoute(request: FastifyRequest, reply: FastifyReply) {
  // Rate limiting: 3 tentatives par minute
  if (!checkRateLimit(`2fa-enable-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window)) {
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

  // Vérifier que l'utilisateur a un email
  if (!user.email) {
    return reply.status(400).send({ error: 'No email address associated with this account' });
  }

  try {
    // Générer un code de vérification
    const code = generateTwoFactorCode();
    
    // Stocker le code dans la base de données (expire dans 5 minutes)
    storeTwoFactorCode(user.id, code, 5);
    
    // Envoyer le code par email
    await sendTwoFactorEmail(user.email, user.username, code);
    
    return reply.send({ 
      success: true, 
      message: 'A verification code has been sent to your email. Please check your inbox.' 
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return reply.status(500).send({ error: 'Failed to send verification code. Please try again later.' });
  }
}
