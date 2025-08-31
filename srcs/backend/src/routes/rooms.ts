// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)

import { FastifyInstance } from 'fastify';
import { rooms, roomExists, addPlayerToRoom, Room, getNextRoomName } from '../socket/roomManager.js';
import { createInitialGameState } from '../../game/gameState.js';

// Supprime le compteur local, on utilise le compteur global partagé

export default async function roomsRoutes(fastify: FastifyInstance)
{
	// Route POST /rooms : créer une nouvelle room
	fastify.post('/rooms', async (request, reply) => 
	{
		const { maxPlayers, roomPrefix } = request.body as { maxPlayers: number; roomPrefix?: string };
		if (!maxPlayers || typeof maxPlayers !== 'number')
			return reply.status(400).send({ error: 'maxPlayers needed' });

		// Génère un nom unique pour la room, incrémental et global
		// AJOUT: Utilise le préfixe pour différencier les rooms locales et multiplayer
		const prefix = roomPrefix || 'room';
		let roomName;
		do {
			roomName = `${prefix}-${getNextRoomName()}`;
		} while (roomExists(roomName));
		// Crée la room vide avec un gameState initialisé (par défaut: 2 joueurs)
		// AJOUT: Marque la room comme locale si c'est un préfixe local
		const room = { 
			players: [], 
			maxPlayers, 
			gameState: createInitialGameState(),
			isLocalGame: prefix === 'local'
		} as any;
		rooms[roomName] = room;
		return { roomName, maxPlayers };
	});

	// Route GET /rooms : lister toutes les rooms existantes
	fastify.get('/rooms', async (request, reply) =>
	{
		return { rooms };
	});

	// Route DELETE /rooms/:roomName : supprimer une room par son nom
	fastify.delete('/rooms/:roomName', async (request, reply) =>
	{
		const { roomName } = request.params as { roomName: string };
		if (!rooms[roomName])
			return reply.status(404).send({ error: 'Room not found' });
		delete rooms[roomName];
		return { success: true };
	});
}
