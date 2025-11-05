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
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms, createRoom } from './roomManager.js';
import { PongGame } from '../../game/PongGame.js';
import { createInitialGameState } from '../../game/gameState.js';
import { PaddleSide } from '../../game/gameState.js';
import { RoomType } from '../types.js';
import { authenticateSocket, getSocketUser, removeSocketUser, isSocketAuthenticated, getSocketIdForUser } from './socketAuth.js';
import { updateUserStats, getUserByUsername, getUserById } from '../user.js';
import db from '../db.js';
import { notifyFriendAdded, notifyFriendRemoved, notifyProfileUpdated, broadcastUserStatusChange } from './notificationHandlers.js';
import { 
    removePlayerFromRoomPlayers, 
    deleteLocalGameRoom, 
    deleteActiveGameRoom,
    isGameRunning
    // isGameEnded,      // Décommenter si besoin de tester le reset des jeux terminés
    // resetFinishedGameRoom  // Décommenter si besoin de tester le reset des jeux terminés
} from './utils/roomCleanup.js';
import {
    assignAllPaddlesToSocket,
    purgeOldPaddleAssignments,
    assignPaddleByArrivalOrder,
    broadcastRoomState
} from './utils/playerJoining.js';
import {
    parseJoinRoomData,
    cleanupPreviousRoom,
    findOrCreateRoom,
    handleSpectatorJoin,
    authenticateOnlinePlayer,
    notifyFriendsGameStarted,
    startLocalGame,
    startOnlineGame
} from './utils/roomJoining.js';

// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set<string>();

// Global io instance for use in other modules
let globalIo: Server | null = null;

// Export a function to get the global io instance
export function getGlobalIo(): Server | null
{
    return globalIo;
}

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
function handleRoomFull(socket: Socket, room: RoomType, fastify: FastifyInstance): boolean
{
	if (room.players.length >= room.maxPlayers)
	{
		socket.emit('error', { error: 'Room is full' });
		return true;
	}
	return false;
}

// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance, io: Server)
{
    for (const rName in rooms)
    {
        if (rooms[rName].players.includes(socket.id))
        {
            const room = rooms[rName];
            
            const roomIsEmpty = removePlayerFromRoomPlayers(room, socket.id);
            
            if (roomIsEmpty)
            {
                delete rooms[rName];
                continue;
            }
            
            if (room.isLocalGame)
            {
                deleteLocalGameRoom(room);
                delete rooms[rName];
                continue;
            }
            
            // Pour les jeux non-locaux : comportement original
            // Si la partie est en cours, on stoppe et on supprime la room (ranked)
            if (isGameRunning(room))
            {
                deleteActiveGameRoom(room, rName, socket.id, io);
                delete rooms[rName];
                break;
            }
        }
    }
}

