
declare module 'jsonwebtoken';

declare interface RoomType {
    players: string[];
    maxPlayers: number;
    isLocalGame?: boolean;
    paddleBySocket?: any;
    paddleInputs?: any;
    pongGame?: any;
    gameState?: any;
    playerUsernames?: Record<string, string>;
    playerUserIds?: Record<string, number>;
    tournamentId?: string;
    matchId?: number;
}
