// ========================================
// GAME END HANDLERS
// Gestion de la fin de partie (local, IA, online)
// ========================================

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getUserByUsername, updateUserStats } from '../../user.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { getGlobalIo } from '../socketHandlers.js';

// ========================================
// LOCAL / AI GAME END
// ========================================

/**
 * Gère la fin d'un jeu local ou contre l'IA
 * Pas de sauvegarde en DB, juste notification
 */
export function handleLocalGameEnd(
    room: RoomType,
    roomName: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    io: Server
): void
{
    if (room && room.players && room.players.length > 0)
    {
        const isAIGame = room.pongGame?.state?.aiConfig?.enabled || false;
        io.to(roomName).emit('gameFinished', {
            winner,
            loser,
            mode: isAIGame ? 'ai' : 'local'
        });
    }
}

// ========================================
// ONLINE GAME END - SOCKET MAPPING
// ========================================

/**
 * Trouve les socketIds du gagnant et du perdant à partir de leurs paddle sides
 */
export function findSocketIdsForWinnerAndLoser(
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number }
): { winnerSocketId: string | null; loserSocketId: string | null }
{
    let winnerSocketId: string | null = null;
    let loserSocketId: string | null = null;

    for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket || {}))
    {
        const controlledSides = Array.isArray(paddleSide) ? paddleSide : [paddleSide];
        
        if (controlledSides.includes(winner.side))
            winnerSocketId = socketId;
        if (controlledSides.includes(loser.side))
            loserSocketId = socketId;
    }

    return { winnerSocketId, loserSocketId };
}

/**
 * Récupère les usernames à partir des socketIds
 */
export function getUsernamesFromSocketIds(
    room: RoomType,
    winnerSocketId: string | null,
    loserSocketId: string | null
): { winnerUsername: string | null; loserUsername: string | null }
{
    const winnerUsername = winnerSocketId ? (room.playerUsernames?.[winnerSocketId] ?? null) : null;
    const loserUsername = loserSocketId ? (room.playerUsernames?.[loserSocketId] ?? null) : null;
    
    return { winnerUsername, loserUsername };
}

// ========================================
// ONLINE GAME END - DATABASE
// ========================================

/**
 * Enregistre les statistiques du match dans la base de données
 * Vérifie que les joueurs sont distincts avant d'enregistrer
 */
export function recordMatchStats(
    winnerUsername: string,
    loserUsername: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number }
): boolean
{
    if (winnerUsername === loserUsername)
        return false;
    
    const winnerUser = getUserByUsername(winnerUsername) as any;
    const loserUser = getUserByUsername(loserUsername) as any;
    
    if (winnerUser && loserUser && winnerUser.id !== loserUser.id)
    {
        updateUserStats(winnerUser.id, loserUser.id, winner.score, loser.score, 'online');
        return true;
    }
    
    return false;
}

// ========================================
// ONLINE GAME END - NOTIFICATIONS
// ========================================

/**
 * Notifie les joueurs et spectateurs de la fin du jeu
 * Envoie des événements différents selon le rôle (joueur/spectateur)
 */
export function notifyPlayersAndSpectators(
    room: RoomType,
    roomName: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    displayWinnerUsername: string,
    displayLoserUsername: string,
    io: Server
): void
{
    if (!room || !room.players || room.players.length === 0)
        return;
    
    const connectedSockets = Array.from(io.sockets.adapter.rooms.get(roomName) || []) as string[];
    const spectators = connectedSockets.filter(socketId => !room.players.includes(socketId));
    
    // Notifier les joueurs
    for (const socketId of room.players)
    {
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket)
        {
            playerSocket.emit('gameFinished', {
                winner: { ...winner, username: displayWinnerUsername },
                loser: { ...loser, username: displayLoserUsername },
                isPlayer: true
            });
        }
    }
    
    // Notifier les spectateurs
    for (const socketId of spectators)
    {
        const spectatorSocket = io.sockets.sockets.get(socketId);
        if (spectatorSocket)
        {
            spectatorSocket.emit('spectatorGameFinished', {
                winner: { ...winner, username: displayWinnerUsername },
                loser: { ...loser, username: displayLoserUsername },
                isSpectator: true
            });
        }
    }
}

/**
 * Notifie les amis que les joueurs ne sont plus en jeu
 * Met à jour leur statut à 'online'
 */
export function notifyFriendsGameEnded(room: RoomType, fastify: FastifyInstance): void
{
    if (!room.playerUsernames)
        return;

    for (const [socketId, username] of Object.entries(room.playerUsernames))
    {
        if (room.players.includes(socketId))
        {
            const user = getUserByUsername(username) as any;
            if (user)
                broadcastUserStatusChange(getGlobalIo(), user.id, 'online', fastify);
        }
    }
}

// ========================================
// MAIN HANDLER
// ========================================

/**
 * Point d'entrée principal pour la gestion de fin de partie
 * Dirige vers le bon handler selon le type de jeu (local/online)
 */
export function handleGameEnd(
    roomName: string,
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    fastify: FastifyInstance,
    io: Server
): void
{
    // Jeux locaux/IA : pas de stats
    if (room.isLocalGame)
    {
        handleLocalGameEnd(room, roomName, winner, loser, io);
        return;
    }
    
    // Jeux online : validation des données
    if (!room.playerUsernames || !room.paddleBySocket)
        return;

    // Résolution des joueurs
    const { winnerSocketId, loserSocketId } = findSocketIdsForWinnerAndLoser(room, winner, loser);
    const { winnerUsername, loserUsername } = getUsernamesFromSocketIds(room, winnerSocketId, loserSocketId);
    
    // Fallback pour l'affichage
    const displayWinnerUsername = winnerUsername || winner.side;
    const displayLoserUsername = loserUsername || loser.side;

    // Enregistrement en DB si possible
    if (winnerUsername && loserUsername)
        recordMatchStats(winnerUsername, loserUsername, winner, loser);

    // Notifications
    notifyPlayersAndSpectators(room, roomName, winner, loser, displayWinnerUsername, displayLoserUsername, io);
    notifyFriendsGameEnded(room, fastify);
}
