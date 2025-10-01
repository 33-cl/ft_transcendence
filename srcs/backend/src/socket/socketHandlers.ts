/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/08/27 04:23:36 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import https from 'https';
import { PongGame } from '../../game/PongGame.js';
import { Buffer } from 'buffer';
import { createInitialGameState } from '../../game/gameState.js';
import { PaddleSide } from '../../game/gameState.js';
import { RoomType } from '../types.js';
import { authenticateSocket, getSocketUser, removeSocketUser, isSocketAuthenticated } from './socketAuth.js';
import { updateUserStats, getUserByUsername, getUserById } from '../user.js';

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
function handleRoomFull(socket: Socket, room: RoomType, fastify: FastifyInstance): boolean
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
            if (rooms[rName].players.length === 0) {
                delete rooms[rName];
                // Suppression silencieuse de la room vide (log retiré)
            }
            else
			{
                const room = rooms[rName];
                
                // NOUVEAU : Pour les jeux locaux, on supprime toujours la room complètement
                // Cela évite le problème de double clic pour relancer une partie locale
                if (room.isLocalGame) {
                    if (room.pongGame) {
                        room.pongGame.stop();
                    }
                    // Retirer tous les joueurs de la room
                    if (io) {
                        for (const socketId of room.players) {
                            if (socketId !== socket.id && io.sockets.sockets.get(socketId)) {
                                io.sockets.sockets.get(socketId)?.leave(rName);
                            }
                        }
                    }
                    room.players = [];
                    delete rooms[rName];
                    continue;
                }
                
                // Pour les jeux non-locaux : comportement original
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
                    delete room.playerUsernames; // Clean up username mappings
					room.gameState = createInitialGameState();
                }
            }
        }
    }
}

// Ajoute le joueur à la room et le fait rejoindre côté socket.io
// Ajout : attribution dynamique des paddles pour 1v1v1v1
function assignPaddleToPlayer(room: RoomType): PaddleSide | null {
    const paddleSides: PaddleSide[] = ['A', 'B', 'C', 'D'];
    for (const side of paddleSides.slice(0, room.maxPlayers)) {
        if (!room.paddleBySocket || !Object.values(room.paddleBySocket).includes(side)) {
            return side;
        }
    }
    return null;
}

// Modifie joinPlayerToRoom pour gérer le mode 1v1v1
function joinPlayerToRoom(socket: Socket, roomName: string, room: RoomType, io?: Server)
{
    //si le joueur n'est pas déjà dans la room, on l'ajoute
    if (!room.players.includes(socket.id))
    {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    // --- Attribution automatique du contrôle paddle (1v1, 1v1v1, 2v2) ---
    // Ajout : si isLocalGame, attribuer tous les paddles au même socket
    if (room.isLocalGame) {
        if (!room.paddleBySocket) room.paddleBySocket = {};
        if (room.maxPlayers === 2) {
            room.paddleBySocket[socket.id] = ['A', 'C']; // A = gauche, C = droite 
        } else if (room.maxPlayers === 4) {
            room.paddleBySocket[socket.id] = ['A', 'B', 'C', 'D'];
        }
        // Broadcast à toute la room l'état matchmaking
        if (io) {
            for (const id of room.players) {
                const targetSocket = io.sockets.sockets.get(id);
                if (!targetSocket) continue;
                targetSocket.emit('roomJoined', {
                    room: roomName,
                    players: room.players.length,
                    maxPlayers: room.maxPlayers,
                    paddle: room.paddleBySocket[id]
                });
            }
        } else {
            socket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: room.paddleBySocket[socket.id]
            });
        }
        return;
    }
    if (room.maxPlayers === 2 || room.maxPlayers === 4)
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
			if (room.maxPlayers === 2) {
				// En mode 1v1 (local et non-local) : toujours A=gauche et C=droite
				const paddles = ['A', 'C'];
				const idx = room.players.indexOf(socket.id);
				room.paddleBySocket[socket.id] = paddles[idx] || null;
				console.log(`[BACKEND] Attribution paddle 1v1: socketId=${socket.id}, index=${idx}, paddle=${paddles[idx]}, isLocal=${room.isLocalGame}`);
			} else if (room.maxPlayers === 4) {
				// Attribution dynamique pour 1v1v1v1
				const paddle = assignPaddleToPlayer(room);
				room.paddleBySocket[socket.id] = paddle;
			}
		}
		// --- Broadcast à toute la room l'état matchmaking ---
		if (io)
		{
			for (const id of room.players)
			{
				const targetSocket = io.sockets.sockets.get(id);
				if (!targetSocket) continue;
				targetSocket.emit('roomJoined',
				{
					room: roomName,
					players: room.players.length,
					maxPlayers: room.maxPlayers,
					paddle: room.paddleBySocket[id]
				});
			}
		}
		else
		{
			socket.emit('roomJoined',
			{
				room: roomName,
				players: room.players.length,
				maxPlayers: room.maxPlayers,
				paddle: room.paddleBySocket[socket.id]
			});
		}
		return;
	}
	// Cas générique (solo, etc.)
	socket.emit('roomJoined', {
		room: roomName,
		players: room.players.length,
		maxPlayers: room.maxPlayers
	});
}

