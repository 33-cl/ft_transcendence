// server.ts

import fastify from 'fastify';
import { Server } from 'socket.io';
import http from 'http';
import fastifyCors from '@fastify/cors';

// 1. On importe Fastify
const app = fastify({ logger: true });

// Enregistre le plugin CORS pour Fastify
//definit qui peut acceder au serveur via le navigateur
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

// Création du serveur HTTP à partir de Fastify
const server = http.createServer(app.server);

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

// Import des handlers socket.io + les executes 
import registerSocketHandlers from './src/socket/socketHandlers.js';
registerSocketHandlers(io, app);


// 2. Une route GET très simple
app.get('/', async (request, reply) => {
  return { message: 'Bienvenue sur ft_transcendence backend' };
});

//Enregistre la route depuis un fichier externe
import pingRoutes from './src/routes/ping.js';
import usersRoutes from './src/routes/users.js';
app.register(pingRoutes);
app.register(usersRoutes);

// Lancement du serveur HTTP (Fastify + socket.io)
server.listen(8080, () => {
  app.log.info(`✅ Serveur lancé sur http://localhost:8080`);
});
