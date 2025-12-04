// ========================================
// FORFEIT HANDLING UTILITIES
// Gestion des forfaits (deconnexion pendant partie active)
// ========================================

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getUserByUsername, updateUserStats } from '../../user.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { updateMatchResult } from '../../tournament.js';

// ========================================
// PLAYER INFO RETRIEVAL
// ========================================

/**
 * Recupere les informations du joueur deconnecte
 * 
 * @param room - La room contenant le jeu
 * @param socketId - L'ID du socket deconnecte
 * @returns Les infos du joueur ou null si donnees manquantes
 */
export function getDisconnectedPlayerInfo(
    room: RoomType,
    socketId: string
): { username: string; paddleSide: string } | null
{
    const username = room.playerUsernames?.[socketId];
    const paddleSide = room.paddleBySocket?.[socketId];
    
    if (!username || !paddleSide)
        return null;
    
    return { username, paddleSide };
}

/**
 * Recupere le score du joueur deconnecte
 * 
 * @param room - La room contenant le jeu
 * @param paddleSide - Le cote du paddle du joueur
 * @returns Le score actuel du joueur
 */
export function getPlayerScore(room: RoomType, paddleSide: string): number
{
    const paddles = room.pongGame!.state.paddles;
    const paddle = paddles.find((p: { side: string; score: number }) => p.side === paddleSide);// Trouve le paddle correspondant au cote
    return paddle?.score || 0;
}

// ========================================
// WINNER DETERMINATION
// ========================================

/**
 * Trouve le joueur restant avec le meilleur score (gagnant par forfait)
 * 
 * @param room - La room contenant le jeu
 * @param disconnectedSocketId - L'ID du socket deconnecte a ignorer
 * @returns Les infos du gagnant ou null si non trouve
 */
export function findWinnerAfterForfeit(
    room: RoomType,
    disconnectedSocketId: string
): { side: string; score: number; username: string } | null
{
    let winningSide: string | null = null;// string ou nul et init a null
    let winningScore = -1;
    let winnerUsername: string | null = null;
    
    for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {}))
    {
        if (socketId !== disconnectedSocketId && room.playerUsernames?.[socketId])
        {
            const score = getPlayerScore(room, paddle as string);
            if (score > winningScore)
            {
                winningScore = score;
                winningSide = paddle as string;
                winnerUsername = room.playerUsernames[socketId];
            }
        }
    }
    
    if (!winningSide || !winnerUsername)
        return null;
    
    return {
        side: winningSide,
        score: winningScore,
        username: winnerUsername
    };
}

// ========================================
// MATCH RECORDING
// ========================================

/**
 * Enregistre le match avec victoire par forfait dans la base de donnees
 * 
 * @param winnerUsername - Nom du gagnant
 * @param loserUsername - Nom du perdant
 * @param winnerScore - Score du gagnant
 * @param loserScore - Score du perdant
 * @returns true si enregistre avec succes
 */
export function recordForfeitMatch(
    winnerUsername: string,
    loserUsername: string,
    winnerScore: number,
    loserScore: number
): boolean
{
    const winnerUser = getUserByUsername(winnerUsername) as { id: number } | undefined;
    const loserUser = getUserByUsername(loserUsername) as { id: number } | undefined;
    
    if (!winnerUser || !loserUser || winnerUser.id === loserUser.id)
        return false;
    
    updateUserStats(winnerUser.id, loserUser.id, winnerScore, loserScore, 'online');
    return true;
}

// ========================================
// TOURNAMENT FORFEIT
// ========================================

/**
 * Enregistre le résultat d'un forfait dans un match de tournoi
 * Met à jour le bracket et propage le gagnant au match suivant
 * 
 * @param room - La room contenant le match de tournoi
 * @param winnerSocketId - L'ID du socket du gagnant
 * @param fastify - Instance Fastify
 * @returns true si le résultat a été enregistré
 */
export function recordTournamentForfeit(
    room: RoomType,
    winnerSocketId: string,
    fastify: FastifyInstance
): boolean
{
    // Vérifier que c'est bien un match de tournoi
    if (!room.tournamentId || !room.matchId) {
        return false;
    }
    
    // Récupérer l'userId du gagnant via le mapping playerUserIds
    const winnerUserId = room.playerUserIds?.[winnerSocketId];
    if (!winnerUserId) {
        fastify.log.error(`Tournament forfeit: Could not find userId for winner socket ${winnerSocketId}`);
        return false;
    }
    
    // Enregistrer le résultat du match de tournoi
    try {
        updateMatchResult(room.matchId, winnerUserId);
        fastify.log.info(`✅ Tournament match ${room.matchId} forfeit recorded. Winner: user ${winnerUserId}`);
        return true;
    } catch (error) {
        fastify.log.error(`Error recording tournament forfeit result: ${error}`);
        return false;
    }
}

