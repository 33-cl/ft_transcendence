// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)

import { FastifyInstance } from 'fastify';
import { rooms, roomExists, addPlayerToRoom, Room, getNextRoomName } from '../socket/roomManager.js';
import { createInitialGameState } from '../../game/gameState.js';
import db from '../db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

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
		try {
			console.log('GET /rooms called, rooms object keys:', Object.keys(rooms));
			console.log('GET /rooms called, rooms object values:', Object.keys(rooms).map(key => ({
				key,
				playersCount: rooms[key]?.players?.length || 0,
				maxPlayers: rooms[key]?.maxPlayers || 0
			})));
			
			// Essayer de serialiser les rooms pour voir s'il y a un problème
			const serializedRooms = JSON.stringify(rooms);
			console.log('Rooms serialized successfully, length:', serializedRooms.length);
			
			return { rooms };
		} catch (error) {
			console.error('Error in GET /rooms:', error);
			console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
			return reply.status(500).send({ error: 'Internal server error' });
		}
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

	// Route GET /rooms/friend/:username : trouver la room d'un ami pour spectate
	fastify.get('/rooms/friend/:username', async (request, reply) => {
		try {
			const { username } = request.params as { username: string };
			
			// Vérifier l'authentification via cookies (comme les autres routes)
			const cookies = parseCookies(request.headers['cookie'] as string | undefined);
			const jwtToken = cookies['jwt'];
			
			if (!jwtToken) {
				return reply.status(401).send({ error: 'Authentication required' });
			}
			
			let currentUserId: number;
			try {
				const payload = jwt.verify(jwtToken, JWT_SECRET) as any;
				const active = db.prepare('SELECT user_id FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
				if (!active) {
					return reply.status(401).send({ error: 'Session expired or logged out' });
				}
				currentUserId = payload.userId;
			} catch (err) {
				return reply.status(401).send({ error: 'Invalid or expired token' });
			}

			// Vérifier que l'utilisateur target existe et est ami
			const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
			if (!targetUser) {
				return reply.status(404).send({ error: 'User not found' });
			}

			// Vérifier l'amitié (optionnel - on peut permettre de spectate n'importe qui)
			const friendship = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?')
				.get(currentUserId, (targetUser as any).id);
			if (!friendship) {
				return reply.status(403).send({ error: 'You can only spectate friends' });
			}

			// Trouver dans quelle room se trouve cet ami
			// On cherche parmi toutes les rooms actives
			for (const [roomName, room] of Object.entries(rooms)) {
				if (room.playerUsernames) {
					// Chercher par username dans les joueurs authentifiés
					for (const [socketId, playerUsername] of Object.entries(room.playerUsernames)) {
						if (playerUsername === username && room.players.includes(socketId)) {
							return { 
								roomName, 
								maxPlayers: room.maxPlayers,
								currentPlayers: room.players.length,
								isInGame: true 
							};
						}
					}
				}
			}

			return reply.status(404).send({ error: 'Friend is not in any active game' });
		} catch (error) {
			console.error('Error finding friend room:', error);
			return reply.status(500).send({ error: 'Internal server error' });
		}
	});
}
