// socket/handlers/tournamentHandlers.ts - WebSocket handlers for tournament real-time updates

import { getGlobalIo } from '../socketHandlers.js';

/**
 * Émet un événement quand un joueur rejoint ou quitte un tournoi
 * @param tournamentId - UUID du tournoi
 * @param action - 'joined' ou 'left'
 * @param participant - Données du participant
 */
export function emitTournamentPlayerUpdate(
    tournamentId: string,
    action: 'joined' | 'left',
    participant: { user_id: number; alias: string; current_players: number }
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:player_update', {
        tournament_id: tournamentId,
        action,
        participant,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:player_update (${action}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un tournoi démarre
 * @param tournamentId - UUID du tournoi
 * @param matches - Liste des matchs générés
 */
export function emitTournamentStarted(
    tournamentId: string,
    matches: Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:started', {
        tournament_id: tournamentId,
        matches,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:started for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un match est prêt à être joué
 * @param tournamentId - UUID du tournoi
 * @param match - Données du match
 */
export function emitMatchReady(
    tournamentId: string,
    match: { id: number; round: number; player1_id: number; player2_id: number }
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:match_ready', {
        tournament_id: tournamentId,
        match,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:match_ready (match ${match.id}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un match se termine
 * @param tournamentId - UUID du tournoi
 * @param matchId - ID du match
 * @param winnerId - ID du gagnant
 * @param round - Round du match (1 = semi-final, 2 = final)
 */
export function emitMatchFinished(
    tournamentId: string,
    matchId: number,
    winnerId: number,
    round: number
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:match_finished', {
        tournament_id: tournamentId,
        match_id: matchId,
        winner_id: winnerId,
        round,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:match_finished (match ${matchId}, winner ${winnerId}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un tournoi se termine
 * @param tournamentId - UUID du tournoi
 * @param championId - ID du champion
 */
export function emitTournamentCompleted(
    tournamentId: string,
    championId: number
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:completed', {
        tournament_id: tournamentId,
        champion_id: championId,
        timestamp: new Date().toISOString()
    });

    console.log(`🏆 WebSocket: tournament:completed for tournament ${tournamentId}, champion: ${championId}`);
}

/**
 * Fait rejoindre un socket à une room de tournoi
 * @param socketId - ID du socket
 * @param tournamentId - UUID du tournoi
 */
export function joinTournamentRoom(socketId: string, tournamentId: string): void {
    const io = getGlobalIo();
    if (!io) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.join(`tournament:${tournamentId}`);
    console.log(`🔌 Socket ${socketId} joined tournament room: tournament:${tournamentId}`);
}

/**
 * Fait quitter un socket d'une room de tournoi
 * @param socketId - ID du socket
 * @param tournamentId - UUID du tournoi
 */
export function leaveTournamentRoom(socketId: string, tournamentId: string): void {
    const io = getGlobalIo();
    if (!io) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.leave(`tournament:${tournamentId}`);
    console.log(`🔌 Socket ${socketId} left tournament room: tournament:${tournamentId}`);
}
