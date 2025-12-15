// paddle.ts - Logique de déplacement des paddles

import { GameState } from './gameState.js';

export function movePaddle(
    state: GameState, 
    player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', 
    direction: 'up' | 'down'
): void {
    // Tous les joueurs (y compris l'IA) utilisent la même vitesse de paddle pour l'équité
    // La difficulté IA est contrôlée par le temps de réaction et la marge d'erreur, PAS par la vitesse
    const speed = Math.max(1, Math.floor(state.paddleSpeed));
    
    // Mode 1v1 : paddles[0] = LEFT (gauche), paddles[1] = RIGHT (droite)
    if (state.paddles && state.paddles.length === 2) {
        if (player === 'LEFT') {
            // Paddle LEFT est à l'index 0
            if (direction === 'up') state.paddles[0].y = Math.max(0, state.paddles[0].y - speed);
            else state.paddles[0].y = Math.min(state.canvasHeight - state.paddles[0].height, state.paddles[0].y + speed);
        } else if (player === 'RIGHT') {
            // Paddle RIGHT est à l'index 1
            if (direction === 'up') state.paddles[1].y = Math.max(0, state.paddles[1].y - speed);
            else state.paddles[1].y = Math.min(state.canvasHeight - state.paddles[1].height, state.paddles[1].y + speed);
        }
    }
    // Mode 1v1v1v1 : paddles[0]=LEFT, paddles[1]=DOWN, paddles[2]=RIGHT, paddles[3]=TOP
    else if (state.paddles && state.paddles.length === 4) {
        let paddleIndex = -1;
        if (player === 'LEFT') paddleIndex = 0;
        else if (player === 'DOWN') paddleIndex = 1;
        else if (player === 'RIGHT') paddleIndex = 2;
        else if (player === 'TOP') paddleIndex = 3;
        
        if (paddleIndex !== -1) {
            // Paddle LEFT et RIGHT : verticaux (y bouge)
            if (player === 'LEFT' || player === 'RIGHT') {
                const previousY = state.paddles[paddleIndex].y;
                if (direction === 'up') state.paddles[paddleIndex].y = Math.max(0, state.paddles[paddleIndex].y - speed);
                else state.paddles[paddleIndex].y = Math.min(state.canvasHeight - state.paddles[paddleIndex].height, state.paddles[paddleIndex].y + speed);
                // previousY peut être utilisé pour debug si besoin
            }
            // Paddle DOWN et TOP : horizontaux (x bouge)
            else if (player === 'DOWN' || player === 'TOP') {
                const minX = 0;
                const maxX = state.canvasWidth - state.paddles[paddleIndex].width;
                if (direction === 'up') state.paddles[paddleIndex].x = Math.max(minX, state.paddles[paddleIndex].x - speed); // left
                else state.paddles[paddleIndex].x = Math.min(maxX, state.paddles[paddleIndex].x + speed); // right
            }
        }
    }
}
