import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getPlayerRoom, removePlayerFromRoom, rooms, createRoom } from '../roomManager.js';
import { authenticateSocket, getSocketUser } from '../socketAuth.js';
import { getUserByUsername } from '../../user.js';
import { PongGame } from '../../../game/pongGame.js';

export interface JoinRoomParams
{
    maxPlayers: number | undefined;
    isLocalGame: boolean;
    enableAI: boolean;
    aiDifficulty: string;
    isSpectator: boolean;
    roomName: string | null;
    isTournament: boolean;
}

interface JoinRoomData
{
    maxPlayers?: number;
    isLocalGame?: boolean;
    enableAI?: boolean;
    aiDifficulty?: string;
    spectator?: boolean;
    roomName?: string;
    isTournament?: boolean;
}

export function parseJoinRoomData(data: Record<string, unknown> | undefined | null): JoinRoomParams
{
    const d = data as JoinRoomData | undefined | null;
    return {
        maxPlayers: d?.maxPlayers,
        isLocalGame: d?.isLocalGame === true,
        enableAI: d?.enableAI === true,
        aiDifficulty: d?.aiDifficulty || 'medium',
        isSpectator: d?.spectator === true,
        roomName: d?.roomName || null,
        isTournament: d?.isTournament === true
    };
}

export function cleanupPreviousRoom(socket: Socket): void
{
    const previousRoom = getPlayerRoom(socket.id);
    
    if (previousRoom)
    {
        const oldRoom = rooms[previousRoom];
        if (oldRoom && oldRoom.paddleBySocket)
            delete oldRoom.paddleBySocket[socket.id];
        
        removePlayerFromRoom(socket.id, true);
        socket.leave(previousRoom);
    }
}

export function findOrCreateRoom(params: JoinRoomParams): string
{
    let roomName = params.roomName;
    
    if (!roomName && typeof params.maxPlayers === 'number')
    {
        if (!params.isLocalGame)
        {
            for (const [name, room] of Object.entries(rooms))
            {
                if (params.isTournament)
                {
                    if (name.startsWith('tournament-') && room.maxPlayers === params.maxPlayers && room.players.length < params.maxPlayers && room.isLocalGame === false && (!room.tournamentState || room.tournamentState.phase === 'waiting'))
                    {
                        roomName = name;
                        break;
                    }
                }
                else
                {
                    if (!name.startsWith('tournament-') && !room.isTournament && room.maxPlayers === params.maxPlayers && room.players.length < params.maxPlayers &&room.isLocalGame === false)
                    {
                        roomName = name;
                        break;
                    }
                }
            }
        }
        
        if (!roomName)
        {
            let roomPrefix: string;
            if (params.isTournament)
                roomPrefix = 'tournament';
            else if (params.isLocalGame)
                roomPrefix = 'local';
            else
                roomPrefix = 'multi';
            
            roomName = createRoom(params.maxPlayers, roomPrefix);
        }
    }
    
    return roomName as string;
}

export function handleSpectatorJoin(socket: Socket, roomName: string, room: RoomType): boolean
{
    if (room.isLocalGame)
    {
        socket.emit('error', { error: 'Cannot spectate local games' });
        return true;
    }
    
    socket.join(roomName);
    
    socket.emit('roomJoined', {
        room: roomName,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        paddle: null,
        spectator: true
    });
    
    if (room.pongGame && room.pongGame.state.running)
        socket.emit('gameState', room.pongGame.state);
    
    return true;
}

export function authenticateOnlinePlayer(
    socket: Socket, 
    roomName: string, 
    room: RoomType, 
    fastify: FastifyInstance
): { id: number; username: string } | null
{
    const user = authenticateSocket(socket, fastify);
    
    if (user && typeof user === 'object' && 'username' in user)
    {
        if (!room.playerUsernames)
            room.playerUsernames = {};
        room.playerUsernames[socket.id] = user.username;
        
        if (!room.playerUserIds)
            room.playerUserIds = {};
        room.playerUserIds[socket.id] = user.id;
        
        return user;
    }
    else if (user === 'USER_ALREADY_CONNECTED')
    {
        socket.emit('error', { 
            error: 'User is already connected on another browser/tab. Please close the other connection first.',
            code: 'USER_ALREADY_CONNECTED' 
        });
        removePlayerFromRoom(socket.id);
        socket.leave(roomName);
        return null;
    }
    else
    {
        socket.emit('error', { error: 'Authentication failed. Please login again to play online multiplayer games.' });
        removePlayerFromRoom(socket.id);
        socket.leave(roomName);
        return null;
    }
}

export function notifyFriendsGameStarted(
    room: RoomType, 
    fastify: FastifyInstance,
    broadcastUserStatusChange: (io: Server | null, userId: number, status: 'in-game' | 'in-tournament' | 'online' | 'offline', fastify: FastifyInstance) => void,
    globalIo: Server | null,
    isTournament: boolean = false
): void
{
    if (room.players.length !== room.maxPlayers)
        return;
    if (!room.playerUsernames)
        return;
    
    const status = isTournament ? 'in-tournament' : 'in-game';
    
    for (const [socketId, username] of Object.entries(room.playerUsernames))
    {
        const player = getUserByUsername(username) as { id: number } | undefined;
        if (player)
            broadcastUserStatusChange(globalIo, player.id, status, fastify);
    }
}

export function startLocalGame(
    room: RoomType,
    roomName: string,
    params: JoinRoomParams,
    io: Server,
    fastify: FastifyInstance
): void
{
    const localGameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) =>
    {
        io.to(roomName).emit('gameFinished', {
            winner,
            loser,
            mode: params.enableAI ? 'ai' : 'local',
            numPlayers: room.maxPlayers || 2
        });
    };
    
    room.pongGame = new PongGame(room.maxPlayers!, localGameEndCallback);
    
    if (params.enableAI && room.maxPlayers === 2)
        room.pongGame.enableAI(params.aiDifficulty as 'easy' | 'medium' | 'hard');
    
    room.pongGame.start();
}

export function startOnlineGame(
    room: RoomType,
    roomName: string,
    handleGameEnd: Function,
    fastify: FastifyInstance,
    io: Server
): void
{
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) =>
    {
        handleGameEnd(roomName, room, winner, loser, fastify, io);
    };
    
    room.pongGame = new PongGame(room.maxPlayers, gameEndCallback);
    room.pongGame.start();
}
