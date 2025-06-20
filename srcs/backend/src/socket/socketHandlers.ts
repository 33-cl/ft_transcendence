/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/20 20:29:07 by qordoux          ###   ########.fr       */
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
function canJoinRoom(socket: Socket, roomName: string): boolean {
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
		return true;
	}
	return false;
}

// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance, io?: Server) {
    for (const rName in rooms)
    {
        if (rooms[rName].players.includes(socket.id))
        {
			// room actuelle = room actuelle - client actuel
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0)
                delete rooms[rName];
            else
			{
                const room = rooms[rName];
                // Si la partie est en cours, on stoppe et on supprime la room (ranked)
                if (room.pongGame && room.pongGame.state && room.pongGame.state.running === true)
				{
                    room.pongGame.stop();
                    // On retire tous les joueurs restants via leurs socket et on supprime la room
                    if (io)
					{
                        for (const socketId of room.players)
						{
							//ne pas retirer le client actu c deja fait
                            if (socketId !== socket.id && io.sockets.sockets.get(socketId))
							{
                                io.sockets.sockets.get(socketId)?.leave(rName);
                            }
                        }
                    }
                    room.players = [];
                    delete rooms[rName];
                    break;
                }
                // RESET COMPLET DE LA ROOM, la remettre a 0 
                const gameEnded = room.pongGame && room.pongGame.state && room.pongGame.state.running === false;
                if (gameEnded)
				{
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
	if (room.maxPlayers === 2)
	{
		if (!room.paddleBySocket) room.paddleBySocket = {};
		// Purge les anciennes attributions de paddle (joueurs plus dans la room)
		for (const id in room.paddleBySocket)
		{
			if (!room.players.includes(id))
				delete room.paddleBySocket[id];
		}
		// Attribution stricte selon l'ordre d'arrivée dans la room
		if (!(socket.id in room.paddleBySocket))
		{
			if (room.players[0] === socket.id)
				room.paddleBySocket[socket.id] = 'left';
			else
				room.paddleBySocket[socket.id] = 'right';
		}
		socket.emit('roomJoined', { room: roomName, paddle: room.paddleBySocket[socket.id] });
		return;
	}
	// Cas générique (solo, 2v2, etc.)
	socket.emit('roomJoined', { room: roomName });
}

// Handler pour rejoindre ou créer une room
async function handleJoinRoom(socket: Socket, data: any, fastify: FastifyInstance, io: Server)
{
	if (joinRoomLocks.has(socket.id))
	{
		fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
		return;
	}
	joinRoomLocks.add(socket.id);
	try
	{
		const maxPlayers = data?.maxPlayers;
		const previousRoom = getPlayerRoom(socket.id);
		let roomName = data?.roomName;
		if (!roomName && typeof maxPlayers === 'number')
		{
			roomName = null;
			for (const [name, room] of Object.entries(rooms))
			{
				if (room.maxPlayers === maxPlayers && room.players.length < maxPlayers)
				{
					roomName = name;
					break;
				}
			}
			if (!roomName)
			{
				// Création de la room via l'API REST (POST /rooms)
				// NOTE : Le backend s'auto-appelle ici en HTTPS pour garantir que toute création de room
				// passe par l'API REST
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
				roomName = await new Promise((resolve, reject) =>
				{
					const req = https.request(options, (res: any) =>
					{
						let data = '';
						res.on('data', (chunk: any) => { data += chunk; });
						res.on('end', () =>
						{
							try
							{
								const json = JSON.parse(data);
								resolve(json.roomName);
							}
							catch (e) { reject(e); }
						});
					});
					req.on('error', reject);
					req.write(postData);
					req.end();
				});
			}
		}
		if (!canJoinRoom(socket, roomName))
			return;
		const room = rooms[roomName];
		// Log l'état des rooms et du joueur lors du join
		if (handleRoomFull(socket, room, fastify))
			return;
		if (previousRoom)
		{
			removePlayerFromRoom(socket.id);
			socket.leave(previousRoom);
			fastify.log.info(`[DEBUG] socket.id=${socket.id} leave previousRoom=${previousRoom}`);
		}
		cleanUpPlayerRooms(socket, fastify, io);
		joinPlayerToRoom(socket, roomName, room);
		if (!room.pongGame && room.players.length === room.maxPlayers)
		{
			// Instancie et démarre le jeu Pong quand la room est pleine
			room.pongGame = new PongGame();
			room.pongGame.start();
		}
	}
	finally
	{
		joinRoomLocks.delete(socket.id);
	}
}

// Tick global pour toutes les rooms avec un jeu en cours
function handleGameTick(io: Server)
{
	// Parcourt toutes les rooms existantes du serveur :
	// - roomName : nom de la room (string)
	// - room : objet contenant l'état et les joueurs de la room
	// donc a chaque iteration on a acces aux nom + objet, .entries trasnforme l'objet en tableau de paire [key, value]
	for (const [roomName, room] of Object.entries(rooms))
	{
		if (room.pongGame && room.pongGame.state.running)
		{
			// --- Mouvement continu des paddles selon l'état des touches ---
			if (!room.paddleInputs)
			{
				// Initialise l'état des touches pour chaque joueur
				room.paddleInputs = {
					left: { up: false, down: false },
					right: { up: false, down: false }
				};
			}
			// Applique le mouvement pour chaque joueur
			const speed = room.pongGame.state.paddleSpeed;
			if (room.paddleInputs.left.up)
				room.pongGame.state.leftPaddleY = Math.max(0, room.pongGame.state.leftPaddleY - speed);
			if (room.paddleInputs.left.down)
				room.pongGame.state.leftPaddleY = Math.min( room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight, room.pongGame.state.leftPaddleY + speed);
			if (room.paddleInputs.right.up)
				room.pongGame.state.rightPaddleY = Math.max(0, room.pongGame.state.rightPaddleY - speed);
			if (room.paddleInputs.right.down)
				room.pongGame.state.rightPaddleY = Math.min(room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight,room.pongGame.state.rightPaddleY + speed);
			// Envoie l'état du jeu à tous les clients de la room
			io.to(roomName).emit('gameState', room.pongGame.state);
		}
		// --- NETTOYAGE AUTO DES ROOMS FINIES (ranked) ---
		if (room.pongGame && room.pongGame.state.running === false)
		{
			// On retire tous les joueurs et on supprime la room
			for (const socketId of room.players)
			{
				if (io.sockets.sockets.get(socketId))
					io.sockets.sockets.get(socketId)?.leave(roomName);
			}
			room.players = [];
			delete rooms[roomName];
		}
	}
}

// Handler pour les messages relayés dans la room
function handleSocketMessage(socket: Socket, msg: string)
{
	let message: any;
	try
	{
		message = JSON.parse(msg);
	}
	catch (e)
	{
		return;
	}
	const playerRoom = getPlayerRoom(socket.id);
	if (!playerRoom)
		return;
	const room = rooms[playerRoom];
	// --- Nouvelle gestion : keydown/keyup pour paddleInputs ---
	if (!room.paddleInputs)
	{
		room.paddleInputs = {
			left: { up: false, down: false },
			right: { up: false, down: false }
		};
	}
	if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame)
	{
		// message.data = { player: 'left'|'right', direction: 'up'|'down' }
		const { player, direction } = message.data || {};
		// --- Sécurité : n'autoriser que le contrôle de son propre paddle (1v1) ---
		if (room.maxPlayers === 2 && room.paddleBySocket)
		{
			const allowedPaddle = room.paddleBySocket[socket.id];
			if (player !== allowedPaddle)
				return; // Ignore si tentative de triche
		}
		if ((player === 'left' || player === 'right') && (direction === 'up' || direction === 'down'))
			(room.paddleInputs![player as 'left' | 'right'][direction as 'up' | 'down']) = (message.type === 'keydown');
	}
}

// Handler pour la déconnexion du client
function handleSocketDisconnect(socket: Socket)
{
    removePlayerFromRoom(socket.id);
}

// Handler pour quitter toutes les rooms explicitement (SPA navigation)
function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server)
{
    cleanUpPlayerRooms(socket, fastify, io);
}

// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
    setInterval(() =>
	{
        handleGameTick(io);
    }, 1000 / 60);

    io.on('connection', (socket: Socket) =>
	{
        fastify.log.info(`Client connecté : ${socket.id}`);

        socket.on('joinRoom', (data: any) => handleJoinRoom(socket, data, fastify, io));
        socket.on('ping', () => socket.emit('pong', { message: 'Hello client!' }));
        socket.on('message', (msg: string) => handleSocketMessage(socket, msg));
        socket.on('disconnect', () => handleSocketDisconnect(socket));
        socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
    });
}
