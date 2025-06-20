/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/20 17:59:14 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';
import https from 'https';
import { PongGame } from '../../Rayan/pong.js';
import { Buffer } from 'buffer';
import { createInitialGameState } from '../../Rayan/gameState.js';

// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set<string>();

// Vérifie si le client peut rejoindre la room (nom valide et room existante)
function canJoinRoom(socket: Socket, roomName: string): boolean
{
	if (!roomName || typeof roomName !== 'string')
	{
		socket.emit('error', { error: 'roomName requested' });
		return false;
	}
	if (!roomExists(roomName))
	{
		socket.emit('error', { error: 'Room does not exist' });
		return false;
	}
	return true;
}

// Vérifie si la room est pleine
function handleRoomFull(socket: Socket, room: any, fastify: FastifyInstance): boolean
{
	if (room.players.length >= room.maxPlayers)
	{
		// Protection : refuse si la room est pleine
		socket.emit('error', { error: 'Room is full' });
		fastify.log.warn(`ROOM-FULL: ${socket.id} a tenté de rejoindre la room pleine ${room.name}`);
		return true;
	}
	return false;
}

// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance)
{
    for (const rName in rooms)
    {
        if (rooms[rName].players.includes(socket.id))
        {
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0)
            {
                fastify.log.info(`[DEBUG] Suppression de la room vide : ${rName}`);
                delete rooms[rName];
            }
            else {
                const room = rooms[rName];
                const onlyOnePlayer = room.players.length === 1;
                if (room.maxPlayers === 2 && onlyOnePlayer && room.pongGame && room.pongGame.state && room.pongGame.state.running === true) {
                    room.pongGame.stop();
                }
                // RESET COMPLET DE LA ROOM POUR TOUS LES MODES SI PARTIE TERMINEE
                const gameEnded = room.pongGame && room.pongGame.state && room.pongGame.state.running === false;
                if (gameEnded) {
                    delete room.pongGame;
                    delete room.paddleBySocket;
                    delete room.paddleInputs;
                    room.gameState = createInitialGameState();
                }
            }
        }
    }
}

// Ajoute le joueur à la room et le fait rejoindre côté socket.io
function joinPlayerToRoom(socket: Socket, roomName: string, room: any)
{
	//si le joueur n'est pas déjà dans la room, on l'ajoute
	if (!room.players.includes(socket.id))
	{
		addPlayerToRoom(roomName, socket.id);
		socket.join(roomName);
	}
    // --- Attribution automatique du contrôle paddle (1v1) ---
    if (room.maxPlayers === 2) {
        if (!room.paddleBySocket) room.paddleBySocket = {};
        // Purge les anciennes attributions de paddle (joueurs plus dans la room)
        for (const id in room.paddleBySocket) {
            if (!room.players.includes(id)) {
                delete room.paddleBySocket[id];
            }
        }
        // Attribution stricte selon l'ordre d'arrivée dans la room
        if (!(socket.id in room.paddleBySocket)) {
            if (room.players[0] === socket.id) {
                room.paddleBySocket[socket.id] = 'left';
            } else {
                room.paddleBySocket[socket.id] = 'right';
            }
        }
        socket.emit('roomJoined', { room: roomName, paddle: room.paddleBySocket[socket.id] });
        return;
    }
	// Cas générique (solo, 2v2, etc.)
	socket.emit('roomJoined', { room: roomName });
}

// Fonction principale qui enregistre tous les handlers socket.io
/**
 * Enregistre tous les handlers socket.io pour la gestion des rooms.
 * Toutes les protections (anti-zap, déjà dans la room, room pleine) sont centralisées ici côté backend.
 * Justification :
 * - Toute la logique métier de gestion de rooms doit être côté serveur (conformément au sujet).
 * - Les protections sont loguées pour audit/debug.
 * - Le frontend ne fait que demander à rejoindre une room, sans logique métier.
 */
