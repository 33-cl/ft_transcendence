import { FastifyReply } from 'fastify';
import { validateLength } from '../security.js';
import { 
  sanitizeUsername as sanitizeUsernameUtil, 
  sanitizeEmail as sanitizeEmailUtil
} from '../security.js';
import { 
  isValidUsername as isValidUsernameService,
  isValidEmail as isValidEmailService,
  isValidPassword as isValidPasswordService
} from '../services/validation.service.js';
import { hashPassword as hashPasswordService, verifyPassword as verifyPasswordService } from '../services/auth.service.js';
import db from '../db.js';

interface ProfileUpdateData {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Valide les longueurs des inputs du profil
 * @returns true si valide, false sinon (et envoie la réponse d'erreur)
 */
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

/**
 * Sanitize et valide les données du profil
 * @returns Données sanitized si valides, undefined sinon (et envoie la réponse d'erreur)
 */
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

/**
 * Vérifie le mot de passe actuel si l'utilisateur veut en changer
 * @returns true si valide ou pas de changement, false sinon (et envoie la réponse d'erreur)
 */
export function verifyCurrentPassword(
  newPassword: string | undefined,
  currentPassword: string | undefined,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!newPassword || !currentPassword) {
    return true; // Pas de changement de password
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

/**
 * Vérifie l'unicité de l'email s'il est changé
 * @returns true si unique ou pas changé, false sinon (et envoie la réponse d'erreur)
 */
export function checkEmailUniqueness(
  email: string | undefined,
  currentEmail: string,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!email || email === currentEmail) {
    return true; // Pas de changement
  }

  const existingEmailUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
  if (existingEmailUser) {
    reply.code(409).send({ error: 'Email already taken' });
    return false;
  }

  return true;
}

/**
 * Vérifie l'unicité du username s'il est changé
 * @returns true si unique ou pas changé, false sinon (et envoie la réponse d'erreur)
 */
export function checkUsernameUniqueness(
  username: string | undefined,
  currentUsername: string,
  userId: number,
  reply: FastifyReply
): boolean {
  if (!username || username === currentUsername)
    return true; // Pas de changement

  const existingUsernameUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
  if (existingUsernameUser)
  {
    reply.code(409).send({ error: 'Username already taken' });
    return false;
  }

  return true;
}

/**
 * Construit et exécute la requête UPDATE pour le profil
 * @returns true si au moins une modification, false si aucun changement (et envoie la réponse d'erreur)
 */
export function updateUserProfile(
  data: ProfileUpdateData,
  userId: number,
  reply: FastifyReply
): boolean {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.username) {
    updates.push('username = ?');
    values.push(data.username);
  }

  if (data.email) {
    updates.push('email = ?');
    values.push(data.email);
  }

  if (data.newPassword) {
    const passwordHash = hashPasswordService(data.newPassword);
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));

  if (updates.length === 1) { // Seulement updated_at
    reply.code(400).send({ error: 'No changes provided' });
    return false;
  }

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  values.push(userId);
  
  db.prepare(query).run(...values);
  
  return true;
}

/**
 * Valide les longueurs + sanitize et valide les données du profil.
 * Regroupe validateProfileInputLengths + sanitizeAndValidateProfileData.
 * @returns Les valeurs sanitized ou undefined (et envoie la réponse d'erreur)
 */
export function validateAndSanitizeProfileInput(
  data: ProfileUpdateData,
  reply: FastifyReply
): { sanitizedUsername?: string; sanitizedEmail?: string } | undefined
{
  // Validation des longueurs
  if (!validateProfileInputLengths(data, reply))
    return undefined;

  // Sanitization et validation des données
  const sanitized = sanitizeAndValidateProfileData(data, reply);
  if (!sanitized)
    return undefined;

  return sanitized;
}

/**
 * Vérifie le mot de passe actuel + l'unicité de l'email + l'unicité du username.
 * Regroupe verifyCurrentPassword + checkEmailUniqueness + checkUsernameUniqueness.
 * @returns true si toutes les vérifications passent, false sinon (et envoie la réponse d'erreur)
 */
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
  // Vérification du mot de passe actuel si changement
  if (!verifyCurrentPassword(newPassword, currentPassword, userId, reply))
    return false;

  // Vérification unicité email
  if (!checkEmailUniqueness(sanitizedEmail, sessionEmail, userId, reply))
    return false;

  // Vérification unicité username
  if (!checkUsernameUniqueness(sanitizedUsername, sessionUsername, userId, reply))
    return false;

  return true;
}
