// server.ts

import fastify from 'fastify';
import { Server } from 'socket.io';
import fastifyCors from '@fastify/cors';
import pingRoutes from './src/routes/ping.js';
import usersRoutes from './src/routes/users.js';
import roomsRoutes from './src/routes/rooms.js';
import registerSocketHandlers from './src/socket/socketHandlers.js';

// Création de Fastify
const app = fastify({ logger: true });

// Fonction main asynchrone pour tout lancer
(async () => {
  // Enregistre le plugin CORS pour Fastify
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowed = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true
  });

  // Route GET très simple
  app.get('/', async (request, reply) => {
    return { message: 'Bienvenue sur ft_transcendence backend' };
  });

  // Route de test
  app.get('/test', async (request, reply) => {
    return { ok: true };
  });

  // Enregistre les routes
  app.register(pingRoutes);
  app.register(usersRoutes);
  app.register(roomsRoutes);

  // Lancement du serveur HTTP (Fastify + socket.io)
  const address = await app.listen({ port: 8080, host: '0.0.0.0' });
  app.log.info(`✅ Serveur lancé sur ${address}`);

  // Récupère le serveur HTTP natif de Fastify
  const server = app.server;
  // Configuration de socket.io avec CORS
  const io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        const allowed = [
          "http://localhost:3000",
          "http://127.0.0.1:3000"
        ];
        if (!origin || allowed.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error("Not allowed by CORS"), false);
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  registerSocketHandlers(io, app);
})();
