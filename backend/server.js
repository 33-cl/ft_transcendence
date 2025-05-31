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

// Gestion des rooms (salles de jeu)
const rooms = {};

io.on('connection', (socket) => {
	fastify.log.info(`Client connecté : ${socket.id}`);

	// Pour l'instant, chaque joueur rejoint une room par défaut
	const defaultRoom = 'room1';
	socket.join(defaultRoom);//permet par la suite de send msg a tous les joueurs de cette room
	// Si la room n'existe pas, on la cree
	if (!rooms[defaultRoom])
	{
		rooms[defaultRoom] = { players: [] };
	}
	rooms[defaultRoom].players.push(socket.id);
	fastify.log.info(`Joueur ${socket.id} rejoint la room ${defaultRoom}`);

	socket.on('ping', (data) =>
	{
		fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
		socket.emit('pong', { message: 'Hello client!' });
	});

	// Handler pour les messages (envoyés avec socket.send)
	socket.on('message', (msg) => {
	let message;
	try {
		message = JSON.parse(msg);
	} catch (e) {
		fastify.log.warn(`Message non JSON reçu: ${msg}`);
		return;
	}
	// Validation basique, add des verif genre y >0 y < hauteur du terrain etc etc
	if (message.type === 'move')
	{
		if (typeof message.data !== 'object' || typeof message.data.y !== 'number')
		{
			fastify.log.warn(`Move invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Move reçu: y=${message.data.y}`);
		// Relayer le mouvement aux autres joueurs de la même room
		socket.to(defaultRoom).emit('message', msg);
	}
	else if (message.type === 'score')
	{
		if (typeof message.data !== 'object' || typeof message.data.left !== 'number' || typeof message.data.right !== 'number')
		{
			fastify.log.warn(`Score invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Score reçu: left=${message.data.left}, right=${message.data.right}`);
		// Relayer le score aux autres joueurs de la même room
		socket.to(defaultRoom).emit('message', msg);
	}
	else
	{
		fastify.log.warn(`Type de message inconnu: ${message.type}`);
	}
	});

	socket.on('disconnect', () =>
	{
	// Retirer le joueur de la room
	if (rooms[defaultRoom])
	{
		rooms[defaultRoom].players = rooms[defaultRoom].players.filter(id => id !== socket.id);
		fastify.log.info(`Joueur ${socket.id} quitte la room ${defaultRoom}`);
		// Si la room est vide, on peut la supprimer
		if (rooms[defaultRoom].players.length === 0)
		{
			delete rooms[defaultRoom];
		}
	}
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
