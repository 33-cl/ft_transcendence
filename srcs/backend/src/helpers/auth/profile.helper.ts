import { FastifyReply } from 'fastify';
import { validateLength } from '../../security.js';
import { 
  sanitizeUsername as sanitizeUsernameUtil, 
  sanitizeEmail as sanitizeEmailUtil
} from '../../security.js';
import { 
  isValidUsername as isValidUsernameService,
  isValidEmail as isValidEmailService,
  isValidPassword as isValidPasswordService
} from '../../services/validation.service.js';
import { hashPassword as hashPasswordService, verifyPassword as verifyPasswordService } from '../../services/auth.service.js';
import db from '../../db.js';

interface ProfileUpdateData {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export function validateProfileInputLengths(data: ProfileUpdateData, reply: FastifyReply): boolean {
  if (data.username && !validateLength(data.username, 1, 50)) {
    reply.code(400).send({ error: 'Username length invalid' });
    return false;
  }
  if (data.email && !validateLength(data.email, 1, 255)) {
    reply.code(400).send({ error: 'Email length invalid' });
    return false;
  }
  if (data.currentPassword && !validateLength(data.currentPassword, 1, 255)) {
    reply.code(400).send({ error: 'Password length invalid' });
    return false;
  }
  if (data.newPassword && !validateLength(data.newPassword, 1, 255)) {
    reply.code(400).send({ error: 'Password length invalid' });
    return false;
  }
  return true;
}

export function sanitizeAndValidateProfileData(
  data: ProfileUpdateData, 
  reply: FastifyReply
): { sanitizedUsername?: string; sanitizedEmail?: string } | undefined {
  const sanitizedUsername = data.username ? sanitizeUsernameUtil(data.username) : undefined;
  const sanitizedEmail = data.email ? sanitizeEmailUtil(data.email) : undefined;

  if (sanitizedUsername !== undefined && !isValidUsernameService(sanitizedUsername)) {
    reply.code(400).send({ error: 'Invalid username (3-10 characters, alphanumeric and underscore)' });
    return undefined;
  }

  if (sanitizedEmail !== undefined && !isValidEmailService(sanitizedEmail)) {
    reply.code(400).send({ error: 'Invalid email format' });
    return undefined;
  }

  if (data.newPassword !== undefined && !isValidPasswordService(data.newPassword)) {
    reply.code(400).send({ error: 'New password too short (min 8 characters)' });
    return undefined;
  }

  return { sanitizedUsername, sanitizedEmail };
}

export function verifyCurrentPassword(
  newPassword: string | undefined,
  currentPassword: string | undefined,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!newPassword || !currentPassword) {
    return true;
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return false;
  }

  if (!verifyPasswordService(currentPassword, user.password_hash)) {
    reply.code(400).send({ error: 'Current password is incorrect' });
    return false;
  }

  return true;
}

export function checkEmailUniqueness(
  email: string | undefined,
  currentEmail: string,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!email || email === currentEmail) return true;
  const existingEmailUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
  if (existingEmailUser) {
    reply.code(409).send({ error: 'Email already taken' });
    return false;
  }
  return true;
}

export function checkUsernameUniqueness(
  username: string | undefined,
  currentUsername: string,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!username || username === currentUsername) return true;
  const existingUsernameUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
  if (existingUsernameUser) {
    reply.code(409).send({ error: 'Username already taken' });
    return false;
  }
  return true;
}

export function updateUserProfile(data: ProfileUpdateData, userId: number, reply: FastifyReply): boolean {
  const updates: string[] = [];
  const values: any[] = [];
  if (data.username) { updates.push('username = ?'); values.push(data.username); }
  if (data.email) { updates.push('email = ?'); values.push(data.email); }
  if (data.newPassword) { const passwordHash = hashPasswordService(data.newPassword); updates.push('password_hash = ?'); values.push(passwordHash); }
  updates.push('updated_at = ?'); values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
  if (updates.length === 1) { reply.code(400).send({ error: 'No changes provided' }); return false; }
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  values.push(userId);
  db.prepare(query).run(...values);
  return true;
}

export function validateAndSanitizeProfileInput(data: ProfileUpdateData, reply: FastifyReply): { sanitizedUsername?: string; sanitizedEmail?: string } | undefined {
  if (!validateProfileInputLengths(data, reply)) return undefined;
  const sanitized = sanitizeAndValidateProfileData(data, reply);
  if (!sanitized) return undefined;
  return sanitized;
}

export function verifyPasswordAndUniqueness(
  newPassword: string | undefined,
  currentPassword: string | undefined,
  sanitizedEmail: string | undefined,
  sanitizedUsername: string | undefined,
  sessionEmail: string,
  sessionUsername: string,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!verifyCurrentPassword(newPassword, currentPassword, userId, reply)) return false;
  if (!checkEmailUniqueness(sanitizedEmail, sessionEmail, userId, reply)) return false;
  if (!checkUsernameUniqueness(sanitizedUsername, sessionUsername, userId, reply)) return false;
  return true;
}
