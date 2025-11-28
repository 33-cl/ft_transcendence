import { FastifyInstance } from 'fastify';
import { cleanupTempAvatars } from '../helpers/avatar/avatar.cleanup.helper.js';

// Import des routes d'authentification
import { registerRoute } from './auth/register.js';
import { loginRoute } from './auth/login.js';
import { meRoute } from './auth/me.js';
import { logoutRoute } from './auth/logout.js';

// Import des routes 2FA
import { enable2FARoute } from './auth/2fa/enable.js';
import { verify2FARoute } from './auth/2fa/verify.js';
import { disable2FARoute } from './auth/2fa/disable.js';

// Import des routes de profil
import { profileRoute } from './profile/update.js';

// Import des routes d'avatar
import { avatarUploadRoute } from './avatar/upload.js';
import { avatarSaveRoute } from './avatar/save.js';
import { avatarResetRoute } from './avatar/reset.js';

// Cleanup des avatars temporaires au démarrage du serveur
cleanupTempAvatars();

// Extend FastifyRequest to include user property and cookies
declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: number };
    cookies: { [key: string]: string };
  }
}

// JWT_SECRET sera vérifié au runtime (pas au build time)
if (!process.env.JWT_SECRET)
  throw new Error('JWT_SECRET environment variable is not set');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Plugin Fastify regroupant toutes les routes d'authentification et de gestion utilisateur
 * 
 * Routes d'authentification (/auth/*):
 * - POST /auth/register - Inscription d'un nouvel utilisateur
 * - POST /auth/login - Connexion d'un utilisateur
 * - GET /auth/me - Récupération de l'utilisateur courant
 * - POST /auth/logout - Déconnexion d'un utilisateur
 * 
 * Routes de profil (/auth/profile):
 * - PUT /auth/profile - Mise à jour du profil utilisateur
 * 
 * Routes d'avatar (/auth/avatar/*):
 * - POST /auth/avatar/upload - Upload d'un avatar temporaire
 * - POST /auth/avatar/save - Sauvegarde définitive d'un avatar
 * - POST /auth/avatar/reset - Réinitialisation de l'avatar
 */
export default async function authRoutes(fastify: FastifyInstance) {

  // Vérification que JWT_SECRET est défini au démarrage du serveur
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
  }

  // ==================== Routes d'authentification ====================
  fastify.post('/auth/register', registerRoute);
  fastify.post('/auth/login', (request, reply) => loginRoute(request, reply, fastify));
  fastify.get('/auth/me', (request, reply) => meRoute(request, reply, JWT_SECRET));
  fastify.post('/auth/logout', (request, reply) => logoutRoute(request, reply, fastify));

  // ==================== Routes 2FA ====================
  fastify.post('/auth/2fa/enable', enable2FARoute);
  fastify.post('/auth/2fa/verify', verify2FARoute);
  fastify.post('/auth/2fa/disable', disable2FARoute);

  // ==================== Routes de profil ====================
  fastify.put('/auth/profile', (request, reply) => profileRoute(request, reply, fastify));

  // ==================== Routes d'avatar ====================
  fastify.post('/auth/avatar/upload', avatarUploadRoute);
  fastify.post('/auth/avatar/save', (request, reply) => avatarSaveRoute(request, reply, fastify));
  fastify.post('/auth/avatar/reset', (request, reply) => avatarResetRoute(request, reply, fastify));
}
