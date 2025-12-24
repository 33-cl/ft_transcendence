import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth/session.helper.js';
import { validateAndSanitizeProfileInput, verifyPasswordAndUniqueness, updateUserProfile } from '../../helpers/auth/profile.helper.js';
import { notifyProfileUpdated, broadcastLeaderboardUpdate } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';
import { checkRateLimit, RATE_LIMITS } from '../../security.js';

// PUT /auth/profile
// Updates user profile: validate input, verify password/uniqueness, update DB, notify friends
export async function profileRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  const sessionRow = authenticateAndGetSession(jwtToken, reply);
  if (!sessionRow)
    return;

  const rateLimitKey = `profile_update:${sessionRow.id}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMITS.PROFILE_UPDATE.max, RATE_LIMITS.PROFILE_UPDATE.window))
    return reply.code(429).send({ error: 'Too many profile update attempts, please try again later' });

  // Extract request body
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

    // Check if email changed and if 2FA was enabled before update
    const emailChanged = sanitizedEmail && sanitizedEmail !== sessionRow.email;
    const userBefore = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(sessionRow.id) as { two_factor_enabled: number } | undefined;
    const had2FAEnabled = userBefore?.two_factor_enabled === 1;
    
    if (!updateUserProfile({ username: sanitizedUsername, email: sanitizedEmail, newPassword }, sessionRow.id, reply))
      return;

    const updatedRow = db.prepare('SELECT username, email, avatar_url, two_factor_enabled FROM users WHERE id = ?').get(sessionRow.id) as { username: string; email: string; avatar_url: string | null; two_factor_enabled: number } | undefined;

    if (updatedRow && updatedRow.username && updatedRow.username !== sessionRow.username) {
      notifyProfileUpdated(getGlobalIo(), sessionRow.id, { username: updatedRow.username, avatar_url: updatedRow.avatar_url ?? undefined }, fastify);
      broadcastLeaderboardUpdate(getGlobalIo(), sessionRow.id, { username: updatedRow.username, avatar_url: updatedRow.avatar_url ?? undefined }, fastify);
    }

    // Inform user if 2FA was disabled due to email change
    let message = 'Profile updated successfully';
    const twoFactorWasDisabled = emailChanged && had2FAEnabled;
    if (twoFactorWasDisabled)
      message = 'Profile updated successfully. Two-Factor Authentication has been disabled for security (new email address). You can re-enable it in settings.';

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
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
