/*
POST /auth/2fa/verify
Verifies the 2FA code and enables 2FA for the user
*/

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { verifyTwoFactorCode, enableTwoFactor } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';
import { isValid2FACode } from '../../../services/validation.service.js';

interface VerifyBody {
  code: string;
}

export async function verify2FARoute(request: FastifyRequest, reply: FastifyReply)
{

  if (!checkRateLimit(`2fa-verify-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window))
    return reply.status(429).send({ error: 'Too many requests. Please try again later.' });

  // Authentication required
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);
  if (!session)
    return;

  const user = getUserById(session.id);
  if (!user)
    return reply.status(404).send({ error: 'User not found' });

  if (!checkRateLimit(`2fa-verify-user-${user.id}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window))
    return reply.status(429).send({ error: 'Too many verification attempts. Please request a new code.' });

  // Get code from body
  const body = request.body as VerifyBody;
  const code = body.code?.trim();

  if (!code)
    return reply.status(400).send({ error: 'Verification code is required' });

  if (!isValid2FACode(code))
    return reply.status(400).send({ error: 'Invalid code format. Code must be 6 digits.' });

  const isValid = verifyTwoFactorCode(user.id, code);

  if (!isValid)
    return reply.status(400).send({ error: 'Invalid or expired code. Please request a new code.' });

  // Enable 2FA for this user
  enableTwoFactor(user.id);

  return reply.send({ 
    success: true, 
    message: 'Two-Factor Authentication has been successfully enabled!' 
  });
}