// Handler pour rejoindre ou créer une room
async function handleJoinRoom(socket: Socket, data: any, fastify: FastifyInstance, io: Server)
{
    if (joinRoomLocks.has(socket.id))
    {
        socket.emit('error', { error: 'joinRoom already in progress', code: 'JOIN_IN_PROGRESS' });
        return;
    }
    
    joinRoomLocks.add(socket.id);
    
    try
    {
        const maxPlayers = data?.maxPlayers;
        const isLocalGame = data?.isLocalGame === true;
        const enableAI = data?.enableAI === true;
        const aiDifficulty = data?.aiDifficulty || 'medium';
        const isSpectator = data?.spectator === true;
        const previousRoom = getPlayerRoom(socket.id);
        
        // Debug log pour vérifier la réception des données IA
        if (enableAI) {
            console.log(`🤖 [BACKEND] IA demandée avec difficulté: ${aiDifficulty}`);
        }
        
        // Debug log pour les spectateurs
        if (isSpectator) {
            console.log(`👁️ [BACKEND] Spectator joining room: ${data?.roomName}`);
        }
        
        if (previousRoom) {
            // Get the room object and clean up paddle assignments
            const oldRoom = rooms[previousRoom];
            if (oldRoom && oldRoom.paddleBySocket) {
                delete oldRoom.paddleBySocket[socket.id];
            }
            
            removePlayerFromRoom(socket.id);
            socket.leave(previousRoom);
        }
        
        let roomName = data?.roomName;
        
        if (!roomName && typeof maxPlayers === 'number')
        {
            roomName = null;
            // IMPORTANT: Pour les jeux locaux, on cherche/crée des rooms différentes
            // Cela évite que les rooms locales interfèrent avec le multiplayer
            for (const [name, room] of Object.entries(rooms))
            {
                if (room.maxPlayers === maxPlayers && 
                    room.players.length < maxPlayers &&
                    room.isLocalGame === isLocalGame)
                {
                    roomName = name;
                    break;
                }
            }
            
            if (!roomName)
            {
                const roomPrefix = isLocalGame ? 'local' : 'multi';
                const postData = JSON.stringify({ 
                    maxPlayers,
                    roomPrefix
                });
                
                const options = {
                    hostname: 'localhost',
                    port: 8080,
                    path: '/rooms',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    rejectUnauthorized: false // auto-signé en dev
                } as any;
                
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
                            catch (e) { 
                                reject(e); 
                            }
                        });
                    });
                    req.on('error', (err) => {
                        reject(err);
                    });
                    req.write(postData);
                    req.end();
                });
            }
        }
        if (!canJoinRoom(socket, roomName))
            return;
        const room = rooms[roomName] as RoomType;
        
        // Ajout : stocke le flag isLocalGame dans la room
        // IMPORTANT: On set le flag à la valeur actuelle, pas seulement si true
        room.isLocalGame = isLocalGame;
        
        // Gestion des spectateurs AVANT la vérification de room pleine
        // Les spectateurs peuvent rejoindre même si la room est pleine
        if (isSpectator && roomName && rooms[roomName]) {
            const room = rooms[roomName];
            
            // Empêcher le spectate sur les jeux locaux
            if (room.isLocalGame) {
                console.log(`👁️ [BACKEND] Spectator rejected: ${roomName} is a local game`);
                socket.emit('error', { error: 'Cannot spectate local games' });
                return;
            }
            
            console.log(`👁️ [BACKEND] Adding spectator to room ${roomName}`);
            console.log(`👁️ [BACKEND] Room state: players=${room.players.length}/${room.maxPlayers}, hasGame=${!!room.pongGame}, gameRunning=${room.pongGame?.state?.running}`);
            
            socket.join(roomName);
            
            // Envoyer les données de la room au spectateur sans paddle
            socket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: null, // Pas de paddle pour les spectateurs
                spectator: true
            });
            
            // Si le jeu est en cours, envoyer immédiatement l'état du jeu
            if (room.pongGame && room.pongGame.state.running) {
                console.log(`👁️ [BACKEND] Sending current game state to spectator`);
                socket.emit('gameState', room.pongGame.state);
            } else {
                console.log(`👁️ [BACKEND] No active game in room for spectator`);
            }
            
            return; // Ne pas continuer avec la logique normale de joueur
        }
        
        if (handleRoomFull(socket, room, fastify))
            return;
        if (previousRoom)
        {
            console.log(`🔄 JOIN: Removing socket ${socket.id} from previous room ${previousRoom}`);
            removePlayerFromRoom(socket.id);
            socket.leave(previousRoom);
        }
        
        // Double-check we're completely clean before proceeding
        const stillInRoom = getPlayerRoom(socket.id);
        if (stillInRoom) {
            console.log(`⚠️  JOIN: Socket ${socket.id} still in room ${stillInRoom} after cleanup. Force cleaning...`);
            removePlayerFromRoom(socket.id);
            socket.leave(stillInRoom);
        }
        
        cleanUpPlayerRooms(socket, fastify, io);
        
        joinPlayerToRoom(socket, roomName, room, io);
        
        // For online games, require authentication
        if (!isLocalGame) {
            let user = getSocketUser(socket.id);
            
            // Always try to re-authenticate from cookies to check for concurrent connections
            const freshUser = authenticateSocket(socket, fastify);
            if (freshUser && typeof freshUser === 'object') {
                user = freshUser;
            } else if (freshUser === 'USER_ALREADY_CONNECTED') {
                // User already connected elsewhere, reject this connection
                socket.emit('error', { 
                    error: 'User is already connected on another browser/tab. Please close the other connection first.',
                    code: 'USER_ALREADY_CONNECTED' 
                });
                removePlayerFromRoom(socket.id);
                socket.leave(roomName);
                return;
            }
            
            if (user) {
                if (!room.playerUsernames) room.playerUsernames = {};
                room.playerUsernames[socket.id] = user.username;
                fastify.log.info(`Socket ${socket.id} authenticated user ${user.username} added to room ${roomName}`);
            } else {
                // Reject unauthenticated sockets from joining online games
                fastify.log.warn(`Socket ${socket.id} failed authentication for online game`);
                socket.emit('error', { error: 'Authentication failed. Please login again to play online multiplayer games.' });
                removePlayerFromRoom(socket.id);
                socket.leave(roomName);
                return;
            }
        }
        
        // --- Ajout : en local, on démarre la partie immédiatement ---
        if (isLocalGame && !room.pongGame) {
            // Create game end callback for local games (no stats, just show end screen)
            const localGameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
                // Send gameFinished event to show end screen for local/AI games
                io.to(roomName).emit('gameFinished', {
                    winner,
                    loser
                });
                fastify.log.info(`[SOCKET] gameFinished envoyé pour jeu local/IA room ${roomName}: ${winner.side} beat ${loser.side} (${winner.score}-${loser.score})`);
            };
            
            room.pongGame = new PongGame(room.maxPlayers, localGameEndCallback);
            
            // Activer l'IA si demandé (mode Solo IA)
            if (enableAI && room.maxPlayers === 2) {
                room.pongGame.enableAI(aiDifficulty as 'easy' | 'medium' | 'hard');
                console.log(`🤖 [BACKEND] IA activée en mode ${aiDifficulty} pour la room ${roomName}`);
                console.log(`🎯 [BACKEND] Configuration IA appliquée:`, room.pongGame.state.aiConfig);

            }
            
            room.pongGame.start();
        }
        // --- Sinon, comportement normal ---
        else if (!room.pongGame && room.players.length === room.maxPlayers)
        {
            // Create game end callback for online multiplayer games
            const gameEndCallback = !isLocalGame ? (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
                handleGameEnd(roomName, room, winner, loser, fastify, io);
            } : undefined;
            
            room.pongGame = new PongGame(room.maxPlayers, gameEndCallback);
            room.pongGame.start();
        }
    }
    finally
    {
        joinRoomLocks.delete(socket.id);
    }
}

