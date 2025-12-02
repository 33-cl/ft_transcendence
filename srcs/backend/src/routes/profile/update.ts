import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth/session.helper.js';
import { validateAndSanitizeProfileInput, verifyPasswordAndUniqueness, updateUserProfile } from '../../helpers/auth/profile.helper.js';
import { notifyProfileUpdated } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';

/**
 * PUT /auth/profile
 * Mise à jour du profil utilisateur (username, email, password)
 * 
 * Flux :
 * 1. Authentification JWT (authenticateProfileRequest)
 * 2. Récupération de la session utilisateur (getUserSession)
 * 3. Extraction du body (username, email, currentPassword, newPassword)
 * 4. Validation des longueurs des inputs (validateProfileInputLengths)
 * 5. Sanitization et validation des données (sanitizeAndValidateProfileData)
 * 6. Vérification du mot de passe actuel si changement (verifyCurrentPassword)
 * 7. Vérification unicité email si changé (checkEmailUniqueness)
 * 8. Vérification unicité username si changé (checkUsernameUniqueness)
 * 9. Construction et exécution de l'UPDATE (updateUserProfile)
 * 10. Notification WebSocket aux amis (notifyProfileUpdated)
 * 11. Réponse de confirmation
 */
export async function profileRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  const sessionRow = authenticateAndGetSession(jwtToken, reply);
  if (!sessionRow)
    return;

  // Extraction du body
  const { username, email, currentPassword, newPassword } = (request.body as {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) || {};

  const sanitized = validateAndSanitizeProfileInput({ username, email, currentPassword, newPassword }, reply);
  if (!sanitized)
    return;

  const sanitizedUsername = sanitized.sanitizedUsername;
  const sanitizedEmail = sanitized.sanitizedEmail;

  try {
    if (!verifyPasswordAndUniqueness(newPassword, currentPassword, sanitizedEmail, sanitizedUsername, sessionRow.email, sessionRow.username, sessionRow.id, reply))
      return;

    // Vérifier si l'email a changé ET si la 2FA était activée AVANT la mise à jour
    const emailChanged = sanitizedEmail && sanitizedEmail !== sessionRow.email;
    const userBefore = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(sessionRow.id) as { two_factor_enabled: number } | undefined;
    const had2FAEnabled = userBefore?.two_factor_enabled === 1;
    
    if (!updateUserProfile({ username: sanitizedUsername, email: sanitizedEmail, newPassword }, sessionRow.id, reply))
      return;

    const updatedRow = db.prepare('SELECT username, email, avatar_url, two_factor_enabled FROM users WHERE id = ?').get(sessionRow.id) as { username: string; email: string; avatar_url: string | null; two_factor_enabled: number } | undefined;

    if (updatedRow && updatedRow.username && updatedRow.username !== sessionRow.username)
      notifyProfileUpdated(getGlobalIo(), sessionRow.id, { username: updatedRow.username, avatar_url: updatedRow.avatar_url ?? undefined }, fastify);

    // Message adapté : mentionner la 2FA SEULEMENT si elle était activée avant
    let message = 'Profile updated successfully';
    const twoFactorWasDisabled = emailChanged && had2FAEnabled;
    if (twoFactorWasDisabled) {
      message = 'Profile updated successfully. Two-Factor Authentication has been disabled for security (new email address). You can re-enable it in settings.';
    }

    return reply.send({
      ok: true,
      message,
      updated: {
        username: updatedRow?.username ?? sessionRow.username,
        email: updatedRow?.email ?? sessionRow.email,
        passwordChanged: !!newPassword,
        twoFactorDisabled: twoFactorWasDisabled
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
