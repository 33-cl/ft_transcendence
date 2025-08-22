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
}