// Helper pour initialiser paddleInputs avec toutes les clés nécessaires
function initPaddleInputs(maxPlayers: number): Record<PaddleSide, { up: boolean; down: boolean }> {
    const inputs: any = {};
    
    if (maxPlayers === 2) {
        // Mode 1v1 : utiliser A (gauche) et C (droite)
        inputs['A'] = { up: false, down: false };
        inputs['C'] = { up: false, down: false };
    } else if (maxPlayers === 4) {
        // Mode 1v1v1v1 : utiliser A, B, C et D
        inputs['A'] = { up: false, down: false };
        inputs['B'] = { up: false, down: false };
        inputs['C'] = { up: false, down: false };
        inputs['D'] = { up: false, down: false };
    }
    
    return inputs;
}

// Handle game end for online multiplayer games
function handleGameEnd(roomName: string, room: RoomType, winner: { side: string; score: number }, loser: { side: string; score: number }, fastify: FastifyInstance, io: Server) {
    // For local games, just send the gameFinished event without processing stats
    if (room.isLocalGame) {
        // Send gameFinished event to show end screen for local/AI games
        if (room && room.players && room.players.length > 0 && typeof io !== 'undefined') {
            io.to(roomName).emit('gameFinished', {
                winner,
                loser
            });
            fastify.log.info(`[SOCKET] gameFinished envoyé pour jeu local/IA room ${roomName}: ${winner.side} beat ${loser.side} (${winner.score}-${loser.score})`);
        }
        return;
    }
    
    if (!room.playerUsernames || !room.paddleBySocket) {
        fastify.log.warn(`Game ended in room ${roomName} but missing player username data`);
        return;
    }

    let displayWinnerUsername = winner.side; // Fallback to side if no username found
    let displayLoserUsername = loser.side;   // Fallback to side if no username found

    try {
        fastify.log.info(`Game ended in room ${roomName}: Winner side=${winner.side} score=${winner.score}, Loser side=${loser.side} score=${loser.score}`);
        fastify.log.info(`PaddleBySocket mapping:`, room.paddleBySocket);
        
        // Find the socket IDs for winner and loser based on paddle sides
        let winnerSocketId: string | null = null;
        let loserSocketId: string | null = null;

        for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket)) {
            // Handle both array format (local games) and single value format (online games)
            const controlledSides = Array.isArray(paddleSide) ? paddleSide : [paddleSide];
            
            if (controlledSides.includes(winner.side)) {
                winnerSocketId = socketId;
            }
            if (controlledSides.includes(loser.side)) {
                loserSocketId = socketId;
            }
        }

        fastify.log.info(`Found: winnerSocketId=${winnerSocketId}, loserSocketId=${loserSocketId}`);

        // Get usernames for winner and loser
        const winnerUsername = winnerSocketId ? room.playerUsernames[winnerSocketId] : null;
        const loserUsername = loserSocketId ? room.playerUsernames[loserSocketId] : null;

        // Update display names if we have real usernames
        if (winnerUsername) displayWinnerUsername = winnerUsername;
        if (loserUsername) displayLoserUsername = loserUsername;

        if (winnerUsername && loserUsername) {
            // Check if same user is playing against themselves (same cookies/session)
            if (winnerUsername === loserUsername) {
                fastify.log.info(`Game ended in room ${roomName}: Same user playing against themselves - no stats recorded`);
                return;
            }
            
            // Get users from database by username
            const winnerUser = getUserByUsername(winnerUsername) as any;
            const loserUser = getUserByUsername(loserUsername) as any;
            
            if (winnerUser && loserUser) {
                // Double check with user IDs as well (extra security)
                if (winnerUser.id === loserUser.id) {
                    fastify.log.info(`Game ended in room ${roomName}: Same user ID detected - no stats recorded`);
                    return;
                }
                
                // Update user statistics using user IDs from database
                updateUserStats(winnerUser.id, loserUser.id, winner.score, loser.score, 'online');
                fastify.log.info(`Match recorded: ${winnerUsername} defeated ${loserUsername} (${winner.score}-${loser.score})`);
            } else {
                fastify.log.warn(`Could not find users in database. Winner: ${winnerUsername}, Loser: ${loserUsername}`);
            }
        } else {
            fastify.log.warn(`Could not get usernames for match result. Winner: ${winnerUsername}, Loser: ${loserUsername}`);
        }
    } catch (error) {
        fastify.log.error(`Error recording match result: ${error}`);
    }

    // Envoi de l'événement socket gameFinished à la room
	if (room && room.players && room.players.length > 0 && typeof io !== 'undefined') {
		// Obtenir tous les sockets dans la room
		const connectedSockets = Array.from(io.sockets.adapter.rooms.get(roomName) || []) as string[];
		const spectators = connectedSockets.filter(socketId => !room.players.includes(socketId));
		
		// Envoyer gameFinished aux joueurs (avec boutons rejouer/quitter)
		for (const socketId of room.players) {
			const playerSocket = io.sockets.sockets.get(socketId);
			if (playerSocket) {
				playerSocket.emit('gameFinished', {
					winner,
					loser,
					isPlayer: true
				});
			}
		}
		
		// Envoyer spectatorGameFinished aux spectateurs (avec seulement bouton quit)
		for (const socketId of spectators) {
			const spectatorSocket = io.sockets.sockets.get(socketId);
			if (spectatorSocket) {
				spectatorSocket.emit('spectatorGameFinished', {
					winner: {
						...winner,
						username: displayWinnerUsername
					},
					loser: {
						...loser,
						username: displayLoserUsername
					},
					isSpectator: true
				});
			}
		}
		
		fastify.log.info(`[SOCKET] gameFinished envoyé à ${room.players.length} joueurs et spectatorGameFinished à ${spectators.length} spectateurs dans room ${roomName}`);
	}
	
}

