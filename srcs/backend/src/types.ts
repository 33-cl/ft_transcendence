// types.ts
// Définition centralisée des types pour le backend

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
}
