import { Server, Socket } from 'socket.io';
import { RoomType } from '../../types.js';
import { createInitialGameState } from '../../../game/gameState.js';

// Remove player from room (returns true if room is empty)
export function removePlayerFromRoomPlayers(room: RoomType, socketId: string): boolean
{
    room.players = room.players.filter(id => id !== socketId);
    return room.players.length === 0;
}

// Delete local game room (stop game and clear players)
export function deleteLocalGameRoom(room: RoomType): void
{
    if (room.pongGame)
        room.pongGame.stop();
    
    room.players = [];
}

// Delete active game room (stop game, remove all players)
export function deleteActiveGameRoom(room: RoomType, roomName: string, currentSocketId: string, io?: Server): void
{
    room.pongGame?.stop();
    
    if (io)
    {
        for (const socketId of room.players)
        {
            if (socketId !== currentSocketId && io.sockets.sockets.get(socketId))
                io.sockets.sockets.get(socketId)?.leave(roomName);
        }
    }
    
    room.players = [];
}

// Check if game is running in room
export function isGameRunning(room: RoomType): boolean
{
    return !!(room.pongGame && room.pongGame.state && room.pongGame.state.running === true);
}

// Check if game just ended in room
export function isGameEnded(room: RoomType): boolean
{
    return !!(room.pongGame && room.pongGame.state && room.pongGame.state.running === false);
}
