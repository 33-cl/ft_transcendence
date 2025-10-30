import { FastifyReply, FastifyInstance } from 'fastify';
import { scryptSync, timingSafeEqual } from 'crypto';
import { isUserAlreadyConnected } from '../socket/socketAuth.js';
import { validateLength, checkRateLimit } from '../security.js';
import { isValidEmail } from '../services/validation.service.js';
import { 
  generateJwt, 
  storeActiveToken, 
  getJwtMaxAge,
  getUserByEmail,
  getUserByUsername,
  verifyJwt,
  removeActiveToken
} from '../services/auth.service.js';
import { removeUserFromActiveList } from '../socket/socketAuth.js';
import { getGlobalIo, broadcastUserStatusChange } from '../socket/socketHandlers.js';

interface DbUser {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

interface SafeUser {
  id: number;
  email: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vérifie un mot de passe contre son hash stocké
 * @param password - Mot de passe en clair
 * @param stored - Hash stocké (format: scrypt:salt:hash)
 * @returns true si le mot de passe est correct
 */
function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    const actualHex = scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(actualHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Vérifie le mot de passe et envoie une erreur 401 si incorrect
 * @returns true si le password est correct, false sinon (et envoie la réponse)
 */
export function checkPassword(password: string, user: DbUser, reply: FastifyReply): boolean {
  if (!verifyPassword(password, user.password_hash)) {
    reply.code(401).send({ error: 'Invalid credentials.' });
    return false;
  }
  return true;
}

/**
 * Vérifie si l'utilisateur est déjà connecté et envoie une erreur 403 si oui
 * @returns true si l'utilisateur n'est PAS déjà connecté, false sinon (et envoie la réponse)
 */
export function checkAlreadyConnected(
  userId: number, 
  username: string, 
  reply: FastifyReply, 
  fastify: FastifyInstance
): boolean {
  if (isUserAlreadyConnected(userId)) {
    fastify.log.warn(`User ${username} (${userId}) attempted to login but is already connected`);
    reply.code(403).send({ 
      error: 'This account is already connected elsewhere.',
      code: 'USER_ALREADY_CONNECTED'
    });
    return false;
  }
  return true;
}

/**
 * Génère un JWT, invalide les anciens tokens, stocke le nouveau et envoie le cookie
 * @returns Le token JWT généré
 */
export function authenticateUser(user: DbUser, reply: FastifyReply): string {
  // Générer le JWT (utilise la fonction du service)
  const jwtToken = generateJwt(user);
  
  // Stocker le nouveau token (invalide automatiquement les anciens)
  storeActiveToken(user.id, jwtToken);
  
  // Envoyer le cookie
  const maxAge = getJwtMaxAge();
  reply.setCookie('jwt', jwtToken, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: maxAge
  });
  
  return jwtToken;
}

/**
 * Crée un objet utilisateur sécurisé (sans password_hash)
 */
export function createSafeUser(user: DbUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar_url: user.avatar_url ?? null,
    wins: user.wins,
    losses: user.losses,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

/**
 * Valide les credentials de login (rate limit + validation + sanitization)
 * et récupère l'utilisateur correspondant
 * @returns L'utilisateur trouvé, ou null si erreur (et envoie la réponse d'erreur)
 */
export function validateAndGetUser(login: string, password: string, clientIp: string, reply: FastifyReply): DbUser | null 
{
  // 1. Rate limiting
    if (!checkRateLimit(`login:${clientIp}`, 5, 60 * 1000))
    {
        reply.code(429).send({ error: 'Too many login attempts. Please try again later.' });
        return null;
    }

    if (!validateLength(login, 1, 255) || !validateLength(password, 1, 255))
    {
        reply.code(400).send({ error: 'Input length validation failed.' });
        return null;
    }

    if (!login || !password)
    {
        reply.code(400).send({ error: 'Missing credentials.' });
        return null;
    }

    // 3. Nettoyage et récupération de l'utilisateur
    const user = getUserByLoginCredential(login);

    if (!user)
    {
        reply.code(401).send({ error: 'Invalid credentials.' });
        return null;
    }

    return user;
}

/**
 * Récupère un utilisateur par son login (email OU username)
 * - Si c'est un email : cherche dans la colonne email (case-insensitive)
 * - Si c'est un username : cherche dans la colonne username (case-sensitive)
 */
function getUserByLoginCredential(login: string): DbUser | undefined
{
    // Supprimer les balises HTML (protection XSS)
    const cleanLogin = login.replace(/<[^>]*>/g, '');

    // Détecter si c'est un email (contient @ et un domaine valide)
    const looksLikeEmail = isValidEmail(cleanLogin);

    if (looksLikeEmail)
    {
        // C'est un email → normaliser en minuscules et chercher dans 'email'
        const normalizedEmail = cleanLogin.toLowerCase();
        return getUserByEmail(normalizedEmail) as DbUser | undefined;
    }
    else
    {
        // C'est un username → garder la casse et chercher dans 'username'
        return getUserByUsername(cleanLogin) as DbUser | undefined;
    }
}

/**
 * Gère la déconnexion d'un utilisateur
 * - Vérifie et décode le JWT
 * - Marque l'utilisateur comme offline (activeUsers)
 * - Notifie les amis via WebSocket
 * - Supprime le token de active_tokens
 * 
 * @param jwtToken - Le token JWT à révoquer
 * @param fastify - Instance Fastify pour les logs et notifications
 */
export function handleLogout(jwtToken: string, fastify: FastifyInstance): void {
  try {
    // Vérifier et décoder le JWT pour obtenir le userId
    const decodedToken = verifyJwt(jwtToken);
    
    if (decodedToken)
    {
      // Marquer l'utilisateur comme offline
      removeUserFromActiveList(decodedToken.userId);
      
      // Notifier les amis via WebSocket
      const io = getGlobalIo();
      if (io)
        broadcastUserStatusChange(decodedToken.userId, 'offline', io, fastify);
    }
    
    // Supprimer le token de active_tokens (même si JWT invalide)
    removeActiveToken(jwtToken);
    
  } catch (err) {
    // En cas d'erreur, supprimer quand même le token
    fastify.log.warn('[LOGOUT] Failed to verify JWT during logout');
    removeActiveToken(jwtToken);
  }
}

// ============================================
// Profile Update Helpers
// ============================================

import { 
  verifyJwt as verifyJwtService,
  isTokenActive,
  getUserById
} from '../services/auth.service.js';
import { 
  sanitizeUsername as sanitizeUsernameUtil, 
  sanitizeEmail as sanitizeEmailUtil
} from '../security.js';
import { 
  isValidUsername as isValidUsernameService,
  isValidEmail as isValidEmailService,
  isValidPassword as isValidPasswordService
} from '../services/validation.service.js';
import { notifyProfileUpdated } from '../socket/socketHandlers.js';
import db from '../db.js';
import { hashPassword as hashPasswordService, verifyPassword as verifyPasswordService } from '../services/auth.service.js';

interface ProfileUpdateData {
  username?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

interface UserSession {
  id: number;
  email: string;
  username: string;
}

/**
 * Authentifie l'utilisateur via JWT et récupère son userId
 * @returns userId si authentifié, undefined sinon (et envoie la réponse d'erreur)
 */
export function authenticateProfileRequest(jwtToken: string | undefined, reply: FastifyReply): number | undefined {
  if (!jwtToken) {
    reply.code(401).send({ error: 'Not authenticated' });
    return undefined;
  }

  try {
    const decodedToken = verifyJwtService(jwtToken);
    if (!decodedToken) {
      reply.code(401).send({ error: 'JWT invalide ou expiré' });
      return undefined;
    }

    // Vérifier que le token est dans active_tokens
    if (!isTokenActive(decodedToken.userId, jwtToken)) {
      reply.code(401).send({ error: 'Session expired or logged out' });
      return undefined;
    }

    return decodedToken.userId;
  } catch (err) {
    reply.code(401).send({ error: 'JWT invalide ou expiré' });
    return undefined;
  }
}

/**
 * Récupère les données de session utilisateur (id, email, username)
 * @returns UserSession si trouvé, undefined sinon (et envoie la réponse d'erreur)
 */
export function getUserSession(userId: number, reply: FastifyReply): UserSession | undefined {
  const sessionRow = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(userId) as UserSession | undefined;
  
  if (!sessionRow) {
    reply.code(401).send({ error: 'Invalid or expired session/JWT' });
    return undefined;
  }
  
  return sessionRow;
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
 * Authentifie via JWT et récupère la session utilisateur en une seule étape.
 * Regroupe authenticateProfileRequest + getUserSession.
 * @returns La session utilisateur ou undefined (et envoie la réponse d'erreur)
 */
export function authenticateAndGetSession(jwtToken: string | undefined, reply: FastifyReply): UserSession | undefined {
  const userId = authenticateProfileRequest(jwtToken, reply);
  if (!userId) return undefined;

  const sessionRow = getUserSession(userId, reply);
  if (!sessionRow) return undefined;

  return sessionRow;
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
