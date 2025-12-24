/*
 POST /auth/2fa/enable
 Enables 2FA for the user and sends a verification code by email
*/

import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../../../services/auth.service.js';
import { generateTwoFactorCode, storeTwoFactorCode, sendTwoFactorEmail } from '../../../services/twoFactor.service.js';
import { getJwtFromRequest } from '../../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../../helpers/auth/session.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';

export async function enable2FARoute(request: FastifyRequest, reply: FastifyReply)
{
  if (!checkRateLimit(`2fa-enable-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window))
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

  // Check that user has an email
  if (!user.email)
    return reply.status(400).send({ error: 'No email address associated with this account' });

  // Block 2FA if temporary email (Google OAuth with conflict)
  if (user.email.endsWith('@oauth.local'))
  {
    return reply.status(400).send({ 
      error: 'Please update your email address before enabling Two-Factor Authentication. Your current email is temporary.',
      code: 'TEMPORARY_EMAIL'
    });
  }

  try {
    const code = generateTwoFactorCode();
    
    // Store code in database
    storeTwoFactorCode(user.id, code, 5);
    
    // Send code by email
    await sendTwoFactorEmail(user.email, user.username, code);
    
    return reply.send({ 
      success: true, 
      message: 'A verification code has been sent to your email. Please check your inbox.' 
    });
  } catch (error) {
    console.error('Error sending 2FA verification code:', error);
    return reply.status(500).send({ error: 'Failed to send verification code. Please try again later.' });
  }
}
