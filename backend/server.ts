// server.ts

import fastify from 'fastify';
import { Server } from 'socket.io';
import http from 'http';

// 1. On importe Fastify
const app = fastify({ logger: true });

// Création du serveur HTTP à partir de Fastify
const server = http.createServer(app.server);

// Configuration de socket.io avec CORS
const io = new Server(server, {
  cors: {
    origin: "http://127.0.0.1:5500",//5500 car c'est ce qui est utilise par live server
    methods: ["GET", "POST"]
  }
});

// Import des handlers socket.io + les executes 
import registerSocketHandlers from './src/socket/socketHandlers';
registerSocketHandlers(io, app);


// 2. Une route GET très simple
app.get('/', async (request, reply) => {
  return { message: 'Bienvenue sur ft_transcendence backend' };
});

//Enregistre la route depuis un fichier externe
import pingRoutes from './src/routes/ping';
import usersRoutes from './src/routes/users';
app.register(pingRoutes);
app.register(usersRoutes);

// Lancement du serveur HTTP (Fastify + socket.io)
server.listen(3000, () => {
  app.log.info(`✅ Serveur lancé sur http://localhost:3000`);
});
