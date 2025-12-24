import { FastifyInstance } from 'fastify';
import { cleanupTempAvatars } from '../helpers/avatar/avatar.cleanup.helper.js';

// Authentication routes
import { registerRoute } from './auth/register.js';
import { loginRoute } from './auth/login.js';
import { meRoute } from './auth/me.js';
import { logoutRoute } from './auth/logout.js';
import { verifyPasswordRoute } from './auth/verify-password.js';

// 2FA routes
import { enable2FARoute } from './auth/2fa/enable.js';
import { verify2FARoute } from './auth/2fa/verify.js';
import { disable2FARoute } from './auth/2fa/disable.js';
import { verifyOAuth2FARoute } from './auth/2fa/verify-oauth.js';

// Profile routes
import { profileRoute } from './profile/update.js';

// Avatar routes
import { avatarUploadRoute } from './avatar/upload.js';
import { avatarSaveRoute } from './avatar/save.js';
import { avatarResetRoute } from './avatar/reset.js';

// Cleanup temporary avatars on server startup
cleanupTempAvatars();

// Extend FastifyRequest to include user property and cookies
declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: number };
    cookies: { [key: string]: string };
  }
}

if (!process.env.JWT_SECRET)
  throw new Error('JWT_SECRET environment variable is not set');
const JWT_SECRET = process.env.JWT_SECRET;

// Authentication and user management routes
export default async function authRoutes(fastify: FastifyInstance) {

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
  }

  // Authentication routes
  fastify.post('/auth/register', registerRoute);
  fastify.post('/auth/login', (request, reply) => loginRoute(request, reply, fastify));
  fastify.get('/auth/me', (request, reply) => meRoute(request, reply, JWT_SECRET));
  fastify.post('/auth/logout', (request, reply) => logoutRoute(request, reply, fastify));
  fastify.post('/auth/verify-password', (request, reply) => verifyPasswordRoute(request, reply, JWT_SECRET));

  // 2FA routes
  fastify.post('/auth/2fa/enable', enable2FARoute);
  fastify.post('/auth/2fa/verify', verify2FARoute);
  fastify.post('/auth/2fa/disable', disable2FARoute);
  fastify.post('/auth/2fa/verify-oauth', verifyOAuth2FARoute);

  // Profile routes
  fastify.put('/auth/profile', (request, reply) => profileRoute(request, reply, fastify));

  // Avatar routes
  fastify.post('/auth/avatar/upload', avatarUploadRoute);
  fastify.post('/auth/avatar/save', (request, reply) => avatarSaveRoute(request, reply, fastify));
  fastify.post('/auth/avatar/reset', (request, reply) => avatarResetRoute(request, reply, fastify));
}
