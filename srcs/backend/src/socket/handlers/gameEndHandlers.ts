// ========================================
// GAME END HANDLERS
// Gestion de la fin de partie (local, IA, online)
// ========================================

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getUserByUsername, updateUserStats } from '../../user.js';
import { broadcastUserStatusChange, broadcastLeaderboardUpdate } from '../notificationHandlers.js';
import { getGlobalIo } from '../socketHandlers.js';
import { updateMatchResult } from '../../tournament.js';
import db from '../../db.js';

// ========================================
// TOURNAMENT MATCH END
// ========================================

/**
 * Enregistre automatiquement le résultat d'un match de tournoi
 * Appelée quand un match Pong de tournoi se termine
 */
async function handleTournamentMatchEnd(
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    fastify: FastifyInstance
): Promise<void> {
    try {
        // Vérification de sécurité TypeScript
        if (!room.matchId || !room.tournamentId) {
            fastify.log.error('Tournament match end called without matchId or tournamentId');
            return;
        }

        // 1. Récupérer les infos du match
        const match = db.prepare(`
            SELECT player1_id, player2_id FROM tournament_matches 
            WHERE id = ? AND tournament_id = ?
        `).get(room.matchId, room.tournamentId) as any;

        if (!match) {
            fastify.log.error(`Tournament match not found: ${room.matchId}`);
            return;
        }

        // 2. Déterminer le gagnant (participant_id) en fonction du paddle side
        const { winnerSocketId } = findSocketIdsForWinnerAndLoser(room, winner, loser);
        if (!winnerSocketId) {
            fastify.log.error('Could not determine winner socket');
            return;
        }

        // 3. Get winner's userId from playerUserIds mapping (set when player joins room)
        const winnerUserId = room.playerUserIds?.[winnerSocketId];
        if (!winnerUserId) {
            fastify.log.error(`Could not find userId for winner socket ${winnerSocketId}`);
            return;
        }

        // 4. Validate that the winner is indeed a participant of this match
        if (winnerUserId !== match.player1_id && winnerUserId !== match.player2_id) {
            fastify.log.error(`Winner userId ${winnerUserId} is not a participant of match ${room.matchId}`);
            return;
        }

        // 5. Enregistrer le résultat via la fonction existante
        updateMatchResult(room.matchId, winnerUserId);

        fastify.log.info(`✅ Tournament match ${room.matchId} result recorded. Winner: user ${winnerUserId}`);
    } catch (error) {
        fastify.log.error(`Error recording tournament match result: ${error}`);
    }
}

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
        const numPlayers = room.maxPlayers || 2;
        io.to(roomName).emit('gameFinished', {
            winner,
            loser,
            mode: isAIGame ? 'ai' : 'local',
            numPlayers
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
    const numPlayers = room.maxPlayers || 2;
    
    // Notifier les joueurs
    for (const socketId of room.players)
    {
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket)
        {
            playerSocket.emit('gameFinished', {
                winner: { ...winner, username: displayWinnerUsername },
                loser: { ...loser, username: displayLoserUsername },
                isPlayer: true,
                numPlayers
            });
        }
    }
    
    // Notifier les spectateurs
    // En mode 4 joueurs, envoyer gameFinished pour qu'ils voient le même overlay
    // En mode 1v1, envoyer spectatorGameFinished pour l'écran spectateur dédié
    for (const socketId of spectators)
    {
        const spectatorSocket = io.sockets.sockets.get(socketId);
        if (spectatorSocket)
        {
            if (numPlayers === 4) {
                // Mode 4 joueurs : même overlay que les joueurs
                spectatorSocket.emit('gameFinished', {
                    winner: { ...winner, username: displayWinnerUsername },
                    loser: { ...loser, username: displayLoserUsername },
                    isSpectator: true,
                    numPlayers
                });
            } else {
                // Mode 1v1 : écran spectateur dédié
                spectatorSocket.emit('spectatorGameFinished', {
                    winner: { ...winner, username: displayWinnerUsername },
                    loser: { ...loser, username: displayLoserUsername },
                    isSpectator: true,
                    numPlayers
                });
            }
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
export async function handleGameEnd(
    roomName: string,
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    fastify: FastifyInstance,
    io: Server
): Promise<void>
{
    // Jeux locaux/IA : pas de stats
    if (room.isLocalGame)
    {
        handleLocalGameEnd(room, roomName, winner, loser, io);
        return;
    }
    
    // TOURNAMENT MATCH: Enregistrer automatiquement le résultat
    if (room.tournamentId && room.matchId) {
        await handleTournamentMatchEnd(room, winner, loser, fastify);
        // Continue pour notifier les joueurs normalement
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
    {
        const statsRecorded = recordMatchStats(winnerUsername, loserUsername, winner, loser);
        
        // Broadcast leaderboard update to all clients if stats were recorded
        // Only for 1v1 online matches (maxPlayers === 2) that are NOT tournament matches
        // Tournament matches have their own ranking system and don't affect the global leaderboard
        const isTournamentMatch = room.tournamentId && room.matchId;
        
        fastify.log.info(`[LEADERBOARD DEBUG] statsRecorded=${statsRecorded}, maxPlayers=${room.maxPlayers}, isTournament=${!!isTournamentMatch}`);
        
        if (statsRecorded && room.maxPlayers === 2 && !isTournamentMatch) {
            fastify.log.info(`[LEADERBOARD] Broadcasting leaderboard update after 1v1 match`);
            broadcastLeaderboardUpdate(io, 0, {}, fastify); // userId 0 = game end, no specific user
        }
    }

    // Notifications
    notifyPlayersAndSpectators(room, roomName, winner, loser, displayWinnerUsername, displayLoserUsername, io);
    notifyFriendsGameEnded(room, fastify);
}
