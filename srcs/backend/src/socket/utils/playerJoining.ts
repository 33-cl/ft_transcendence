// src/socket/utils/playerJoining.ts

import { Server, Socket } from 'socket.io';
import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';

/**
 * Attribue tous les paddles à un seul socket (jeu local)
 * En jeu local, un seul joueur contrôle tous les paddles
 */
export function assignAllPaddlesToSocket(room: RoomType, socketId: string): void
{
    if (!room.paddleBySocket) room.paddleBySocket = {};
    
    if (room.maxPlayers === 2)
        room.paddleBySocket[socketId] = ['LEFT', 'RIGHT'];
    else if (room.maxPlayers === 4)
        room.paddleBySocket[socketId] = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
}

/**
 * Nettoie les anciennes attributions de paddle
 * Retire les paddles des joueurs qui ne sont plus dans la room
 */
export function purgeOldPaddleAssignments(room: RoomType): void
{
    if (!room.paddleBySocket) return;
    
    for (const id in room.paddleBySocket)
    {
        if (!room.players.includes(id))
            delete room.paddleBySocket[id];
    }
}

/**
 * Trouve un paddle libre pour un joueur en mode 4 joueurs
 */
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

/**
 * Attribue un paddle à un socket selon l'ordre d'arrivée (jeu en ligne)
 */
export function assignPaddleByArrivalOrder(room: RoomType, socketId: string): void
{
    if (!room.paddleBySocket) room.paddleBySocket = {};
    
    // Si déjà attribué, ne rien faire
    if (socketId in room.paddleBySocket) return;
    
    if (room.maxPlayers === 2) {
        // En mode 1v1 (local et non-local) : toujours LEFT=gauche et RIGHT=droite
        const paddles = ['LEFT', 'RIGHT'];
        const idx = room.players.indexOf(socketId);
        room.paddleBySocket[socketId] = paddles[idx] || null;
    } else if (room.maxPlayers === 4) {
        // Attribution dynamique pour 1v1v1v1
        const paddle = assignPaddleToPlayer(room);
        room.paddleBySocket[socketId] = paddle;
    }
}

/**
 * Construit les données de room à envoyer au client
 */
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

/**
 * Broadcast l'état de la room à tous les joueurs
 */
export function broadcastRoomState(room: RoomType, roomName: string, io: Server): void
{
    // Pour les tournois 4 joueurs, toujours envoyer roomJoined pour que tous les joueurs
    // voient l'écran de matchmaking avec le compte de joueurs actuel
    if (room.isTournament && room.maxPlayers === 4) {
        // Envoyer une mise à jour du nombre de joueurs pour le matchmaking
        // Même si la room est pleine, les joueurs doivent savoir qu'ils ont rejoint
        for (const id of room.players) {
            const targetSocket = io.sockets.sockets.get(id);
            if (!targetSocket) continue;
            
            targetSocket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: null,
                spectator: false,
                isTournament: true
            });
        }
        
        if (room.players.length >= room.maxPlayers) {
            console.log(`🏆 Tournament room full - all ${room.players.length} players notified`);
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