export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
	// Tick global pour toutes les rooms avec un jeu en cours
	setInterval(() => {
		for (const [roomName, room] of Object.entries(rooms)) {
			if (room.pongGame && room.pongGame.state.running) {
                // --- Mouvement continu des paddles selon l'état des touches ---
                if (!room.paddleInputs) {
                    // Initialise l'état des touches pour chaque joueur
                    room.paddleInputs = {
                        left: { up: false, down: false },
                        right: { up: false, down: false }
                    };
                }
                // Applique le mouvement pour chaque joueur
                const speed = room.pongGame.state.paddleSpeed;
                if (room.paddleInputs.left.up) {
                    room.pongGame.state.leftPaddleY = Math.max(0, room.pongGame.state.leftPaddleY - speed);
                }
                if (room.paddleInputs.left.down) {
                    room.pongGame.state.leftPaddleY = Math.min(
                        room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight,
                        room.pongGame.state.leftPaddleY + speed
                    );
                }
                if (room.paddleInputs.right.up) {
                    room.pongGame.state.rightPaddleY = Math.max(0, room.pongGame.state.rightPaddleY - speed);
                }
                if (room.paddleInputs.right.down) {
                    room.pongGame.state.rightPaddleY = Math.min(
                        room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight,
                        room.pongGame.state.rightPaddleY + speed
                    );
                }
				// Envoie l'état du jeu à tous les clients de la room
				io.to(roomName).emit('gameState', room.pongGame.state);
			}
		}
	}, 1000 / 60); // 60 FPS

	io.on('connection', (socket: Socket) =>
	{
		// Log la connexion d'un nouveau client
		fastify.log.info(`Client connecté : ${socket.id}`);

		// Handler pour rejoindre ou créer une room selon le nombre de joueurs demandé
		// Si data.maxPlayers est fourni, on cherche/crée une room adaptée
		// Si data.roomName est fourni, on garde le comportement existant
			socket.on('joinRoom', async (data: any) =>
			{
				if (joinRoomLocks.has(socket.id)) {
					fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
					return;
				}
				joinRoomLocks.add(socket.id);
				try {
					const maxPlayers = data?.maxPlayers;
					const previousRoom = getPlayerRoom(socket.id);

					let roomName = data?.roomName;
					if (!roomName && typeof maxPlayers === 'number') {
						roomName = null;
						for (const [name, room] of Object.entries(rooms)) {
							if (room.maxPlayers === maxPlayers && room.players.length < maxPlayers) {
								roomName = name;
								break;
							}
						}
						if (!roomName) {
							// Création de la room via l'API REST (POST /rooms)
							// NOTE : Le backend s'auto-appelle ici en HTTPS pour garantir que toute création de room
							// passe par l'API REST officielle, même en interne (conformité au sujet, audit, sécurité).
							// L'option rejectUnauthorized: false permet d'accepter les certificats auto-signés.
							const postData = JSON.stringify({ maxPlayers });
							const options = {
								hostname: 'localhost',
								port: 8080,
								path: '/rooms',
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Content-Length': Buffer.byteLength(postData)
								},
								rejectUnauthorized: false // pour auto-signé en dev
							};
							roomName = await new Promise((resolve, reject) => {
								const req = https.request(options, (res: any) => {
									let data = '';
									res.on('data', (chunk: any) => { data += chunk; });
									res.on('end', () => {
										try {
											const json = JSON.parse(data);
											resolve(json.roomName);
										} catch (e) { reject(e); }
									});
								});
								req.on('error', reject);
								req.write(postData);
								req.end();
							});
						}
					}
					if (!canJoinRoom(socket, roomName)) {
						return;
					}
					const room = rooms[roomName];
					// Log l'état des rooms et du joueur lors du join
					fastify.log.info(`[DEBUG] joinRoom: socket.id=${socket.id}, previousRoom=${previousRoom}, roomName=${roomName}`);
					fastify.log.info(`[DEBUG] Rooms: ` + JSON.stringify(Object.fromEntries(Object.entries(rooms).map(([k, v]) => [k, {players: v.players, maxPlayers: v.maxPlayers, hasPongGame: !!v.pongGame, running: v.pongGame?.state?.running}]))));
					if (handleRoomFull(socket, room, fastify)) {
						return;
					}
					if (previousRoom) {
						removePlayerFromRoom(socket.id);
						socket.leave(previousRoom);
						fastify.log.info(`[DEBUG] socket.id=${socket.id} leave previousRoom=${previousRoom}`);
					}
					cleanUpPlayerRooms(socket, fastify);
					joinPlayerToRoom(socket, roomName, room);
					if (!room.pongGame && room.players.length === room.maxPlayers) {
						// Instancie et démarre le jeu Pong quand la room est pleine
						room.pongGame = new PongGame();
						room.pongGame.start();
					}
				} finally {
					joinRoomLocks.delete(socket.id);
				}
			});

		// Handler pour le ping/pong (test de connexion)
		socket.on('ping', (data: any) =>
		{
			socket.emit('pong', { message: 'Hello client!' });
		});

		// Handler pour les messages relayés dans la room
		socket.on('message', (msg: string) =>
		{
			let message: any;
			try {
				message = JSON.parse(msg);
			} catch (e) {
				return;
			}
			const playerRoom = getPlayerRoom(socket.id);
			if (!playerRoom) return;
			const room = rooms[playerRoom];
            // --- Nouvelle gestion : keydown/keyup pour paddleInputs ---
            if (!room.paddleInputs) {
                room.paddleInputs = {
                    left: { up: false, down: false },
                    right: { up: false, down: false }
                };
            }
            if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame) {
                // message.data = { player: 'left'|'right', direction: 'up'|'down' }
                const { player, direction } = message.data || {};
                // --- Sécurité : n'autoriser que le contrôle de son propre paddle (1v1) ---
                if (room.maxPlayers === 2 && room.paddleBySocket) {
                    const allowedPaddle = room.paddleBySocket[socket.id];
                    if (player !== allowedPaddle) return; // Ignore si tentative de triche
                }
                if ((player === 'left' || player === 'right') && (direction === 'up' || direction === 'down')) {
                    (room.paddleInputs![player as 'left' | 'right'][direction as 'up' | 'down']) = (message.type === 'keydown');
                }
            }
			// Ancienne gestion 'move' supprimée (plus utile)
			// Optionnel : relayer le message aux autres si besoin
			// handleMessage(socket, fastify, msg);
		});

		// Handler pour la déconnexion du client
		socket.on('disconnect', () =>
		{
			removePlayerFromRoom(socket.id);
		});

		// Handler pour quitter toutes les rooms explicitement (SPA navigation)
		socket.on('leaveAllRooms', () => {
			cleanUpPlayerRooms(socket, fastify);
			fastify.log.info(`[DEBUG] leaveAllRooms: socket.id=${socket.id}`);
		});
	});
}
