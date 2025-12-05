// types.ts
// Définition centralisée des types pour le backend

export interface SemifinalMatch {
    player1: string;         // socket.id
    player2: string;         // socket.id
    pongGame?: any;          // Instance PongGame pour ce match
    paddleBySocket: Record<string, string>;  // Mapping socket.id -> paddle
    paddleInputs: Record<string, { up: boolean; down: boolean }>;
    winner?: string;         // socket.id du gagnant
    finished: boolean;
}

export interface TournamentState {
    phase: 'waiting' | 'semifinals' | 'waiting_final' | 'final' | 'completed';
    players: string[];           // Les 4 socket IDs des joueurs
    playerUsernames: Record<string, string>;  // Mapping socket.id -> username
    playerUserIds: Record<string, number>;    // Mapping socket.id -> user_id
    semifinal1?: SemifinalMatch; // Demi-finale 1 (joueurs 0 vs 1)
    semifinal2?: SemifinalMatch; // Demi-finale 2 (joueurs 2 vs 3)
    semifinal1Winner?: string;   // socket.id du gagnant demi-finale 1
    semifinal2Winner?: string;   // socket.id du gagnant demi-finale 2
    finalWinner?: string;        // socket.id du gagnant de la finale
    currentMatch?: {
        player1: string;         // socket.id
        player2: string;         // socket.id
    };
}

export interface RoomType {
    players: string[];
    maxPlayers: number;
    isLocalGame?: boolean;
    paddleBySocket?: any;
    paddleInputs?: any;
    pongGame?: any;
    gameState?: any;
    playerUsernames?: Record<string, string>; // Mapping socket.id -> username for authenticated players
    playerUserIds?: Record<string, number>;   // Mapping socket.id -> user_id for authenticated players
    tournamentId?: string;  // UUID du tournoi (si c'est un match de tournoi)
    matchId?: number;       // ID du match dans le tournoi (si c'est un match de tournoi)
    isTournament?: boolean; // Indique si c'est une room de tournoi
    tournamentState?: TournamentState; // État du tournoi
}
