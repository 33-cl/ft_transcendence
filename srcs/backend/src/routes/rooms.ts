// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)

import { FastifyInstance } from 'fastify';
import { rooms, roomExists, addPlayerToRoom, Room } from '../socket/roomManager';

// Compteur local pour générer des noms uniques de room
let localRoomCounter = 1;

export default async function roomsRoutes(fastify: FastifyInstance)
{
	// Route POST /rooms : créer une nouvelle room
	fastify.post('/rooms', async (request, reply) => 
	{
		const { maxPlayers } = request.body as { maxPlayers: number };
		if (!maxPlayers || typeof maxPlayers !== 'number')
			return reply.status(400).send({ error: 'maxPlayers needed' });

		// Génère un nom unique pour la room
		let roomName;
		do {
			roomName = `room${localRoomCounter++}`;
		} while (roomExists(roomName));
		// Crée la room vide
		rooms[roomName] = { players: [], maxPlayers };
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

	// Route GET /ping : test de vie du backend
	fastify.get('/ping', async (request, reply) => {
		return { message: 'pong' };
	});
}
