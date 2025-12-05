import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { validateAndGetUser, checkPassword, checkAlreadyConnected, authenticateUser, createSafeUser } from '../../helpers/auth/login.helper.js';
import { isTwoFactorEnabled, generateTwoFactorCode, storeTwoFactorCode, sendTwoFactorEmail, verifyTwoFactorCode } from '../../services/twoFactor.service.js';
import { isValid2FACode } from '../../services/validation.service.js';

/**
 * POST /auth/login
 * Connexion d'un utilisateur
 * 
 * Flux :
 * 1. Validation, rate limiting et récupération de l'utilisateur (validateAndGetUser)
 * 2. Vérification du password (checkPassword)
 * 3. Si 2FA activée : envoie d'un code ou vérification du code
 * 4. Vérification si déjà connecté (checkAlreadyConnected)
 * 5. Authentification - JWT + cookie + active_tokens (authenticateUser)
 * 6. Envoi de la réponse avec données sécurisées (createSafeUser)
 */
export async function loginRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const body = (request.body as any) || {};
  const login: string = (body.login ?? body.username ?? body.email ?? '').toString().trim();
  const password: string = (body.password ?? '').toString();
  const twoFactorCode: string = (body.twoFactorCode ?? '').toString().trim();

  // 🔒 SÉCURITÉ : Validation du format du code 2FA (6 chiffres uniquement)
  if (twoFactorCode && !isValid2FACode(twoFactorCode)) {
    return reply.status(400).send({ error: 'Invalid code format. Code must be 6 digits.' });
  }

  // Validation, rate limiting et recup de l'utilisateur
  const user = validateAndGetUser(login, password, request.ip, reply);
  if (!user)
    return;

  if (!checkPassword(password, user, reply))
    return;

  // Vérifier si l'utilisateur a activé la 2FA
  const has2FA = isTwoFactorEnabled(user.id);

  if (has2FA) {
    // Si l'utilisateur a activé la 2FA
    if (!twoFactorCode) {
      // Pas de code fourni, on envoie un nouveau code par email
      try {
        const code = generateTwoFactorCode();
        storeTwoFactorCode(user.id, code, 5);
        console.log(`📧 2FA: Sending code to ${user.email} for user ${user.id}`);
        await sendTwoFactorEmail(user.email, user.username, code);
        
        return reply.status(200).send({ 
          requires2FA: true, 
          message: 'A verification code has been sent to your email. Please enter it to complete login.' 
        });
      } catch (error) {
        console.error('Error sending 2FA code during login:', error);
        return reply.status(500).send({ error: 'Failed to send verification code. Please try again.' });
      }
    } else {
      // Code fourni, on le vérifie
      console.log(`🔐 2FA: Verifying code "${twoFactorCode}" for user ${user.id} (${user.username})`);
      const isValidCode = verifyTwoFactorCode(user.id, twoFactorCode);
      
      if (!isValidCode) {
        console.log(`❌ 2FA: Code verification failed for user ${user.id}`);
        return reply.status(400).send({ error: 'Invalid or expired verification code. Please try again.' });
      }
      
      console.log(`✅ 2FA: Code verified successfully for user ${user.id}`);
      // Code valide, on continue avec le login normal
    }
  }

  if (!checkAlreadyConnected(user.id, user.username, reply, fastify))
    return;

  // Authentification (genere JWT, stocke token, envoie cookie)
  authenticateUser(user, reply);

  // sans pswd hash
  const safeUser = createSafeUser(user);

  return reply.send({ user: safeUser });
}
