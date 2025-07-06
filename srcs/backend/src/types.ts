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
}
