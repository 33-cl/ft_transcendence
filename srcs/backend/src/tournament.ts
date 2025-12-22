// tournament.ts - Business logic for managing 4-player tournaments

import db from './db.js';
import { emitTournamentStarted, emitMatchFinished, emitTournamentCompleted, emitMatchReady } from './socket/handlers/tournamentHandlers.js';

// Interface for a tournament match
export interface TournamentMatch
{
    id: number;
    tournament_id: string;
    round: number;
    player1_id: number | null;
    player2_id: number | null;
    winner_id: number | null;
    status: 'scheduled' | 'finished' | 'cancelled';
}

// Generates a 4-player tournament bracket (2 semifinals, 1 final)
export function generateBracket(tournamentId: string): void
{
    // Get the 4 participants
    const participants = db.prepare(`
        SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ? 
        ORDER BY joined_at
    `).all(tournamentId) as Array<{ user_id: number }>;

    // Validation: exactly 4 players required
    if (participants.length !== 4)
        throw new Error(`Tournament requires exactly 4 players, got ${participants.length}`);

    // Shuffle participants (Fisher-Yates)
    for (let currentIndex = participants.length - 1; currentIndex > 0; currentIndex--)
    {
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        [participants[currentIndex], participants[randomIndex]] = [participants[randomIndex], participants[currentIndex]];
    }

    // Create 2 semifinals (round 1)
    const insertMatch = db.prepare(`
        INSERT INTO tournament_matches (tournament_id, round, player1_id, player2_id, status)
        VALUES (?, ?, ?, ?, 'scheduled')
    `);
    insertMatch.run(tournamentId, 1, participants[0].user_id, participants[1].user_id);
    insertMatch.run(tournamentId, 1, participants[2].user_id, participants[3].user_id);

    // Create the final (round 2) with empty slots
    insertMatch.run(tournamentId, 2, null, null);

    // Notify participants
    const tournamentMatches = db.prepare(`
        SELECT id, round, player1_id, player2_id 
        FROM tournament_matches 
        WHERE tournament_id = ? 
        ORDER BY round, id
    `).all(tournamentId) as Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>;
    emitTournamentStarted(tournamentId, tournamentMatches);

    // Notify both semifinals as ready
    const semiFinalMatches = tournamentMatches.filter(m => m.round === 1);
    for (const match of semiFinalMatches)
    {
        if (match.player1_id && match.player2_id)
            emitMatchReady(tournamentId, {
                id: match.id,
                round: match.round,
                player1_id: match.player1_id,
                player2_id: match.player2_id
            });
    }
}

// Returns the next match to play in the tournament, or null if all are finished
export function getNextMatch(tournamentId: string): TournamentMatch | null
{
    const match = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? AND status = 'scheduled'
        ORDER BY round ASC, id ASC
        LIMIT 1
    `).get(tournamentId) as TournamentMatch | undefined;
    return match || null;
}

// Records the result of a match and updates the bracket accordingly
export function updateMatchResult(matchId: number, winnerId: number): void
{
    // Get match info
    const match = db.prepare(`
        SELECT * FROM tournament_matches WHERE id = ?
    `).get(matchId) as TournamentMatch | undefined;
    if (!match)
        throw new Error(`Match ${matchId} not found`);
    if (match.status === 'finished')
        throw new Error(`Match ${matchId} is already finished`);
    // Validate winner is a participant
    if (match.player1_id !== winnerId && match.player2_id !== winnerId)
        throw new Error(`Winner ${winnerId} is not a participant of match ${matchId}`);
    // Mark match as finished
    db.prepare(`
        UPDATE tournament_matches 
        SET winner_id = ?, status = 'finished' 
        WHERE id = ?
    `).run(winnerId, matchId);
    // Notify match finished
    emitMatchFinished(match.tournament_id, matchId, winnerId, match.round);
    // Propagate result
    if (match.round === 1)
    {
        advanceWinnerToFinal(match.tournament_id, winnerId);
    }
    else if (match.round === 2)
    {
        declareChampion(match.tournament_id, winnerId);
    }
}

// Advances the winner of a semifinal to the final match
function advanceWinnerToFinal(tournamentId: string, winnerId: number): void
{
    const finalMatch = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? AND round = 2
        LIMIT 1
    `).get(tournamentId) as TournamentMatch | undefined;
    if (!finalMatch)
    {
        return;
    }
    // Add winner to first available slot
    if (finalMatch.player1_id === null)
    {
        db.prepare(`
            UPDATE tournament_matches 
            SET player1_id = ? 
            WHERE id = ?
        `).run(winnerId, finalMatch.id);
    }
    else if (finalMatch.player2_id === null)
    {
        db.prepare(`
            UPDATE tournament_matches 
            SET player2_id = ? 
            WHERE id = ?
        `).run(winnerId, finalMatch.id);
        emitMatchReady(tournamentId, {
            id: finalMatch.id,
            round: 2,
            player1_id: finalMatch.player1_id,
            player2_id: winnerId
        });
    }
}

// Declares the tournament champion and marks the tournament as completed
function declareChampion(tournamentId: string, winnerId: number): void
{
    db.prepare(`
        UPDATE tournaments 
        SET winner_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(winnerId, tournamentId);
    emitTournamentCompleted(tournamentId, winnerId);
}
