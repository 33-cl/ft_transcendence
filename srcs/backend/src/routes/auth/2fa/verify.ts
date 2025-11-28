/**
 * POST /auth/2fa/verify
 * Vérifie le code 2FA et active la 2FA pour l'utilisateur
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { verifyTwoFactorCode, enableTwoFactor } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';

interface VerifyBody {
  code: string;
}

export async function verify2FARoute(request: FastifyRequest, reply: FastifyReply) {
  // Rate limiting: 3 tentatives par minute par IP
  if (!checkRateLimit(`2fa-verify-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window)) {
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

  // Rate limiting additionnel par utilisateur
  if (!checkRateLimit(`2fa-verify-user-${user.id}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window)) {
    return reply.status(429).send({ error: 'Too many verification attempts. Please request a new code.' });
  }

  // Récupérer le code depuis le body
  const body = request.body as VerifyBody;
  const code = body.code?.trim();

  if (!code) {
    return reply.status(400).send({ error: 'Verification code is required' });
  }

  // Vérifier que le code est un nombre à 6 chiffres
  if (!/^\d{6}$/.test(code)) {
    return reply.status(400).send({ error: 'Invalid code format. Code must be 6 digits.' });
  }

  try {
    // Vérifier le code
    const isValid = verifyTwoFactorCode(user.id, code);

    if (!isValid) {
      return reply.status(400).send({ error: 'Invalid or expired code. Please request a new code.' });
    }

    // Activer la 2FA pour cet utilisateur
    enableTwoFactor(user.id);

    return reply.send({ 
      success: true, 
      message: 'Two-Factor Authentication has been successfully enabled!' 
    });
  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    return reply.status(500).send({ error: 'Failed to verify code. Please try again.' });
  }
}
