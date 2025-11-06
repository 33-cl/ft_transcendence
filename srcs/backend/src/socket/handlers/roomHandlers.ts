// ========================================
// ROOM HANDLERS
// Gestion de joinRoom et des rooms
// ========================================

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from '../roomManager.js';
import {
    removePlayerFromRoomPlayers,
    deleteLocalGameRoom,
    deleteActiveGameRoom,
    isGameRunning
} from '../utils/roomCleanup.js';
import {
    assignAllPaddlesToSocket,
    purgeOldPaddleAssignments,
    assignPaddleByArrivalOrder,
    broadcastRoomState
} from '../utils/playerJoining.js';
import {
    parseJoinRoomData,
    cleanupPreviousRoom,
    findOrCreateRoom,
    handleSpectatorJoin,
    authenticateOnlinePlayer,
    notifyFriendsGameStarted,
    startLocalGame,
    startOnlineGame
} from '../utils/roomJoining.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { getGlobalIo } from '../socketHandlers.js';
import { handleGameEnd } from './gameEndHandlers.js';

// ========================================
// ROOM ACCESS VALIDATION
// ========================================

/**
 * Vérifie si un client peut rejoindre une room
 * (nom valide et room existante)
 */
export function canJoinRoom(socket: Socket, roomName: string): boolean
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

/**
 * Vérifie si une room est pleine
 */
export function handleRoomFull(socket: Socket, room: RoomType, fastify: FastifyInstance): boolean
{
    if (room.players.length >= room.maxPlayers)
    {
        socket.emit('error', { error: 'Room is full' });
        return true;
    }
    return false;
}

/**
 * Valide que la room est accessible et non pleine
 */
export function validateRoomAccess(
    socket: Socket,
    roomName: string,
    room: RoomType,
    params: any,
    fastify: FastifyInstance
): boolean
{
    if (!canJoinRoom(socket, roomName))
        return false;
    
    if (handleRoomFull(socket, room, fastify))
        return false;
    
    return true;
}

// ========================================
// ROOM CLEANUP
// ========================================

/**
 * Retire un joueur de toutes les rooms où il pourrait être
 * Nettoie les rooms locales et arrête les jeux actifs si nécessaire
 */
export function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance, io: Server): void
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
            
            if (isGameRunning(room))
            {
                deleteActiveGameRoom(room, rName, socket.id, io);
                delete rooms[rName];
                break;
            }
        }
    }
}

// ========================================
// PLAYER JOINING
// ========================================

/**
 * Fait rejoindre un joueur à une room
 * Configure les paddles selon le type de jeu (local/online)
 */
export function joinPlayerToRoom(socket: Socket, roomName: string, room: RoomType, io: Server): void
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

// ========================================
// GAME PREPARATION
// ========================================

/**
 * Gère l'authentification et les notifications pour les jeux en ligne
 */
export function handleOnlineGamePreparation(
    socket: Socket,
    roomName: string,
    room: RoomType,
    fastify: FastifyInstance
): boolean
{
    const user = authenticateOnlinePlayer(socket, roomName, room, fastify);
    if (!user)
        return false;
    
    notifyFriendsGameStarted(room, fastify, broadcastUserStatusChange, getGlobalIo());
    return true;
}

/**
 * Démarre le jeu si les conditions sont remplies
 */
export function tryStartGame(
    room: RoomType,
    roomName: string,
    params: any,
    fastify: FastifyInstance,
    io: Server
): void
{
    if (params.isLocalGame && !room.pongGame)
        startLocalGame(room, roomName, params, io, fastify);
    else if (!room.pongGame && room.players.length === room.maxPlayers)
        startOnlineGame(room, roomName, handleGameEnd, fastify, io);
}

// ========================================
// MAIN HANDLER
// ========================================

// Mutex to prevent concurrent joinRoom for the same socket
export const joinRoomLocks = new Set<string>();

/**
 * Handler principal pour rejoindre ou créer une room
 * Gère toute la séquence : parsing, validation, join, démarrage
 */
export async function handleJoinRoom(
    socket: Socket,
    data: any,
    fastify: FastifyInstance,
    io: Server
): Promise<void>
{
    if (joinRoomLocks.has(socket.id))
    {
        socket.emit('error', { error: 'joinRoom already in progress', code: 'JOIN_IN_PROGRESS' });
        return;
    }
    
    joinRoomLocks.add(socket.id);
    
    try
    {
        const params = parseJoinRoomData(data);
        cleanupPreviousRoom(socket);
        const roomName = findOrCreateRoom(params);
        
        const room = rooms[roomName] as RoomType;
        room.isLocalGame = params.isLocalGame;
        
        if (params.isSpectator && roomName && rooms[roomName])
        {
            handleSpectatorJoin(socket, roomName, room);
            return;
        }
        
        if (!validateRoomAccess(socket, roomName, room, params, fastify))
            return;
        
        joinPlayerToRoom(socket, roomName, room, io);
        
        if (!params.isLocalGame)
        {
            if (!handleOnlineGamePreparation(socket, roomName, room, fastify))
                return;
        }
        
        tryStartGame(room, roomName, params, fastify, io);
    }
    finally
    {
        joinRoomLocks.delete(socket.id);
    }
}
