/*
 POST /auth/2fa/disable
 Disables 2FA for the user
*/

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { disableTwoFactor, isTwoFactorEnabled } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';

export async function disable2FARoute(request: FastifyRequest, reply: FastifyReply)
{
  // Rate limiting 3 attempts per minute
  if (!checkRateLimit(`2fa-disable-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window))
    return reply.status(429).send({ error: 'Too many requests. Please try again later.' });

  // Authentication required
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);
  if (!session)
    return;

  // Get the user
  const user = getUserById(session.id);
  if (!user)
    return reply.status(404).send({ error: 'User not found' });

  // Check if 2FA is enabled
  if (!isTwoFactorEnabled(user.id))
    return reply.status(400).send({ error: 'Two-Factor Authentication is not enabled' });

  // Disable 2FA
  disableTwoFactor(user.id);

  return reply.send({ 
    success: true, 
    message: 'Two-Factor Authentication has been successfully disabled' 
  });
}
