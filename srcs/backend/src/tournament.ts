// tournament.ts - Logique métier pour la gestion des tournois 4 joueurs

import db from './db.js';
import { emitTournamentStarted, emitMatchFinished, emitTournamentCompleted, emitMatchReady } from './socket/handlers/tournamentHandlers.js';

/**
 * Interface pour un match de tournoi
 */
export interface TournamentMatch {
    id: number;
    tournament_id: string;
    round: number;
    player1_id: number | null;
    player2_id: number | null;
    winner_id: number | null;
    status: 'scheduled' | 'finished' | 'cancelled';
}

/**
 * Génère automatiquement le bracket pour un tournoi à 4 joueurs
 * Structure : 2 demi-finales (round 1) + 1 finale (round 2)
 * 
 * @param tournamentId - UUID du tournoi
 * @throws Error si le tournoi n'a pas exactement 4 participants
 */
export function generateBracket(tournamentId: string): void
{
    // 1. Récupérer les 4 participants du tournoi
    const participants = db.prepare(`
        SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ? 
        ORDER BY joined_at
    `).all(tournamentId) as Array<{ user_id: number }>;

    // Validation : exactement 4 joueurs requis
    if (participants.length !== 4) {
        throw new Error(`Tournament requires exactly 4 players, got ${participants.length}`);
    }

    // 2. Mélanger aléatoirement les participants (Fisher-Yates shuffle)
    // Fisher-Yates shuffle (randomize participant order)
    for (let currentIndex = participants.length - 1; currentIndex > 0; currentIndex--) {
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        [participants[currentIndex], participants[randomIndex]] = [participants[randomIndex], participants[currentIndex]];
    }

    // 3. Créer les 2 matchs de demi-finale (round 1)
    const insertMatch = db.prepare(`
        INSERT INTO tournament_matches (tournament_id, round, player1_id, player2_id, status)
        VALUES (?, ?, ?, ?, 'scheduled')
    `);

    // Demi-finale 1 : Joueur A vs Joueur B
    insertMatch.run(tournamentId, 1, participants[0].user_id, participants[1].user_id);
    
    // Demi-finale 2 : Joueur C vs Joueur D
    insertMatch.run(tournamentId, 1, participants[2].user_id, participants[3].user_id);

    // 4. Créer le match de finale (round 2) avec player1_id et player2_id NULL
    // Ils seront remplis automatiquement après les demi-finales
    // Create the final match entry (player slots will be filled after semifinals)
    insertMatch.run(tournamentId, 2, null, null);


    // 5. Émettre un événement WebSocket pour notifier les participants
    const tournamentMatches = db.prepare(`
        SELECT id, round, player1_id, player2_id 
        FROM tournament_matches 
        WHERE tournament_id = ? 
        ORDER BY round, id
    `).all(tournamentId) as Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>;
    emitTournamentStarted(tournamentId, tournamentMatches);

    // Émettre les notifications pour les 2 demi-finales (toutes deux jouables)
    const semiFinalMatches = tournamentMatches.filter(m => m.round === 1);
    for (const match of semiFinalMatches) {
        if (match.player1_id && match.player2_id) {
            emitMatchReady(tournamentId, {
                id: match.id,
                round: match.round,
                player1_id: match.player1_id,
                player2_id: match.player2_id
            });
        }
    }
}

/**
 * Retourne le prochain match à jouer dans le tournoi
 * (le premier match avec status = 'scheduled', trié par round puis id)
 * 
 * @param tournamentId - UUID du tournoi
 * @returns Le prochain match à jouer, ou null si tous les matchs sont terminés
 */
export function getNextMatch(tournamentId: string): TournamentMatch | null {
    const match = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? AND status = 'scheduled'
        ORDER BY round ASC, id ASC
        LIMIT 1
    `).get(tournamentId) as TournamentMatch | undefined;

    return match || null;
}

/**
 * Enregistre le résultat d'un match et met à jour le bracket
 * - Marque le match comme 'finished'
 * - Si c'est une demi-finale : met à jour la finale avec le gagnant
 * - Si c'est la finale : met à jour le tournoi avec le champion
 * 
 * @param matchId - ID du match terminé
 * @param winnerId - ID de l'utilisateur gagnant
 */
export function updateMatchResult(matchId: number, winnerId: number): void {
    // 1. Récupérer les infos du match
    const match = db.prepare(`
        SELECT * FROM tournament_matches WHERE id = ?
    `).get(matchId) as TournamentMatch | undefined;

    if (!match) {
        throw new Error(`Match ${matchId} not found`);
    }

    if (match.status === 'finished') {
        throw new Error(`Match ${matchId} is already finished`);
    }

    // 2. Valider que le gagnant est bien un participant du match
    if (match.player1_id !== winnerId && match.player2_id !== winnerId) {
        throw new Error(`Winner ${winnerId} is not a participant of match ${matchId}`);
    }

    // 3. Marquer le match comme terminé avec le gagnant
    db.prepare(`
        UPDATE tournament_matches 
        SET winner_id = ?, status = 'finished' 
        WHERE id = ?
    `).run(winnerId, matchId);


    // 4. Émettre un événement WebSocket pour notifier la fin du match
    emitMatchFinished(match.tournament_id, matchId, winnerId, match.round);

    // 5. Propager le résultat selon le round
    if (match.round === 1) {
        // C'est une demi-finale → mettre à jour la finale
        advanceWinnerToFinal(match.tournament_id, winnerId);
    } else if (match.round === 2) {
        // C'est la finale → déclarer le champion et terminer le tournoi
        declareChampion(match.tournament_id, winnerId);
    }
}

/**
 * Fait avancer le gagnant d'une demi-finale vers la finale
 * Remplit player1_id ou player2_id dans le match de finale (round 2)
 * 
 * @param tournamentId - UUID du tournoi
 * @param winnerId - ID du gagnant de la demi-finale
 */
function advanceWinnerToFinal(tournamentId: string, winnerId: number): void {
    // Récupérer le match de finale (round 2)
    const finalMatch = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? AND round = 2
        LIMIT 1
    `).get(tournamentId) as TournamentMatch | undefined;

    if (!finalMatch) {
        return;
    }

    // Ajouter le gagnant dans le premier slot disponible (player1 ou player2)
    if (finalMatch.player1_id === null) {
        db.prepare(`
            UPDATE tournament_matches 
            SET player1_id = ? 
            WHERE id = ?
        `).run(winnerId, finalMatch.id);
    } else if (finalMatch.player2_id === null) {
        db.prepare(`
            UPDATE tournament_matches 
            SET player2_id = ? 
            WHERE id = ?
        `).run(winnerId, finalMatch.id);
        
        // Les 2 joueurs sont maintenant assignés → la finale est prête !
        emitMatchReady(tournamentId, {
            id: finalMatch.id,
            round: 2,
            player1_id: finalMatch.player1_id,
            player2_id: winnerId
        });
    }
}

/**
 * Déclare le champion du tournoi et marque le tournoi comme terminé
 * 
 * @param tournamentId - UUID du tournoi
 * @param winnerId - ID du champion
 */
function declareChampion(tournamentId: string, winnerId: number): void {
    db.prepare(`
        UPDATE tournaments 
        SET winner_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(winnerId, tournamentId);


    // Émettre un événement WebSocket pour notifier la fin du tournoi
    emitTournamentCompleted(tournamentId, winnerId);
}
