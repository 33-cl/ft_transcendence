import { load } from './utils.js';

// Types pour les données du tournoi
interface TournamentParticipant {
    id: number;
    tournament_id: string;
    user_id: number;
    alias: string;
    joined_at: string;
}

interface TournamentMatch {
    id: number;
    tournament_id: string;
    round: number;
    player1_id: number | null;
    player2_id: number | null;
    winner_id: number | null;
    status: 'scheduled' | 'finished' | 'cancelled';
    scheduled_at: string | null;
}

interface Tournament {
    id: string;
    name: string;
    status: 'registration' | 'active' | 'completed' | 'cancelled';
    max_players: number;
    current_players: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}
