import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from '../roomManager.js';
import { getSocketUser } from '../socketAuth.js';
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
    startOnlineGame,
    JoinRoomParams
} from '../utils/roomJoining.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { getGlobalIo } from '../socketHandlers.js';
import { handleGameEnd } from './gameEndHandlers.js';
import { startTournament, cleanupUserFromTournaments } from './tournamentHandlers.js';
import { canSocketJoinOnlineGame, isTournamentRoom } from '../utils/modeIsolation.js';

// Check if client can join room (valid name and room exists)
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

// Check if room is full
export function handleRoomFull(socket: Socket, room: RoomType, fastify: FastifyInstance): boolean
{
    if (room.players.length >= room.maxPlayers)
    {
        socket.emit('error', { error: 'Room is full' });
        return true;
    }
    return false;
}

// Validate room access and capacity
export function validateRoomAccess(
    socket: Socket,
    roomName: string,
    room: RoomType,
    params: JoinRoomParams,
    fastify: FastifyInstance
): boolean
{
    if (!canJoinRoom(socket, roomName))
        return false;
    
    if (handleRoomFull(socket, room, fastify))
        return false;
    
    if (room.isTournament && room.tournamentState && room.tournamentState.phase !== 'waiting')
    {
        const user = getSocketUser(socket.id);
        let isParticipant = false;
        
        if (user && room.tournamentState.playerUserIds)
             isParticipant = Object.values(room.tournamentState.playerUserIds).includes(user.id);

        if (!isParticipant)
        {
            socket.emit('error', { error: 'Tournament has already started', code: 'TOURNAMENT_STARTED' });
            return false;
        }
    }
    
    return true;
}

// Remove player from all rooms and cleanup
export function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance, io: Server): void
{
    for (const rName in rooms)
    {
        if (rooms[rName].players.includes(socket.id))
        {
            const room = rooms[rName] as RoomType;
            
            if (room.isTournament && room.tournamentState)
            {
                const phase = room.tournamentState.phase;
                if (phase === 'waiting' || phase === 'semifinals' || phase === 'waiting_final' || phase === 'final')
                    continue;
            }
            
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

// Join player to room and configure paddles
export function joinPlayerToRoom(socket: Socket, roomName: string, room: RoomType, io: Server): void
{
    if (!room.players.includes(socket.id))
    {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    
    if (room.isTournament && room.tournamentState && room.tournamentState.phase !== 'waiting')
    {
        const user = getSocketUser(socket.id);
        if (user && room.tournamentState.playerUserIds)
        {
            let oldSocketId: string | undefined;
            for (const [sid, uid] of Object.entries(room.tournamentState.playerUserIds))
            {
                if (uid === user.id)
                {
                    oldSocketId = sid;
                    break;
                }
            }
            
            if (oldSocketId && oldSocketId !== socket.id)
            {
                delete room.tournamentState.playerUserIds[oldSocketId];
                room.tournamentState.playerUserIds[socket.id] = user.id;
                
                if (room.tournamentState.playerUsernames)
                {
                    const username = room.tournamentState.playerUsernames[oldSocketId];
                    if (username)
                    {
                        delete room.tournamentState.playerUsernames[oldSocketId];
                        room.tournamentState.playerUsernames[socket.id] = username;
                    }
                }
                
                const playerIndex = room.tournamentState.players.indexOf(oldSocketId);
                if (playerIndex !== -1)
                    room.tournamentState.players[playerIndex] = socket.id;
                
                const updateMatch = (match: any) =>
                {
                    if (!match) return;
                    if (match.player1 === oldSocketId) match.player1 = socket.id;
                    if (match.player2 === oldSocketId) match.player2 = socket.id;
                    if (match.winner === oldSocketId) match.winner = socket.id;
                    
                    if (match.paddleBySocket && match.paddleBySocket[oldSocketId])
                    {
                        match.paddleBySocket[socket.id] = match.paddleBySocket[oldSocketId];
                        delete match.paddleBySocket[oldSocketId];
                    }
                };
                
                updateMatch(room.tournamentState.semifinal1);
                updateMatch(room.tournamentState.semifinal2);
                
                if (room.tournamentState.semifinal1Winner === oldSocketId) room.tournamentState.semifinal1Winner = socket.id;
                if (room.tournamentState.semifinal2Winner === oldSocketId) room.tournamentState.semifinal2Winner = socket.id;
                if (room.tournamentState.finalWinner === oldSocketId) room.tournamentState.finalWinner = socket.id;
            }
        }
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

// Handle authentication and notifications for online games
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
    
    notifyFriendsGameStarted(room, fastify, broadcastUserStatusChange, getGlobalIo(), room.isTournament);
    
    return true;
}

// Start game if conditions are met
export function tryStartGame(
    room: RoomType,
    roomName: string,
    params: JoinRoomParams,
    fastify: FastifyInstance,
    io: Server
): void
{
    if (params.isLocalGame && !room.pongGame)
        startLocalGame(room, roomName, params, io, fastify);
    else if (!room.pongGame && room.players.length === room.maxPlayers)
    {
        if (room.isTournament)
            startTournament(room, roomName, io, fastify);
        else
            startOnlineGame(room, roomName, handleGameEnd, fastify, io);
    }
}

export const joinRoomLocks = new Set<string>();

// Main handler for joining or creating a room
export async function handleJoinRoom(
    socket: Socket,
    data: Record<string, unknown>,
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
        
        if (params.isTournament)
            room.isTournament = true;
        
        if (!params.isLocalGame && !isTournamentRoom(roomName))
        {
            const isolationCheck = canSocketJoinOnlineGame(socket);
            if (!isolationCheck.allowed)
            {
                socket.emit('error', { 
                    error: isolationCheck.reason,
                    code: 'TOURNAMENT_ISOLATION',
                    tournament: isolationCheck.tournament
                });
                if (room.players.length === 0)
                    delete rooms[roomName];
                return;
            }
        }
        
        if (params.isSpectator && roomName && rooms[roomName])
        {
            handleSpectatorJoin(socket, roomName, room);
            return;
        }
        
        if (!validateRoomAccess(socket, roomName, room, params, fastify))
            return;
        
        // If joining a non-tournament room, ensure we are not linked to any active tournament
        if (!room.isTournament) {
             const user = getSocketUser(socket.id);
             if (user) {
                 cleanupUserFromTournaments(user.id, socket);
             }
        }

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
