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
  getUserByUsername
} from '../services/auth.service.js';

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
