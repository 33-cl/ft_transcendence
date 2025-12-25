import { Server, Socket } from 'socket.io';
import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';

// Assign all paddles to single socket (local game)
export function assignAllPaddlesToSocket(room: RoomType, socketId: string): void
{
    if (!room.paddleBySocket)
        room.paddleBySocket = {};
    
    if (room.maxPlayers === 2)
        room.paddleBySocket[socketId] = ['LEFT', 'RIGHT'];
    else if (room.maxPlayers === 4)
        room.paddleBySocket[socketId] = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
}

// Remove paddle assignments for players no longer in room
export function purgeOldPaddleAssignments(room: RoomType): void
{
    if (!room.paddleBySocket)
        return;
    
    for (const id in room.paddleBySocket)
    {
        if (!room.players.includes(id))
            delete room.paddleBySocket[id];
    }
}

// Find free paddle for player in 4-player mode
export function assignPaddleToPlayer(room: RoomType): PaddleSide | null
{
    const paddleSides: PaddleSide[] = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
    for (const side of paddleSides.slice(0, room.maxPlayers))
    {
        if (!room.paddleBySocket || !Object.values(room.paddleBySocket).includes(side))
            return side;
    }
    return null;
}

// Assign paddle to socket by arrival order (online game)
export function assignPaddleByArrivalOrder(room: RoomType, socketId: string): void
{
    if (!room.paddleBySocket)
        room.paddleBySocket = {};
    
    if (socketId in room.paddleBySocket)
        return;
    
    if (room.maxPlayers === 2)
    {
        const paddles = ['LEFT', 'RIGHT'];
        const idx = room.players.indexOf(socketId);
        room.paddleBySocket[socketId] = paddles[idx] || null;
    }
    else if (room.maxPlayers === 4)
    {
        const paddle = assignPaddleToPlayer(room);
        room.paddleBySocket[socketId] = paddle;
    }
}

// Build room data to send to client
export function buildRoomJoinedData(room: RoomType, roomName: string, socketId: string)
{
    return {
        room: roomName,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        paddle: room.paddleBySocket?.[socketId],
        isTournament: room.isTournament || false
    };
}

// Broadcast room state to all players
export function broadcastRoomState(room: RoomType, roomName: string, io: Server): void
{
    if (room.isTournament && room.maxPlayers === 4)
    {
        for (const id of room.players)
        {
            const targetSocket = io.sockets.sockets.get(id);
            if (!targetSocket)
                continue;
            
            targetSocket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: null,
                spectator: false,
                isTournament: true
            });
        }
        
        return;
    }
    
    for (const id of room.players)
    {
        const targetSocket = io.sockets.sockets.get(id);
        if (!targetSocket)
            continue;
        
        targetSocket.emit('roomJoined', buildRoomJoinedData(room, roomName, id));
    }
}
