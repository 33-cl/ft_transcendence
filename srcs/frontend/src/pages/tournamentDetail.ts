import { load } from './utils.js';

// Types pour les données du tournoi
interface TournamentParticipant {
    id: number;
    tournament_id: string;
    user_id: number;
    alias: string;
    joined_at: string;
}
