// server.js

// 1. On importe Fastify
const fastify = require('fastify')({ logger: true });

// Ajout de socket.io
const { Server } = require('socket.io');
const http = require('http');

// Création du serveur HTTP à partir de Fastify
const server = http.createServer(fastify.server);

// Configuration de socket.io avec CORS
const io = new Server(server, {
  cors: {
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST"]
  }
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  fastify.log.info(`Client connecté : ${socket.id}`);
  socket.on('ping', (data) => {
    fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
    socket.emit('pong', { message: 'Hello client!' });
  });
});

// 2. Une route GET très simple
fastify.get('/', async (request, reply) => {
  return { message: 'Bienvenue sur ft_transcendence backend' };
});

//Enregistre la route depuis un fichier externe
fastify.register(require('./src/routes/ping'));
fastify.register(require('./src/routes/users'));

// Lancement du serveur HTTP (Fastify + socket.io)
server.listen(3000, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`✅ Serveur lancé sur http://localhost:3000`);
});