/**
 * Trouve le socketId du gagnant après un forfait
 * 
 * @param room - La room contenant le jeu
 * @param disconnectedSocketId - L'ID du socket déconnecté
 * @returns Le socketId du gagnant ou null
 */
export function findWinnerSocketId(
    room: RoomType,
    disconnectedSocketId: string
): string | null
{
    for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {}))
    {
        if (socketId !== disconnectedSocketId && room.playerUsernames?.[socketId])
        {
            return socketId;
        }
    }
    return null;
}

// ========================================
// NOTIFICATIONS
// ========================================

/**
 * Envoie l'evenement gameFinished avec le message de forfait
 * 
 * @param io - Instance Socket.IO
 * @param roomName - Nom de la room
 * @param winner - Informations du gagnant
 * @param loser - Informations du perdant
 */
export function notifyGameForfeit(
    io: Server,
    roomName: string,
    winner: { side: string; score: number; username: string },
    loser: { side: string; score: number; username: string }
): void
{
    io.to(roomName).emit('gameFinished', {
        winner,
        loser,
        forfeit: true,
        forfeitMessage: `${loser.username} a quitté la partie - Victoire par forfait !`
    });
}

/**
 * Notifie les amis du changement de statut des deux joueurs
 * 
 * @param globalIo - Instance Socket.IO globale
 * @param winnerUsername - Nom du gagnant
 * @param loserUsername - Nom du perdant
 * @param loserIsOffline - true si le perdant est deconnecte (disconnect), false si juste hors jeu (leaveRoom)
 * @param fastify - Instance Fastify
 */
export function notifyFriendsForfeit(
    globalIo: Server | null,
    winnerUsername: string,
    loserUsername: string,
    loserIsOffline: boolean,
    fastify: FastifyInstance
): void
{
    const winnerUser = getUserByUsername(winnerUsername) as { id: number } | undefined;
    const loserUser = getUserByUsername(loserUsername) as { id: number } | undefined;
    
    if (!winnerUser || !loserUser)
        return;
    
    // Le gagnant revient en ligne
    broadcastUserStatusChange(globalIo, winnerUser.id, 'online', fastify);
    
    // Le perdant : offline si deconnexion, online si juste sortie de partie
    const loserStatus = loserIsOffline ? 'offline' : 'online';
    broadcastUserStatusChange(globalIo, loserUser.id, loserStatus, fastify);
}

// ========================================
// MAIN FORFEIT HANDLER
// ========================================

/**
 * Gere completement un forfait (deconnexion pendant partie active)
 * 
 * Etapes :
 * 1. Recupere les infos du joueur deconnecte
 * 2. Trouve le gagnant (meilleur score parmi les restants)
 * 3. Enregistre le match en DB
 * 4. Notifie tous les joueurs (gameFinished)
 * 5. Notifie les amis du changement de statut
 * 6. Arrete le jeu
 * 
 * @param room - La room contenant le jeu
 * @param roomName - Nom de la room
 * @param socketId - L'ID du socket deconnecte
 * @param io - Instance Socket.IO
 * @param globalIo - Instance Socket.IO globale
 * @param loserIsOffline - true si deconnexion complete (disconnect), false si juste sortie (leaveRoom)
 * @param fastify - Instance Fastify
 */
export function handleForfeit(
    room: RoomType,
    roomName: string,
    socketId: string,
    io: Server,
    globalIo: Server | null,
    loserIsOffline: boolean,
    fastify: FastifyInstance
): void
{
    const disconnectedPlayer = getDisconnectedPlayerInfo(room, socketId);
    if (!disconnectedPlayer)
        return;
    
    const disconnectedScore = getPlayerScore(room, disconnectedPlayer.paddleSide);
    
    const winner = findWinnerAfterForfeit(room, socketId);
    if (!winner)
        return;
    
    // TOURNAMENT FORFEIT: Enregistrer le résultat dans le bracket
    if (room.tournamentId && room.matchId) {
        const winnerSocketId = findWinnerSocketId(room, socketId);
        if (winnerSocketId) {
            recordTournamentForfeit(room, winnerSocketId, fastify);
        }
    }
    
    recordForfeitMatch(
        winner.username,
        disconnectedPlayer.username,
        winner.score,
        disconnectedScore
    );
    
    const loser = {
        side: disconnectedPlayer.paddleSide,
        score: disconnectedScore,
        username: disconnectedPlayer.username
    };
    
    notifyGameForfeit(io, roomName, winner, loser);
    
    notifyFriendsForfeit(
        globalIo,
        winner.username,
        disconnectedPlayer.username,
        loserIsOffline,
        fastify
    );
    
    if (room.pongGame)
        room.pongGame.stop();
}
