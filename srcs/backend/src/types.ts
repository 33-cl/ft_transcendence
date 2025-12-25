export interface SemifinalMatch
{
    player1: string;
    player2: string;
    pongGame?: any;
    paddleBySocket: Record<string, string>;
    paddleInputs: Record<string, { up: boolean; down: boolean }>;
    winner?: string;
    finished: boolean;
}

export interface TournamentState
{
    phase: 'waiting' | 'semifinals' | 'waiting_final' | 'final' | 'completed';
    players: string[]; // The 4 socket IDs
    playerUsernames: Record<string, string>; // socket.id -> username
    playerUserIds: Record<string, number>; // socket.id -> user_id
    semifinal1?: SemifinalMatch;
    semifinal2?: SemifinalMatch;
    semifinal1Winner?: string; // socket.id
    semifinal2Winner?: string; // socket.id
    finalWinner?: string; // socket.id
    currentMatch?: {
        player1: string; // socket.id
        player2: string; // socket.id
    };
}

export interface RoomType
{
    players: string[];
    maxPlayers: number;
    isLocalGame?: boolean;
    paddleBySocket?: any;
    paddleInputs?: any;
    pongGame?: any;
    gameState?: any;
    playerUsernames?: Record<string, string>; // socket.id -> username
    playerUserIds?: Record<string, number>; // socket.id -> user_id
    tournamentId?: string; // Tournament UUID
    matchId?: number; // Match ID in tournament
    isTournament?: boolean;
    tournamentState?: TournamentState;
}
