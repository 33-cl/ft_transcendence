import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { validateAndGetUser, checkPassword, checkAlreadyConnected, authenticateUser, createSafeUser } from '../../helpers/auth/login.helper.js';
import { isTwoFactorEnabled, generateTwoFactorCode, storeTwoFactorCode, sendTwoFactorEmail, verifyTwoFactorCode } from '../../services/twoFactor.service.js';
import { isValid2FACode } from '../../services/validation.service.js';

/*
POST /auth/login
User login

Validation, rate limiting and user retrieval (validateAndGetUser)
Password verification (checkPassword)
If 2FA enabled: send code or verify code
Check if already connected (checkAlreadyConnected)
Authentication - JWT + cookie + active_tokens (authenticateUser)
Send response with safe user data (createSafeUser)
*/
export async function loginRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const body = (request.body as any) || {};
  const login: string = (body.login ?? body.username ?? body.email ?? '').toString().trim();
  const password: string = (body.password ?? '').toString();
  const twoFactorCode: string = (body.twoFactorCode ?? '').toString().trim();

  if (twoFactorCode && !isValid2FACode(twoFactorCode))
    return reply.status(400).send({ error: 'Invalid code format. Code must be 6 digits.' });

  const user = validateAndGetUser(login, password, request.ip, reply);
  if (!user)
    return;

  if (!checkPassword(password, user, reply))
    return;

  const has2FA = isTwoFactorEnabled(user.id);

  if (has2FA)
  {
    if (!twoFactorCode)
    {
      // send verification code by email
      try {
        const code = generateTwoFactorCode();
        storeTwoFactorCode(user.id, code, 5);
        await sendTwoFactorEmail(user.email, user.username, code);
        
        return reply.status(200).send({ 
          requires2FA: true, 
          message: 'A verification code has been sent to your email. Please enter it to complete login.' 
        });
      } catch (error) {
        console.error('Error sending 2FA code during login:', error);
        return reply.status(500).send({ error: 'Failed to send verification code. Please try again.' });
      }
    }

    // verify code provided before login
    const isValidCode = verifyTwoFactorCode(user.id, twoFactorCode);
    
    if (!isValidCode)
      return reply.status(400).send({ error: 'Invalid or expired verification code. Please try again.' });
  }

  if (!checkAlreadyConnected(user.id, user.username, reply, fastify))
    return;

  // Authentication (generate JWT, store token, send cookie)
  authenticateUser(user, reply);

  // Return user without password hash
  const safeUser = createSafeUser(user);

  return reply.send({ user: safeUser });
}
