/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/12/11 20:34:53 by qordoux          ###   ########.fr       */
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
import { handleForfeit } from './utils/forfeitHandling.js';

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
    
    // Gestion spéciale pour les demi-finales de tournoi simultanées
    if (room.isTournament && room.tournamentState?.phase === 'semifinals') {
        handleTournamentSemifinalInput(socket.id, message, room);
        return;
    }
    
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

/**
 * Gère les inputs pour les demi-finales de tournoi simultanées
 */
function handleTournamentSemifinalInput(socketId: string, message: any, room: RoomType): void {
    if (!isKeyboardEvent(message)) return;
    
    const { player, direction } = message.data || {};
    if (!player || !direction) return;
    if (direction !== 'up' && direction !== 'down') return;
    
    const state = room.tournamentState;
    if (!state) return;
    
    // Trouver dans quelle demi-finale est ce joueur
    let semifinal = null;
    let semifinalNumber = 0;
    if (state.semifinal1 && (socketId === state.semifinal1.player1 || socketId === state.semifinal1.player2)) {
        semifinal = state.semifinal1;
        semifinalNumber = 1;
    } else if (state.semifinal2 && (socketId === state.semifinal2.player1 || socketId === state.semifinal2.player2)) {
        semifinal = state.semifinal2;
        semifinalNumber = 2;
    }
    
    if (!semifinal || !semifinal.pongGame) return;
    
    // Vérifier que le joueur contrôle bien ce paddle
    const allowedPaddle = semifinal.paddleBySocket[socketId];
    if (player !== allowedPaddle) return;
    
    // Valider le paddle et la direction
    if (player !== 'LEFT' && player !== 'RIGHT') return;
    if (direction !== 'up' && direction !== 'down') return;
    
    // Mettre à jour l'input (direction est maintenant typé correctement)
    const isPressed = message.type === 'keydown';
    const dir = direction as 'up' | 'down';
    semifinal.paddleInputs[player][dir] = isPressed;
    
    // Mouvement immédiat sur keydown
    if (isPressed) {
        semifinal.pongGame.movePaddle(player, direction);
    }
}

/**
 * Verifie si une room a une partie online active en cours
 */
function isActiveOnlineGame(room: RoomType): boolean
{
    return !!room.pongGame && room.pongGame.state.running && !room.isLocalGame;
}

/**
 * Gere l'authentification d'un socket a la connexion
 * Retourne true si la connexion doit etre interrompue
 */
function handleSocketAuthentication(socket: Socket, fastify: FastifyInstance): boolean
{
    const user = authenticateSocket(socket, fastify);
    
    if (user && typeof user === 'object')
    {
        broadcastUserStatusChange(globalIo, user.id, 'online', fastify);
        return false; // Continuer la connexion
    }
    
    if (user === 'USER_ALREADY_CONNECTED')
    {
        socket.emit('error', { 
            error: 'User is already connected on another browser/tab. Please close other connections first.', 
            code: 'USER_ALREADY_CONNECTED' 
        });
        socket.disconnect(true);
        return true; // Interrompre la connexion
    }
    
    return false; // Connexion non authentifiee mais autorisee (jeux locaux)
}

/**
 * Handler pour rejoindre un match de tournoi
 */
function handleTournamentJoinMatch(socket: Socket, data: { tournamentId?: string; matchId?: string } | undefined | null, fastify: FastifyInstance): void
{
    try
    {
        const tournamentId = data?.tournamentId;
        const matchId = data?.matchId;
        
        if (!tournamentId || !matchId)
        {
            socket.emit('tournament:join_match:error', { error: 'tournamentId and matchId required' });
            return;
        }

        const user = getSocketUser(socket.id);
        if (!user)
        {
            socket.emit('tournament:join_match:error', { error: 'Authentication required' });
            return;
        }

        const roomName = `tournament:${tournamentId}:match:${matchId}`;
        socket.join(roomName);
        socket.emit('tournament:join_match:ok', { room: roomName });
        fastify.log.info(`Socket ${socket.id} (user=${user.username}) joined ${roomName}`);
    }
    catch (err)
    {
        socket.emit('tournament:join_match:error', { error: 'Internal server error' });
    }
}

/**
 * Handler pour rejoindre une room de tournoi (recevoir les updates en temps réel)
 */
function handleJoinTournamentRoom(socket: Socket, data: { tournamentId?: string } | undefined | null, fastify: FastifyInstance): void
{
    const tournamentId = data?.tournamentId;
    if (!tournamentId)
    {
        socket.emit('error', { error: 'tournamentId required' });
        return;
    }

    const roomName = `tournament:${tournamentId}`;
    socket.join(roomName);
    fastify.log.info(`Socket ${socket.id} joined tournament room: ${roomName}`);
}

/**
 * Handler pour quitter une room de tournoi
 */
function handleLeaveTournamentRoom(socket: Socket, data: { tournamentId?: string } | undefined | null): void
{
    const tournamentId = data?.tournamentId;
    if (!tournamentId) return;

    const roomName = `tournament:${tournamentId}`;
    socket.leave(roomName);
}

/**
 * Enregistre tous les event listeners sur un socket
 */
