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
import { processTournamentStateForfeit } from './handlers/tournamentHandlers.js';

let globalIo: Server | null = null;

export function getGlobalIo(): Server | null
{
    return globalIo;
}

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

function handleSocketMessage(socket: Socket, msg: string): void
{
    const message = parseClientMessage(msg);
    if (!message)
        return;
    
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom)
        return;
    
    const room = rooms[playerRoom] as RoomType;
    
    if (room.isTournament && room.tournamentState?.phase === 'semifinals')
    {
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

function handleTournamentSemifinalInput(socketId: string, message: any, room: RoomType): void
{
    if (!isKeyboardEvent(message))
        return;
    
    const { player, direction } = message.data || {};
    if (!player || !direction)
        return;
    if (direction !== 'up' && direction !== 'down')
        return;
    
    const state = room.tournamentState;
    if (!state)
        return;
    
    let semifinal = null;
    let semifinalNumber = 0;
    if (state.semifinal1 && (socketId === state.semifinal1.player1 || socketId === state.semifinal1.player2))
    {
        semifinal = state.semifinal1;
        semifinalNumber = 1;
    }
    else if (state.semifinal2 && (socketId === state.semifinal2.player1 || socketId === state.semifinal2.player2))
    {
        semifinal = state.semifinal2;
        semifinalNumber = 2;
    }
    
    if (!semifinal || !semifinal.pongGame)
        return;
    
    const allowedPaddle = semifinal.paddleBySocket[socketId];
    if (player !== allowedPaddle)
        return;
    
    if (player !== 'LEFT' && player !== 'RIGHT')
        return;
    if (direction !== 'up' && direction !== 'down')
        return;
    
    const isPressed = message.type === 'keydown';
    const dir = direction as 'up' | 'down';
    semifinal.paddleInputs[player][dir] = isPressed;
    
    if (isPressed)
        semifinal.pongGame.movePaddle(player, direction);
}

function isActiveOnlineGame(room: RoomType): boolean
{
    return !!room.pongGame && room.pongGame.state.running && !room.isLocalGame;
}

function handleSocketAuthentication(socket: Socket, fastify: FastifyInstance): boolean
{
    const user = authenticateSocket(socket, fastify);
    
    if (user && typeof user === 'object')
    {
        broadcastUserStatusChange(globalIo, user.id, 'online', fastify);
        return false;
    }
    
    if (user === 'USER_ALREADY_CONNECTED')
    {
        socket.emit('error', { 
            error: 'User is already connected on another browser/tab. Please close other connections first.', 
            code: 'USER_ALREADY_CONNECTED' 
        });
        socket.disconnect(true);
        return true;
    }
    
    return false;
}

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
    }
    catch (err)
    {
        socket.emit('tournament:join_match:error', { error: 'Internal server error' });
    }
}

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
}

function handleLeaveTournamentRoom(socket: Socket, data: { tournamentId?: string } | undefined | null): void
{
    const tournamentId = data?.tournamentId;
    if (!tournamentId)
        return;

    const roomName = `tournament:${tournamentId}`;
    socket.leave(roomName);
}

function handleSocketDisconnect(socket: Socket, io: Server, fastify: FastifyInstance): void
{
    const user = getSocketUser(socket.id);
    const playerRoom = getPlayerRoom(socket.id);
    
    if (playerRoom && rooms[playerRoom])
    {
        const room = rooms[playerRoom];
        
        if ((room as any).isTournament && (room as any).tournamentState)
            processTournamentStateForfeit(room as any, playerRoom, socket.id, io, globalIo, true, fastify);

        if (isActiveOnlineGame(room) && room.pongGame)
        {
            handleForfeit(
                room,
                playerRoom,
                socket.id,
                io,
                globalIo,
                true,
                fastify
            );
        }
    }
    
    removePlayerFromRoom(socket.id);
    removeSocketUser(socket.id);
    
    if (user)
        broadcastUserStatusChange(globalIo, user.id, 'offline', fastify);
}

function cleanupPaddleAssignments(room: RoomType, socketId: string): void
{
    if (room.paddleBySocket)
        delete room.paddleBySocket[socketId];
}

function forceCompleteCleanup(socket: Socket, fastify: FastifyInstance, io: Server): void
{
    cleanUpPlayerRooms(socket, fastify, io);
    
    const roomAfterCleanup = getPlayerRoom(socket.id);
    if (roomAfterCleanup && rooms[roomAfterCleanup])
    {
        const room = rooms[roomAfterCleanup];
        cleanupPaddleAssignments(room, socket.id);
        removePlayerFromRoom(socket.id);
        socket.leave(roomAfterCleanup);
    }
}

function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server): void
{
    if (joinRoomLocks.has(socket.id))
        joinRoomLocks.delete(socket.id);
    
    const previousRoom = getPlayerRoom(socket.id);
    let wasTournamentPlayer = false;
    let userId: number | null = null;
    
    if (previousRoom && rooms[previousRoom])
    {
        const room = rooms[previousRoom];
        
        if ((room as any).isTournament && room.playerUserIds && room.playerUserIds[socket.id])
        {
            wasTournamentPlayer = true;
            userId = room.playerUserIds[socket.id];
        }
        
        if ((room as any).isTournament && (room as any).tournamentState)
            processTournamentStateForfeit(room as any, previousRoom, socket.id, io, globalIo, false, fastify);

        if (isActiveOnlineGame(room) && room.pongGame)
        {
            handleForfeit(
                room,
                previousRoom,
                socket.id,
                io,
                globalIo,
                false,
                fastify
            );
        }
        
        cleanupPaddleAssignments(room, socket.id);
        removePlayerFromRoom(socket.id);
        socket.leave(previousRoom);
    }
    
    forceCompleteCleanup(socket, fastify, io);
    
    if (wasTournamentPlayer && userId)
        broadcastUserStatusChange(globalIo, userId, 'online', fastify);
    
    socket.emit('leaveAllRoomsComplete', { status: 'success' });
}

export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
    globalIo = io;
    
    const tickRate = Number(process.env.TICK_RATE ?? 120);
    const intervalMs = Math.max(1, Math.floor(1000 / tickRate));
    
    setInterval(() => handleGameTick(io, fastify), intervalMs);

    io.on('connection', (socket: Socket) =>
    {
        const shouldDisconnect = handleSocketAuthentication(socket, fastify);
        if (shouldDisconnect)
            return;
        
        registerSocketEventListeners(socket, io, fastify);
    });
}