// Tick global pour toutes les rooms avec un jeu en cours (adapté pour paddles dynamiques)
function handleGameTick(io: any, fastify: FastifyInstance)
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        const typedRoom = room as RoomType; // Cast pour éviter l'erreur TS2339
        if (typedRoom.pongGame && typedRoom.pongGame.state.running)
        {
            // Initialise l'état des touches pour chaque paddle si besoin
            if (!typedRoom.paddleInputs) {
                typedRoom.paddleInputs = initPaddleInputs(typedRoom.maxPlayers);
            }
            // Applique le mouvement pour chaque paddle
            const speed = typedRoom.pongGame.state.paddleSpeed;
            for (const paddle of typedRoom.pongGame.state.paddles) {
                const input = typedRoom.paddleInputs[paddle.side];
                if (!input) continue;
                
                // Paddle B et D horizontaux : bougent sur l'axe X
                if (paddle.side === 'B' || paddle.side === 'D') {
                    if (input.up) // up = gauche pour paddle horizontal
                        paddle.x = Math.max(0, paddle.x - speed);
                    if (input.down) // down = droite pour paddle horizontal
                        paddle.x = Math.min(typedRoom.pongGame.state.canvasWidth - paddle.width, paddle.x + speed);
                } else {
                    // Paddles A et C verticaux : bougent sur l'axe Y
                    if (input.up)
                        paddle.y = Math.max(0, paddle.y - speed);
                    if (input.down)
                        paddle.y = Math.min(typedRoom.pongGame.state.canvasHeight - paddle.height, paddle.y + speed);
                }
            }
            
            // Log pour debug spectateurs - seulement de temps en temps pour éviter le spam
            const now = Date.now();
            if (!(typedRoom as any)._lastSpectatorLog || now - (typedRoom as any)._lastSpectatorLog > 5000) {
                const connectedSockets = Array.from(io.sockets.adapter.rooms.get(roomName) || []) as string[];
                const spectators = connectedSockets.filter(socketId => !typedRoom.players.includes(socketId));
                if (spectators.length > 0) {
                    console.log(`👁️ [BACKEND] Room ${roomName}: ${typedRoom.players.length} players, ${spectators.length} spectators, emitting gameState`);
                }
                (typedRoom as any)._lastSpectatorLog = now;
            }
            
            io.to(roomName).emit('gameState', typedRoom.pongGame.state);
        }
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false)
        {
            // Nettoyage de la room après la fin du jeu
            // Les statistiques sont déjà gérées par le callback handleGameEnd
            for (const socketId of typedRoom.players)
            {
                if (io.sockets.sockets.get(socketId))
                    io.sockets.sockets.get(socketId)?.leave(roomName);
            }
            typedRoom.players = [];
            delete rooms[roomName];
        }
    }
}

