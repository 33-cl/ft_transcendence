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
import { getPlayerRoom, rooms } from './roomManager.js';
import { authenticateSocket, getSocketUser, removeSocketUser } from './socketAuth.js';
import { broadcastUserStatusChange } from './notificationHandlers.js';
import { handleJoinRoom, cleanUpPlayerRooms, joinRoomLocks } from './handlers/roomHandlers.js';
import { handleGameTick } from './handlers/gameTickHandlers.js';
import { handleGameEnd } from './handlers/gameEndHandlers.js';
import { initPaddleInputs } from './handlers/gameTickHandlers.js';
import { getUserByUsername } from '../user.js';
import { RoomType } from '../types.js';
import { updateUserStats } from '../user.js';
import { removePlayerFromRoom } from './roomManager.js';
import { parseClientMessage, isKeyboardEvent } from './utils/messageHandling.js';
import { handleLocalGamePaddleControl, handleOnlineGamePaddleControl } from './utils/paddleControl.js';

// Global io instance for use in other modules
let globalIo: Server | null = null;

// Export a function to get the global io instance
export function getGlobalIo(): Server | null
{
    return globalIo;
}

/**
 * Handler principal pour les messages du client
 * Gere les inputs clavier pour controler les paddles
 */
function handleSocketMessage(socket: Socket, msg: string): void
{
    // json -> object
    const message = parseClientMessage(msg);
    if (!message)
        return;
    
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom)
        return;
    
    const room = rooms[playerRoom] as RoomType;
    
    if (!room.paddleInputs)
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
    
    if (!isKeyboardEvent(message) || !room.pongGame || !room.paddleBySocket)
        return;
    
    const { player, direction } = message.data || {};
    if (!player || !direction)
        return;
    
    if (room.isLocalGame)
        handleLocalGamePaddleControl(room, socket.id, player, direction, message.type);
    else
        handleOnlineGamePaddleControl(room, socket.id, player, direction, message.type);
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