function joinPlayerToRoom(socket: Socket, roomName: string, room: RoomType, io: Server)
{
    if (!room.players.includes(socket.id))
    {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    
    if (room.isLocalGame)
    {
        assignAllPaddlesToSocket(room, socket.id);
        broadcastRoomState(room, roomName, io);
        return;
    }
    
    if (room.maxPlayers === 2 || room.maxPlayers === 4)
    {
        if (!room.paddleBySocket)
            room.paddleBySocket = {};
        
        purgeOldPaddleAssignments(room);
        assignPaddleByArrivalOrder(room, socket.id);
        broadcastRoomState(room, roomName, io);
        return;
    }
}

// Handler pour rejoindre ou créer une room
async function handleJoinRoom(socket: Socket, data: any, fastify: FastifyInstance, io: Server)
{
    // empeche de join plusieurs fois en meme temps
    if (joinRoomLocks.has(socket.id))
    {
        socket.emit('error', { error: 'joinRoom already in progress', code: 'JOIN_IN_PROGRESS' });
        return;
    }
    
    joinRoomLocks.add(socket.id);
    
    try
    {
        const params = parseJoinRoomData(data);
        //a cause des op asynchrones on fait le cleanup si jamais on est deja dans une room
        cleanupPreviousRoom(socket);

        const roomName = findOrCreateRoom(params);
        
        if (!canJoinRoom(socket, roomName))
            return;
        
        const room = rooms[roomName] as RoomType;
        room.isLocalGame = params.isLocalGame;
        
        if (params.isSpectator && roomName && rooms[roomName])
        {
            handleSpectatorJoin(socket, roomName, room);
            return;
        }
        
        if (handleRoomFull(socket, room, fastify))
            return;
        
        joinPlayerToRoom(socket, roomName, room, io);
        
        if (!params.isLocalGame)
        {
            const user = authenticateOnlinePlayer(socket, roomName, room, fastify);
            if (!user) return; // Authentication failed
            
            // Notifier les amis quand la room est pleine
            notifyFriendsGameStarted(room, fastify, broadcastUserStatusChange, globalIo);
        }
        
        // === ÉTAPE 10 : DÉMARRAGE DU JEU ===
        if (params.isLocalGame && !room.pongGame)
            startLocalGame(room, roomName, params, io, fastify);
        else if (!room.pongGame && room.players.length === room.maxPlayers)
            startOnlineGame(room, roomName, handleGameEnd, fastify, io);
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
            // Déterminer si c'est un jeu IA en vérifiant si l'IA est activée
            const isAIGame = room.pongGame?.state?.aiConfig?.enabled || false;
            io.to(roomName).emit('gameFinished', {
                winner,
                loser,
                mode: isAIGame ? 'ai' : 'local' // Indiquer le mode pour l'affichage côté frontend
            });
            fastify.log.info(`[SOCKET] gameFinished envoyé pour jeu ${isAIGame ? 'IA' : 'local'} room ${roomName}: ${winner.side} beat ${loser.side} (${winner.score}-${loser.score})`);
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

        // Get usernames for winner and loser from active players
        const winnerUsername = winnerSocketId ? room.playerUsernames?.[winnerSocketId] : null;
        const loserUsername = loserSocketId ? room.playerUsernames?.[loserSocketId] : null;

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
					winner: {
						...winner,
						username: displayWinnerUsername
					},
					loser: {
						...loser,
						username: displayLoserUsername
					},
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
		
		// Notifier les amis que les joueurs ne sont plus en jeu
		if (room.playerUsernames) {
			for (const [socketId, username] of Object.entries(room.playerUsernames)) {
				if (room.players.includes(socketId)) {
					const user = getUserByUsername(username) as any;
					if (user) {
						broadcastUserStatusChange(globalIo, user.id, 'online', fastify);
					}
				}
			}
		}
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
function handleSocketDisconnect(socket: Socket, io: Server, fastify: FastifyInstance)
{
    // Récupérer l'utilisateur avant de nettoyer
    const user = getSocketUser(socket.id);
    
    // Check if player was in an active game before removing
    const playerRoom = getPlayerRoom(socket.id);
    if (playerRoom && rooms[playerRoom]) {
        const room = rooms[playerRoom];
        const wasInActiveGame = !!room.pongGame && room.pongGame.state.running && !room.isLocalGame;
        
        if (wasInActiveGame) {
            // Get disconnected player info
            const disconnectedUsername = room.playerUsernames?.[socket.id];
            const disconnectedPaddleSide = room.paddleBySocket?.[socket.id];
            
            if (disconnectedUsername && disconnectedPaddleSide && room.pongGame) {
                fastify.log.info(`[FORFAIT] Player ${disconnectedUsername} disconnected from active game in room ${playerRoom} - Recording forfeit`);
                
                // Get current scores from paddles
                const paddles = room.pongGame.state.paddles;
                const disconnectedPaddle = paddles.find(p => p.side === disconnectedPaddleSide);
                const disconnectedScore = disconnectedPaddle?.score || 0;
                
                // Find remaining player(s) with highest score as winner
                let winningSide: string | null = null;
                let winningScore = -1;
                let winnerUsername: string | null = null;
                
                for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {})) {
                    if (socketId !== socket.id && room.playerUsernames?.[socketId]) {
                        const playerPaddle = paddles.find(p => p.side === paddle);
                        const score = playerPaddle?.score || 0;
                        if (score > winningScore) {
                            winningScore = score;
                            winningSide = paddle as string;
                            winnerUsername = room.playerUsernames[socketId];
                        }
                    }
                }
                
                // Record the match if we found a winner
                if (winnerUsername && disconnectedUsername && winningSide && disconnectedPaddleSide) {
                    const winnerUser = getUserByUsername(winnerUsername) as any;
                    const loserUser = getUserByUsername(disconnectedUsername) as any;
                    
                    if (winnerUser && loserUser && winnerUser.id !== loserUser.id) {
                        // Record match with current scores
                        updateUserStats(winnerUser.id, loserUser.id, winningScore, disconnectedScore, 'online');
                        fastify.log.info(`[FORFAIT] Match recorded: ${winnerUsername} wins by forfeit ${winningScore}-${disconnectedScore} against ${disconnectedUsername}`);
                        
                        // Construire les objets winner/loser pour gameFinished
                        const winner = {
                            side: winningSide,
                            score: winningScore,
                            username: winnerUsername
                        };
                        
                        const loser = {
                            side: disconnectedPaddleSide,
                            score: disconnectedScore,
                            username: disconnectedUsername
                        };
                        
                        // Émettre gameFinished pour afficher l'écran de fin avec message de forfait
                        io.to(playerRoom).emit('gameFinished', {
                            winner,
                            loser,
                            forfeit: true,
                            forfeitMessage: `${disconnectedUsername} a quitté la partie - Victoire par forfait !`
                        });
                        
                        fastify.log.info(`[FORFAIT] gameFinished émis pour room ${playerRoom}: ${winnerUsername} bat ${disconnectedUsername} par forfait (${winningScore}-${disconnectedScore})`);
                        
                        // Notifier les amis que les DEUX joueurs ne sont plus en jeu
                        broadcastUserStatusChange(globalIo, winnerUser.id, 'online', fastify);
                        broadcastUserStatusChange(globalIo, loserUser.id, 'offline', fastify); // Le perdant s'est déconnecté
                    }
                }
                
                // Stop the game after recording
                if (room.pongGame) {
                    room.pongGame.stop();
                }
            }
        }
    }
    
    removePlayerFromRoom(socket.id);
    // Nettoyer l'authentification du socket
    removeSocketUser(socket.id);
    
    // Notifier les amis que l'utilisateur est maintenant offline
    if (user) {
        broadcastUserStatusChange(globalIo, user.id, 'offline', fastify);
    }
}

// Handler pour quitter toutes les rooms explicitement (SPA navigation)
function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server)
{
    // CRITICAL FIX: Remove any pending join room locks immediately
    if (joinRoomLocks.has(socket.id)) {
        joinRoomLocks.delete(socket.id);
    }
    
    const previousRoom = getPlayerRoom(socket.id);
    if (previousRoom && rooms[previousRoom]) {
        const room = rooms[previousRoom];
        
        // NOUVEAU : Vérifier si le joueur quitte pendant une partie active en ligne
        const wasInActiveGame = !!room.pongGame && room.pongGame.state.running && !room.isLocalGame;
        
        if (wasInActiveGame) {
            // Get disconnected player info
            const leavingUsername = room.playerUsernames?.[socket.id];
            const leavingPaddleSide = room.paddleBySocket?.[socket.id];
            
            if (leavingUsername && leavingPaddleSide && room.pongGame) {
                fastify.log.info(`[FORFAIT] Player ${leavingUsername} left active game in room ${previousRoom} - Recording forfeit`);
                
                // Get current scores from paddles
                const paddles = room.pongGame.state.paddles;
                const leavingPaddle = paddles.find(p => p.side === leavingPaddleSide);
                const leavingScore = leavingPaddle?.score || 0;
                
                // Find remaining player(s) with highest score as winner
                let winningSide: string | null = null;
                let winningScore = -1;
                let winnerUsername: string | null = null;
                
                for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {})) {
                    if (socketId !== socket.id && room.playerUsernames?.[socketId]) {
                        const playerPaddle = paddles.find(p => p.side === paddle);
                        const score = playerPaddle?.score || 0;
                        if (score > winningScore) {
                            winningScore = score;
                            winningSide = paddle as string;
                            winnerUsername = room.playerUsernames[socketId];
                        }
                    }
                }
                
                // Record the match if we found a winner
                if (winnerUsername && leavingUsername && winningSide && leavingPaddleSide) {
                    const winnerUser = getUserByUsername(winnerUsername) as any;
                    const loserUser = getUserByUsername(leavingUsername) as any;
                    
                    if (winnerUser && loserUser && winnerUser.id !== loserUser.id) {
                        // Record match with current scores
                        updateUserStats(winnerUser.id, loserUser.id, winningScore, leavingScore, 'online');
                        fastify.log.info(`[FORFAIT] Match recorded: ${winnerUsername} wins by forfeit ${winningScore}-${leavingScore} against ${leavingUsername}`);
                        
                        // Construire les objets winner/loser pour gameFinished
                        const winner = {
                            side: winningSide,
                            score: winningScore,
                            username: winnerUsername
                        };
                        
                        const loser = {
                            side: leavingPaddleSide,
                            score: leavingScore,
                            username: leavingUsername
                        };
                        
                        // Émettre gameFinished pour afficher l'écran de fin avec message de forfait
                        io.to(previousRoom).emit('gameFinished', {
                            winner,
                            loser,
                            forfeit: true,
                            forfeitMessage: `${leavingUsername} a quitté la partie - Victoire par forfait !`
                        });
                        
                        fastify.log.info(`[FORFAIT] gameFinished émis pour room ${previousRoom}: ${winnerUsername} bat ${leavingUsername} par forfait (${winningScore}-${leavingScore})`);
                        
                        // Notifier les amis que les DEUX joueurs ne sont plus en jeu
                        broadcastUserStatusChange(globalIo, winnerUser.id, 'online', fastify);
                        broadcastUserStatusChange(globalIo, loserUser.id, 'online', fastify); // Le perdant quitte aussi
                    }
                }
                
                // Stop the game after recording
                if (room.pongGame) {
                    room.pongGame.stop();
                }
            }
        }
        
        // Get the room object and clean up paddle assignments
        if (room.paddleBySocket) {
            delete room.paddleBySocket[socket.id];
        }
        
        // Remove from room manager
        removePlayerFromRoom(socket.id);
        // Leave socket.io room AFTER emitting gameFinished
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
    // Mutex global pour les opérations critiques
    globalIo = io; // Stocker l'instance io globalement
    
    // Tick rate configurable (env: TICK_RATE, default: 120 FPS for smooth gameplay)
    const tickRate = Number(process.env.TICK_RATE ?? 120);
    const intervalMs = Math.max(1, Math.floor(1000 / tickRate));
    
    if (fastify.log) {
        fastify.log.info(`🎮 Game tick rate: ${tickRate} FPS (interval: ${intervalMs}ms)`);
    }
    
    setInterval(() =>
	{
        handleGameTick(io, fastify);
    }, intervalMs);

    io.on('connection', (socket: Socket) =>
	{
        fastify.log.info(`Client connecté : ${socket.id}`);
        
        // Authentifier le socket à la connexion
        const user = authenticateSocket(socket, fastify);
        if (user && typeof user === 'object') {
            fastify.log.info(`Socket ${socket.id} authentifié pour l'utilisateur ${user.username} (${user.id})`);
            
            // 🚀 NOUVEAU : Notifier les amis que l'utilisateur est maintenant en ligne
            broadcastUserStatusChange(globalIo, user.id, 'online', fastify);
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
        // Minimal handler for tournament match room joining
        // Client payload: { tournamentId: string, matchId: number }
        socket.on('tournament:join_match', (data: any) => {
            try {
                const tournamentId = data?.tournamentId;
                const matchId = data?.matchId;
                if (!tournamentId || !matchId) {
                    socket.emit('tournament:join_match:error', { error: 'tournamentId and matchId required' });
                    return;
                }

                const user = getSocketUser(socket.id);
                if (!user) {
                    socket.emit('tournament:join_match:error', { error: 'Authentication required' });
                    return;
                }

                const roomName = `tournament:${tournamentId}:match:${matchId}`;
                socket.join(roomName);
                socket.emit('tournament:join_match:ok', { room: roomName });
                fastify.log.info(`Socket ${socket.id} (user=${user.username}) joined ${roomName}`);
            } catch (err) {
                socket.emit('tournament:join_match:error', { error: 'Internal server error' });
            }
        });
        
        
        socket.on('ping', () => socket.emit('pong', { message: 'Hello client!' }));
        socket.on('message', (msg: string) => handleSocketMessage(socket, msg));
        socket.on('disconnect', () => handleSocketDisconnect(socket, io, fastify));
        socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
    });
}