// Handler pour les messages relayés dans la room (adapté pour paddleInputs dynamiques)
function handleSocketMessage(socket: Socket, msg: string)
{
    let message: any;
    try {
        message = JSON.parse(msg);
    } catch (e) { return; }
    
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;
    const room = rooms[playerRoom] as RoomType;
    if (!room.paddleInputs) {
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
    }
    // Ajout : en local, le client peut contrôler tous les paddles
    if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame && room.paddleBySocket) {
        const { player, direction } = message.data || {};
        const allowedPaddle = room.paddleBySocket[socket.id];
        if (room.isLocalGame) {
            let mappedPlayer = player;
            if (player === 'left') mappedPlayer = 'A';
            else if (player === 'right') mappedPlayer = 'C';
            
            if (Array.isArray(allowedPaddle) && allowedPaddle.includes(mappedPlayer)) {
                console.log(`[BACKEND] Paddle autorisé, traitement de ${mappedPlayer} ${direction}`);
                if ((mappedPlayer === 'A' || mappedPlayer === 'B' || mappedPlayer === 'C' || mappedPlayer === 'D' || mappedPlayer === 'left' || mappedPlayer === 'right') && (direction === 'up' || direction === 'down')) {
                    room.paddleInputs[mappedPlayer as PaddleSide][direction as 'up' | 'down'] = (message.type === 'keydown');
                    if (message.type === 'keydown') {
                        try {
                            room.pongGame.movePaddle(mappedPlayer, direction);
                        } catch (error) {
                            // Log supprimé pour améliorer les performances
                        }
                    }
                }
            }
        } else {
            if (player !== allowedPaddle) return;
            if ((player === 'A' || player === 'B' || player === 'C' || player === 'D') && (direction === 'up' || direction === 'down')) {
                room.paddleInputs[player as PaddleSide][direction as 'up' | 'down'] = (message.type === 'keydown');
                if (message.type === 'keydown') {
                    room.pongGame.movePaddle(player, direction);
                }
            }
        }
    }
}

