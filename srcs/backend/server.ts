import 'dotenv/config';

import fastify, {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify'; // Import the Fastify framework (HTTP server)
import fastifyCors from '@fastify/cors'; // CORS plugin for Fastify
import fastifyRateLimit from '@fastify/rate-limit'; // Rate limiting plugin
import fs from 'fs'; // For reading SSL files (key/certificate)
import path from 'path'; // For handling file paths
import { Server as SocketIOServer } from 'socket.io';

import usersRoutes from './src/routes/users/index.js'; // /users route (REST API) - refactored as modules
import roomsRoutes from './src/routes/rooms.js'; // /rooms route (REST API)
import authRoutes from './src/routes/auth.js'; // /auth route (registration)
import matchesRoutes from './src/routes/matches.js'; // /matches route (match recording)
import tournamentsRoutes from './src/routes/tournaments.js'; // /tournaments route (tournaments)
import oauthRoutes from './src/routes/oauth.js'; // /auth/google/callback route (OAuth)
import gamesRoutes from './src/routes/game-cli.js'; // /api/games route (CLI game control)
import avatarProxyRoutes from './src/routes/avatar-proxy.js'; // /avatar-proxy route (Google avatar proxy)
import { validateId } from './src/security.js'; // Import security helpers

import registerSocketHandlers from './src/socket/socketHandlers.js'; // Function to register WebSocket handlers
import { getUserById } from './src/user.js'; // Import getUserById getter

import fastifyOAuth2 from '@fastify/oauth2';
import fastifyCookie from '@fastify/cookie'; // Cookie plugin for Fastify
import fastifyMultipart from '@fastify/multipart'; // Multipart plugin for Fastify

// SSL configuration for secure HTTPS
const key = fs.readFileSync('./key.pem');  // SSL private key
const cert = fs.readFileSync('./cert.pem'); // SSL certificate

// Create Fastify instance with HTTPS
const app = fastify({
  logger: true,
  https: {key, cert}
});

// Function to ensure avatar directory exists
function ensureAvatarDirectory()
{
  const avatarDir = path.join(process.cwd(), 'public', 'avatars');
  if (!fs.existsSync(avatarDir))
    fs.mkdirSync(avatarDir, { recursive: true });
}

// Disable cache on all http responses-> always ask to server for fresh data
app.addHook('onSend', (request, reply, payload, done) => {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  done();
});

// Main async function to start everything
(async () => {
  try {
    ensureAvatarDirectory();

    // Register CORS plugin for Fastify (Strict whitelist)
    const corsOrigin = ['https://localhost:3000'];
    
    await app.register(fastifyCors, {
      origin: corsOrigin,
      credentials: true // Allow authentication cookies
    });

    // Register Cookie plugin for Fastify for reply.setCookie
    await app.register(fastifyCookie, {
    });

    // Register global Rate Limiting plugin (DoS protection)
    const rateWindowMs = Number(60000); // Default: 1 minute
    const rateMax = Number(200); // Default: 200 requests per window
    await app.register(fastifyRateLimit, {
      max: rateMax,
      timeWindow: rateWindowMs,
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true
      }
    });

    // Register multipart plugin for avatar upload
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
      }
    });

    // Google OAuth2
    await app.register(fastifyOAuth2, {
      name: 'google',
      scope: ['openid', 'profile', 'email'], // Add 'openid' to get id_token
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID || '',
          secret: process.env.GOOGLE_CLIENT_SECRET || ''
        },
        auth: {
          authorizeHost: 'https://accounts.google.com',
          authorizePath: '/o/oauth2/v2/auth',
          tokenHost: 'https://oauth2.googleapis.com',
          tokenPath: '/token'
        }
      },
      startRedirectPath: '/auth/google',
      callbackUri: 'https://localhost:3000/auth/google/callback'
    });

    ensureAvatarDirectory();

    // Register routes
    app.register(usersRoutes); // Add /users routes
    app.register(roomsRoutes); // Add /rooms routes
    app.register(authRoutes);  // Add /auth routes
    app.register(matchesRoutes); // Add /matches routes
    app.register(tournamentsRoutes); // Add /tournaments routes
    app.register(oauthRoutes); // Add Google OAuth routes
    app.register(gamesRoutes); // Add /api/games (CLI) routes
    app.register(avatarProxyRoutes); // Add /avatar-proxy (Google avatar proxy) routes

    // Route GET to retrieve a profile by ID
    app.get('/profile/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      
      // Validate ID parameter
      const userId = validateId(id);
      if (!userId)
        return reply.code(400).send({ error: 'Invalid user ID' });
      
      const user = getUserById(userId.toString());
      if (!user)
        reply.code(404).send({ error: 'User not found' });
      else
        reply.send(user);
    });

    // Start the HTTPS server (Fastify)
    const address = await app.listen({ port: 8080, host: '0.0.0.0' }); // Start server on port 8080, all interfaces
    app.log.info(`Server started on ${address}`); // Log the server address

  // Socket.io configuration with the HTTP(S) server (WSS)
  const io = new SocketIOServer(app.server as any, {
    cors: {
      origin: ['https://localhost:3000'],
      methods: ["GET", "POST"],
      credentials: true 
    }
  });

  // Attach io to fastify so it's accessible in routes
  (app as any).io = io;

  registerSocketHandlers(io, app); // Register WebSocket event handlers (Pong, rooms, etc.)
} catch (error) {
    app.log.error(error);
    process.exit(1);
  }
})();