function registerSocketEventListeners(socket: Socket, io: Server, fastify: FastifyInstance): void
{
    socket.on('joinRoom', (data: Record<string, unknown>) => handleJoinRoom(socket, data, fastify, io));
    socket.on('tournament:join_match', (data: { tournamentId?: string; matchId?: string }) => handleTournamentJoinMatch(socket, data, fastify));
    socket.on('joinTournamentRoom', (data: { tournamentId?: string }) => handleJoinTournamentRoom(socket, data, fastify));
    socket.on('leaveTournamentRoom', (data: { tournamentId?: string }) => handleLeaveTournamentRoom(socket, data));
    socket.on('message', (msg: string) => handleSocketMessage(socket, msg));
    socket.on('disconnect', () => handleSocketDisconnect(socket, io, fastify));
    socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
}

/**
 * Handler pour la deconnexion du client
 * Gere le cleanup et les forfaits si le joueur etait en partie
 */
function handleSocketDisconnect(socket: Socket, io: Server, fastify: FastifyInstance): void
{
    const user = getSocketUser(socket.id);
    const playerRoom = getPlayerRoom(socket.id);
    
    // Gerer le forfait si le joueur etait dans une partie active
    if (playerRoom && rooms[playerRoom])
    {
        const room = rooms[playerRoom];
        
        if (isActiveOnlineGame(room) && room.pongGame)
        {
            handleForfeit(
                room,
                playerRoom,
                socket.id,
                io,
                globalIo,
                true, // loserIsOffline = true (deconnexion complete)
                fastify
            );
        }
    }
    
    // Cleanup de la room et de l'authentification
    removePlayerFromRoom(socket.id);
    removeSocketUser(socket.id);
    
    // Notifier les amis que l'utilisateur est offline
    if (user)
        broadcastUserStatusChange(globalIo, user.id, 'offline', fastify);
}

/**
 * Nettoie les assignations de paddle pour un socket
 */
function cleanupPaddleAssignments(room: RoomType, socketId: string): void
{
    if (room.paddleBySocket)
        delete room.paddleBySocket[socketId];
}

/**
 * Force le cleanup complet d'un joueur de toutes les rooms
 */
function forceCompleteCleanup(socket: Socket, fastify: FastifyInstance, io: Server): void
{
    cleanUpPlayerRooms(socket, fastify, io);
    
    // Triple verification et force removal si necessaire
    const roomAfterCleanup = getPlayerRoom(socket.id);
    if (roomAfterCleanup && rooms[roomAfterCleanup])
    {
        const room = rooms[roomAfterCleanup];
        cleanupPaddleAssignments(room, socket.id);
        removePlayerFromRoom(socket.id);
        socket.leave(roomAfterCleanup);
    }
}

/**
 * Handler pour quitter toutes les rooms explicitement (SPA navigation)
 * Gere le forfait si le joueur quitte pendant une partie active
 */
function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server): void
{
    // Remove pending join room locks immediately
    if (joinRoomLocks.has(socket.id))
        joinRoomLocks.delete(socket.id);
    
    const previousRoom = getPlayerRoom(socket.id);
    let wasTournamentPlayer = false;
    let userId: number | null = null;
    
    if (previousRoom && rooms[previousRoom])
    {
        const room = rooms[previousRoom];
        
        // Vérifier si c'était un joueur de tournoi pour notifier ses amis
        if ((room as any).isTournament && room.playerUserIds && room.playerUserIds[socket.id]) {
            wasTournamentPlayer = true;
            userId = room.playerUserIds[socket.id];
        }
        
        // Gerer le forfait si partie active
        if (isActiveOnlineGame(room) && room.pongGame)
        {
            handleForfeit(
                room,
                previousRoom,
                socket.id,
                io,
                globalIo,
                false, // loserIsOffline = false (juste sortie de partie, pas deconnexion)
                fastify
            );
        }
        
        // Cleanup des assignations et sortie de la room
        cleanupPaddleAssignments(room, socket.id);
        removePlayerFromRoom(socket.id);
        socket.leave(previousRoom);
    }
    
    // Force cleanup complet
    forceCompleteCleanup(socket, fastify, io);
    
    // Notifier les amis que le joueur de tournoi est maintenant online
    if (wasTournamentPlayer && userId) {
        broadcastUserStatusChange(globalIo, userId, 'online', fastify);
    }
    
    // Confirmation au client
    socket.emit('leaveAllRoomsComplete', { status: 'success' });
}

// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
    globalIo = io;
    
    // Tick rate à 120 FPS pour un gameplay plus fluide
    // L'extrapolation client compense les doublons d'états
    const tickRate = Number(process.env.TICK_RATE ?? 120);
    const intervalMs = Math.max(1, Math.floor(1000 / tickRate));//convertir fps en ms entre chaque tick
    
    setInterval(() => handleGameTick(io, fastify), intervalMs);

    io.on('connection', (socket: Socket) =>
    {
        // Authentifier et verifier si la connexion doit continuer
        const shouldDisconnect = handleSocketAuthentication(socket, fastify);
        if (shouldDisconnect)
            return;
        
        // Enregistrer tous les event listeners
        registerSocketEventListeners(socket, io, fastify);
    });
}
