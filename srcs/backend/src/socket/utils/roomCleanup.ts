// src/socket/utils/roomCleanup.ts

import { Server, Socket } from 'socket.io';
import { RoomType } from '../../types.js';
import { createInitialGameState } from '../../../game/gameState.js';

/**
 * Retire un joueur d'une room spécifique
 * @returns true si la room est maintenant vide, false sinon
 */
export function removePlayerFromRoomPlayers(room: RoomType, socketId: string): boolean
{
    room.players = room.players.filter(id => id !== socketId);//garde tous les id diff de celui qu on veut retirer
    return room.players.length === 0;
}

/**
 * Supprime complètement une room locale (jeu local)
 * - Arrête le jeu en cours
 * - Vide le tableau players
 * 
 * Note: Pour un jeu local, il n'y a qu'1 seul socket qui contrôle tous les paddles.
 * Le joueur est déjà retiré avant cet appel par removePlayerFromRoomPlayers().
 */
export function deleteLocalGameRoom(room: RoomType): void
{
    if (room.pongGame)
        room.pongGame.stop();
    //ICI ON A VIRE UN TRUC PTET IMPORTANT
    // Vider la room complètement
    room.players = [];
}

/**
 * Supprime une room avec jeu en cours (ranked/online)
 * - Arrête le jeu
 * - Retire tous les autres joueurs via socket.io
 * - Vide le tableau players
 */
export function deleteActiveGameRoom(room: RoomType, roomName: string, currentSocketId: string, io?: Server): void
{
    // Arrêter le jeu
    room.pongGame?.stop();
    
    // Retirer tous les joueurs restants via leurs sockets
    if (io)
    {
        for (const socketId of room.players)
        {
            // Ne pas retirer le socket actuel, c'est déjà fait
            if (socketId !== currentSocketId && io.sockets.sockets.get(socketId))
                io.sockets.sockets.get(socketId)?.leave(roomName);
        }
    }
    
    // Vider la room complètement
    room.players = [];
}

/**
 * Vérifie si un jeu est en cours dans la room
 */
export function isGameRunning(room: RoomType): boolean
{
    return !!(room.pongGame && room.pongGame.state && room.pongGame.state.running === true);
}

/**
 * Vérifie si un jeu vient de se terminer dans la room
 */
export function isGameEnded(room: RoomType): boolean
{
    return !!(room.pongGame && room.pongGame.state && room.pongGame.state.running === false);
}
