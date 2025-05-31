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

// Nouvelle structure pour les rooms avec capacité dynamique
const rooms = {};
let roomCounter = 1;// ++ quand on rajoute une room pour avoir un id propre a chaque room

io.on('connection', (socket) => {
  fastify.log.info(`Client connecté : ${socket.id}`);

	// Handler pour rejoindre une room dynamiquement
	socket.on('joinRoom', (data) => {
	//4 ou 2 players dans la room
	const maxPlayers = data && data.maxPlayers ? data.maxPlayers : 2;
	let assignedRoom = null;
	//itere sur les rooms existantes
	for (const roomName in rooms)
	{
		//cherche une room avec la capacitee demandeee (2 ou 4)
		if (rooms[roomName].maxPlayers === maxPlayers && rooms[roomName].players.length < maxPlayers)
		{
			//il reste de la place dans cette room
			fastify.log.info(`Room trouvée : ${roomName} (max ${maxPlayers})`);
			//on rejoint la room
			assignedRoom = roomName;
			break;
		}
	}
	//aucune room existante ne repond a la demande, on en cree une nouvelle
	if (!assignedRoom)
	{
		//donne un nom unique a la nouvelle room
		assignedRoom = `room${roomCounter++}`;
		rooms[assignedRoom] = { players: [], maxPlayers };
	}
	socket.join(assignedRoom);
	rooms[assignedRoom].players.push(socket.id);
	fastify.log.info(`Joueur ${socket.id} rejoint la room ${assignedRoom} (max ${maxPlayers})`);
	// On informe le client de la room rejointe
	socket.emit('roomJoined', { room: assignedRoom, maxPlayers });
	});

	socket.on('ping', (data) => {
	fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
	socket.emit('pong', { message: 'Hello client!' });
	});

	// Handler pour les messages (envoyes avec socket.send)
	socket.on('message', (msg) => {
	let message;
	try {
		message = JSON.parse(msg);
	} catch (e) {
		fastify.log.warn(`Message non JSON reçu: ${msg}`);
		return;
	}
	// Trouver la room du joueur pour pouvoir ensuite utilisr playerRoom pour l'eenvoi de messages
	let playerRoom = null;
	for (const roomName in rooms)
	{
		if (rooms[roomName].players.includes(socket.id))
		{
			playerRoom = roomName;
			break;
		}
	}
	if (!playerRoom)
	{
		fastify.log.warn(`Aucune room trouvée pour le joueur ${socket.id}`);
		return;
	}
	// Validation basique
	if (message.type === 'move')
	{
		if (typeof message.data !== 'object' || typeof message.data.y !== 'number')
		{
			fastify.log.warn(`Move invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Move reçu: y=${message.data.y}`);
		socket.to(playerRoom).emit('message', msg);
	}
	else if (message.type === 'score')
	{
		if (typeof message.data !== 'object' || typeof message.data.left !== 'number' || typeof message.data.right !== 'number')
		{
			fastify.log.warn(`Score invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Score reçu: left=${message.data.left}, right=${message.data.right}`);
		socket.to(playerRoom).emit('message', msg);
	}
	else
	{
		fastify.log.warn(`Type de message inconnu: ${message.type}`);
	}
	});

	socket.on('disconnect', () => {
	// Retirer le joueur de sa room
	let playerRoom = null;
	for (const roomName in rooms)
	{
		if (rooms[roomName].players.includes(socket.id))
		{
			playerRoom = roomName;
			break;
		}
	}
	if (playerRoom)
	{
		rooms[playerRoom].players = rooms[playerRoom].players.filter(id => id !== socket.id);
		fastify.log.info(`Joueur ${socket.id} quitte la room ${playerRoom}`);
		if (rooms[playerRoom].players.length === 0)
		{
			delete rooms[playerRoom];
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
