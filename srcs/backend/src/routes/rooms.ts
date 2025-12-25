// API for managing rooms (creation, listing, deletion)

import { FastifyInstance } from 'fastify';
import { rooms, roomExists, addPlayerToRoom, Room, getNextRoomName } from '../socket/roomManager.js';
import { createInitialGameState } from '../../game/gameState.js';
import db from '../db.js';
import jwt from 'jsonwebtoken';
import { validateLength, sanitizeUsername, validateRoomName, validateMaxPlayers, checkRateLimit } from '../security.js';
import { parseCookies } from '../helpers/http/cookie.helper.js';

if (!process.env.JWT_SECRET)
  throw new Error('JWT_SECRET environment variable is not set');

const JWT_SECRET = process.env.JWT_SECRET;

export default async function roomsRoutes(fastify: FastifyInstance)
{
	// Create a new room
	fastify.post('/rooms', async (request, reply) => 
	{
		const clientIp = request.ip;
		if (!checkRateLimit(`room-creation:${clientIp}`, 10, 60 * 1000))
			return reply.status(429).send({ error: 'Too many rooms created. Please try again later.' });

		const { maxPlayers, roomPrefix } = request.body as { maxPlayers: number; roomPrefix?: string };
		
		if (!validateMaxPlayers(maxPlayers))
			return reply.status(400).send({ error: 'Invalid maxPlayers (must be 2 or 4)' });
		
		const prefix = roomPrefix || 'room';
		if (!validateRoomName(prefix))
			return reply.status(400).send({ error: 'Invalid room prefix' });

		let roomName;
		do {
			roomName = `${prefix}-${getNextRoomName()}`;
		} while (roomExists(roomName));

		const room = { 
			players: [], 
			maxPlayers, 
			gameState: createInitialGameState(),
			isLocalGame: prefix === 'local'
		} as any;
		rooms[roomName] = room;
		return { roomName, maxPlayers };
	});

	// List all existing rooms
	fastify.get('/rooms', async (request, reply) =>
	{
		try {
			const serializedRooms = JSON.stringify(rooms);
			return { rooms };
		} catch (error) {
			return reply.status(500).send({ error: 'Internal server error' });
		}
	});

	// Find a friend's room for spectating
	fastify.get('/rooms/friend/:username', async (request, reply) => {
		try {
			const { username } = request.params as { username: string };
			
			if (!validateLength(username, 1, 50))
				return reply.status(400).send({ error: 'Invalid username length' });
			
			const sanitizedUsername = sanitizeUsername(username);
			
			const cookies = parseCookies(request.headers['cookie'] as string | undefined);
			const jwtToken = cookies['jwt'];
			
			if (!jwtToken)
				return reply.status(401).send({ error: 'Authentication required' });
			
			let currentUserId: number;
			try {
				const payload = jwt.verify(jwtToken, JWT_SECRET) as any;
				const active = db.prepare('SELECT user_id FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
				if (!active)
					return reply.status(401).send({ error: 'Session expired or logged out' });
				currentUserId = payload.userId;
			} catch (err) {
				return reply.status(401).send({ error: 'Invalid or expired token' });
			}

			const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(sanitizedUsername);
			if (!targetUser)
				return reply.status(404).send({ error: 'User not found' });

			const friendship = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?')
				.get(currentUserId, (targetUser as any).id);
			if (!friendship)
				return reply.status(403).send({ error: 'You can only spectate friends' });

			for (const [roomName, room] of Object.entries(rooms)) {
				if (room.playerUsernames)
				{
					for (const [socketId, playerUsername] of Object.entries(room.playerUsernames))
					{
						const isActiveGame = room.players.length >= 2 && !!room.pongGame && room.pongGame.state?.running === true;
						if (playerUsername === username && room.players.includes(socketId) && isActiveGame)
						{
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
			return reply.status(500).send({ error: 'Internal server error' });
		}
	});
}
