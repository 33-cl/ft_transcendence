// paddle.ts - Logique de déplacement des paddles

import { GameState } from './gameState.js';

export function movePaddle(
    state: GameState, 
    player: 'left' | 'right' | 'A' | 'B' | 'C' | 'D', 
    direction: 'up' | 'down'
): void {
    console.log('[BACKEND] movePaddle called:', player, direction, 'paddles.length=', state.paddles?.length);
    const speed = state.paddleSpeed;
    
    // Mode 1v1 : paddles[0] = A (gauche), paddles[1] = C (droite)
    if (state.paddles && state.paddles.length === 2) {
        if (player === 'left' || player === 'A') {
            // Paddle A est à l'index 0
            if (direction === 'up') state.paddles[0].y = Math.max(0, state.paddles[0].y - speed);
            else state.paddles[0].y = Math.min(state.canvasHeight - state.paddles[0].height, state.paddles[0].y + speed);
        } else if (player === 'right' || player === 'C') {
            // Paddle C est à l'index 1
            if (direction === 'up') state.paddles[1].y = Math.max(0, state.paddles[1].y - speed);
            else state.paddles[1].y = Math.min(state.canvasHeight - state.paddles[1].height, state.paddles[1].y + speed);
        }
    }
    // Mode 1v1v1v1 : paddles[0]=A, paddles[1]=B, paddles[2]=C, paddles[3]=D
    else if (state.paddles && state.paddles.length === 4) {
        let idx = -1;
        if (player === 'A') idx = 0;
        else if (player === 'B') idx = 1;
        else if (player === 'C') idx = 2;
        else if (player === 'D') idx = 3;
        
        console.log(`[BACKEND] Mode 4 joueurs - player=${player}, idx=${idx}, paddles count=${state.paddles.length}`);
        
        if (idx !== -1) {
            // Paddle A et C : verticaux (y bouge)
            if (player === 'A' || player === 'C') {
                const oldY = state.paddles[idx].y;
                if (direction === 'up') state.paddles[idx].y = Math.max(0, state.paddles[idx].y - speed);
                else state.paddles[idx].y = Math.min(state.canvasHeight - state.paddles[idx].height, state.paddles[idx].y + speed);
                console.log(`[BACKEND] Paddle ${player} (vertical) moved from y=${oldY} to y=${state.paddles[idx].y} (direction=${direction})`);
            }
            // Paddle B et D : horizontaux (x bouge)
            else if (player === 'B' || player === 'D') {
                const minX = 0;
                const maxX = state.canvasWidth - state.paddles[idx].width;
                if (direction === 'up') state.paddles[idx].x = Math.max(minX, state.paddles[idx].x - speed); // left
                else state.paddles[idx].x = Math.min(maxX, state.paddles[idx].x + speed); // right
            }
        } else {
            console.log(`[BACKEND] ERREUR: Paddle ${player} non trouvé en mode 4 joueurs !`);
        }
    }
}