// Handler pour la déconnexion du client
function handleSocketDisconnect(socket: Socket)
{
    removePlayerFromRoom(socket.id);
    // Nettoyer l'authentification du socket
    removeSocketUser(socket.id);
}

// Handler pour quitter toutes les rooms explicitement (SPA navigation)
function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server)
{
    // CRITICAL FIX: Remove any pending join room locks immediately
    if (joinRoomLocks.has(socket.id)) {
        joinRoomLocks.delete(socket.id);
    }
    
    const previousRoom = getPlayerRoom(socket.id);
    if (previousRoom) {
        // Get the room object and clean up paddle assignments
        const room = rooms[previousRoom];
        if (room && room.paddleBySocket) {
            delete room.paddleBySocket[socket.id];
        }
        
        // Remove from room manager
        removePlayerFromRoom(socket.id);
        // Leave socket.io room
        socket.leave(previousRoom);
    }
    
    // Force additional cleanup
    cleanUpPlayerRooms(socket, fastify, io);
    
    // Triple-check cleanup was successful and force removal if needed
    const roomAfterCleanup = getPlayerRoom(socket.id);
    if (roomAfterCleanup) {
        // Get the room object and clean up paddle assignments
        const room = rooms[roomAfterCleanup];
        if (room && room.paddleBySocket) {
            delete room.paddleBySocket[socket.id];
        }
        
        // Force remove from room manager
        removePlayerFromRoom(socket.id);
        // Also force leave the socket.io room
        socket.leave(roomAfterCleanup);
    }
    
    // Emit confirmation that cleanup is complete
    socket.emit('leaveAllRoomsComplete', { status: 'success' }); 
}

// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
    // Tick rate à 120 FPS pour un gameplay fluide
    setInterval(() =>
	{
        handleGameTick(io, fastify);
    }, 1000 / 60);

    io.on('connection', (socket: Socket) =>
	{
        fastify.log.info(`Client connecté : ${socket.id}`);
        
        // Authentifier le socket à la connexion
        const user = authenticateSocket(socket, fastify);
        if (user && typeof user === 'object') {
            fastify.log.info(`Socket ${socket.id} authentifié pour l'utilisateur ${user.username} (${user.id})`);
        } else if (user === 'USER_ALREADY_CONNECTED') {
            // Utilisateur déjà connecté ailleurs
            socket.emit('error', { 
                error: 'User is already connected on another browser/tab. Please close other connections first.', 
                code: 'USER_ALREADY_CONNECTED' 
            });
            socket.disconnect(true);
            return;
        } else {
            // Pour les connexions non authentifiées, permettre quand même la connexion (jeux locaux)
            fastify.log.warn(`Socket ${socket.id} non authentifié - connexion autorisée pour jeux locaux`);
        }
        
        socket.on('joinRoom', (data: any) => handleJoinRoom(socket, data, fastify, io));
        socket.on('ping', () => socket.emit('pong', { message: 'Hello client!' }));
        socket.on('message', (msg: string) => handleSocketMessage(socket, msg));
        socket.on('disconnect', () => handleSocketDisconnect(socket));
        socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
    });
}
