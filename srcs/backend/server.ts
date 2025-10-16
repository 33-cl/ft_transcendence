// server.ts

import fastify, {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
 // Importe le framework Fastify (serveur HTTP)
import fastifyCors from '@fastify/cors'; // Plugin CORS pour Fastify
import fs from 'fs'; // Pour lire les fichiers SSL (clé/certificat)
import path from 'path'; // Pour gérer les chemins de fichiers
import { Server as SocketIOServer } from 'socket.io';
// Importe la classe Server du module socket.io 
// (renomee en SocketIOServer) pour le temps réel (WebSocket)

import usersRoutes from './src/routes/users.js'; // Route /users (API REST)
import roomsRoutes from './src/routes/rooms.js'; // Route /rooms (API REST)
import authRoutes from './src/routes/auth.js'; // Route /auth (inscription)
import matchesRoutes from './src/routes/matches.js'; // Route /matches (match recording)
import tournamentsRoutes from './src/routes/tournaments.js'; // Route /tournaments (tournois)
import { validateId } from './src/security.js'; // Import security helpers

import registerSocketHandlers from './src/socket/socketHandlers.js'; // Fonction pour brancher les handlers WebSocket
import { getUserById } from './src/user.js'; // Importe le getter getUserById

import fastifyCookie from '@fastify/cookie'; // Plugin Cookie pour Fastify
import fastifyMultipart from '@fastify/multipart'; // Plugin Multipart pour Fastify

// Configuration SSL pour HTTPS sécurisé
const key = fs.readFileSync('./key.pem');  // Clé privée SSL
const cert = fs.readFileSync('./cert.pem'); // Certificat SSL

// Create Fastify instance with HTTPS
const app = fastify({
  logger: true, // Active les logs Fastify
  https: {key, cert}  // Utilise la clé privée et certification SSL
});

// Function to ensure avatar directory exists
function ensureAvatarDirectory() {
  const avatarDir = path.join(process.cwd(), 'public', 'avatars');
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
    app.log.info(`📁 Avatar directory created: ${avatarDir}`);
  } else {
    app.log.info(`📁 Avatar directory exists: ${avatarDir}`);
  }
}

// Ajoutez un hook pour désactiver le cache sur toutes les réponses
app.addHook('onSend', (request, reply, payload, done) => {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  done();
});

// Fonction main asynchrone pour tout lancer
(async () => {
  try {
    // Ensure avatar directory exists before starting the server
    ensureAvatarDirectory();

    // Enregistre le plugin CORS pour Fastify
    await app.register(fastifyCors, {
      origin: true, // Autorise toutes les origines (à restreindre en prod réelle)
      credentials: true // Autorise les cookies/headers d'authentification
    });

    // Enregistre le plugin Cookie pour Fastify (nécessaire pour reply.setCookie)
    await app.register(fastifyCookie, {
      // options par défaut, peut être personnalisé si besoin
    });

    // Enregistre le plugin multipart pour l'upload d'avatar
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB au lieu de 2MB
      }
    });

    // Ensure avatar directory exists
    ensureAvatarDirectory();

    // Route GET très simple
    app.get('/', async (request, reply) => {
      return { message: 'Bienvenue sur ft_transcendence backend' }; // Répond à la racine avec un message
    });
    // Enregistre les routes
    app.register(usersRoutes); // Ajoute les routes /users
    app.register(roomsRoutes); // Ajoute les routes /rooms
    app.register(authRoutes);  // Ajoute les routes /auth
    app.register(matchesRoutes); // Ajoute les routes /matches
  app.register(tournamentsRoutes); // Ajoute les routes /tournaments

    // Route GET pour récupérer les infos d'un utilisateur
    app.get('/profile/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      
      // SECURITY: Validate ID parameter
      const userId = validateId(id);
      if (!userId) {
        return reply.code(400).send({ error: 'Invalid user ID' });
      }
      
      const user = getUserById(userId.toString());
      if (!user) {
        reply.code(404).send({ error: 'Utilisateur non trouvé' });
      } else {
        reply.send(user);
      }
    });

    // DEBUG : log le body reçu pour POST /rooms
    app.addHook('preHandler', (request, _reply, done) => {
      if (request.url.startsWith('/rooms') && request.method === 'POST') {
        app.log.info({ body: request.body }, 'POST /rooms body');
      }
      done(); // Passe au handler suivant
    });

    // Lancement du serveur HTTPS (Fastify)
    const address = await app.listen({ port: 8080, host: '0.0.0.0' }); // Démarre le serveur sur le port 8080, toutes interfaces
    app.log.info(`✅ Serveur lancé sur ${address}`); // Log l'adresse du serveur

  // Configuration de socket.io avec le serveur HTTP(S) (WSS)
  const io = new SocketIOServer(app.server as any, {
    cors: {
      origin: true, // Autorise toutes les origines (à restreindre en prod réelle)
      methods: ["GET", "POST"], // Autorise les méthodes GET et POST
      credentials: true // Autorise les cookies/headers d'authentification
    }
  });

  // Attacher io à fastify pour qu'il soit accessible dans les routes
  (app as any).io = io;

  registerSocketHandlers(io, app); // Branche les handlers d'événements WebSocket (Pong, rooms, etc.)
} catch (error) {
    app.log.error(error);
    process.exit(1);
  }
})();

// Pas de mise a jour du cache


// Plus besoin de https.createServer ni de server.listen
// (Fastify gère tout, y compris le HTTPS)