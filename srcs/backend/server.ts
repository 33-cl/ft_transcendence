// server.ts

import fastify from 'fastify';
import fs from 'fs'; // Pour lire les fichiers SSL
import { Server as SocketIOServer } from 'socket.io';
import fastifyCors from '@fastify/cors';
import pingRoutes from './src/routes/ping.js';
import usersRoutes from './src/routes/users.js';
import roomsRoutes from './src/routes/rooms.js';
import registerSocketHandlers from './src/socket/socketHandlers.js';

// Charger le certificat auto-signé généré dans le conteneur Docker
const key = fs.readFileSync('key.pem');   // Clé privée SSL
const cert = fs.readFileSync('cert.pem'); // Certificat SSL

// Création de Fastify en mode HTTPS
const app = fastify({
  logger: true,
  https: {
    key,
    cert
  }
});

// Fonction main asynchrone pour tout lancer
(async () => {
  // Enregistre le plugin CORS pour Fastify
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowed = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000"
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true
  });
  
  // On n'utilise que du JSON côté frontend, donc pas besoin de fastifyFormbody

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

  // DEBUG : log le body reçu pour POST /rooms
  app.addHook('preHandler', (req, _reply, done) => {
    if (req.url.startsWith('/rooms') && req.method === 'POST') {
      app.log.info('POST /rooms body:', req.body);
    }
    done();
  });

  // Lancement du serveur HTTPS (Fastify)
  const address = await app.listen({ port: 8080, host: '0.0.0.0' });
  app.log.info(`✅ Serveur lancé sur ${address}`);

  // Récupère le serveur HTTP(S) natif de Fastify pour Socket.IO
  // @ts-ignore
  const nativeServer = app.server;
  // Configuration de socket.io avec WSS
  const io = new SocketIOServer(nativeServer, {
    cors: {
      origin: (origin, cb) => {
        const allowed = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "https://localhost:3000",
          "https://127.0.0.1:3000"
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

// Plus besoin de https.createServer ni de server.listen
