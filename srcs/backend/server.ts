// server.ts

import fastify, {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
 // Importe le framework Fastify (serveur HTTP)
import fastifyCors from '@fastify/cors'; // Plugin CORS pour Fastify
import fs from 'fs'; // Pour lire les fichiers SSL (clé/certificat)
import { Server as SocketIOServer } from 'socket.io';
// Importe la classe Server du module socket.io 
// (renomee en SocketIOServer) pour le temps réel (WebSocket)

import usersRoutes from './src/routes/users.js'; // Route /users (API REST)
import roomsRoutes from './src/routes/rooms.js'; // Route /rooms (API REST)

import registerSocketHandlers from './src/socket/socketHandlers.js'; // Fonction pour brancher les handlers WebSocket

// Charger le certificat auto-signé généré dans le conteneur Docker
const key = fs.readFileSync('key.pem');   // Lit la clé privée SSL depuis le fichier
const cert = fs.readFileSync('cert.pem'); // Lit le certificat SSL depuis le fichier

// Création de Fastify en mode HTTPS
const app = fastify({
  logger: true, // Active les logs Fastify
  https: {key, cert}  // Utilise la clé privée et certification SSL
});

// Fonction main asynchrone pour tout lancer
(async () => {
  try {
    // Enregistre le plugin CORS pour Fastify
    await app.register(fastifyCors, {
      origin: true, // Autorise toutes les origines (à restreindre en prod réelle)
      credentials: true // Autorise les cookies/headers d'authentification
    });

    // Route GET très simple
    app.get('/', async (request, reply) => {
      return { message: 'Bienvenue sur ft_transcendence backend' }; // Répond à la racine avec un message
    });
    // Enregistre les routes
    app.register(usersRoutes); // Ajoute les routes /users
    app.register(roomsRoutes); // Ajoute les routes /rooms

    // DEBUG : log le body reçu pour POST /rooms
    app.addHook('preHandler', (request, _reply, done) => {
      if (request.url.startsWith('/rooms') && request.method === 'POST') {
        app.log.info('POST /rooms body:', request.body); // Log le body de la requête POST /rooms
      }
      done(); // Passe au handler suivant
    });

    // Lancement du serveur HTTPS (Fastify)
    const address = await app.listen({ port: 8080, host: '0.0.0.0' }); // Démarre le serveur sur le port 8080, toutes interfaces
    app.log.info(`✅ Serveur lancé sur ${address}`); // Log l'adresse du serveur

  // Configuration de socket.io avec le serveur HTTP(S) (WSS)
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: true, // Autorise toutes les origines (à restreindre en prod réelle)
      methods: ["GET", "POST"], // Autorise les méthodes GET et POST
      credentials: true // Autorise les cookies/headers d'authentification
    }
  });

  registerSocketHandlers(io, app); // Branche les handlers d'événements WebSocket (Pong, rooms, etc.)
} catch (error) {
    app.log.error(error);
    process.exit(1);
  }
})();

// Plus besoin de https.createServer ni de server.listen
// (Fastify gère tout, y compris le HTTPS)