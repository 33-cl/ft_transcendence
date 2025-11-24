// paddle.ts - Logique de déplacement des paddles

import { GameState } from './gameState.js';

// Tiny logger - only logs in dev mode
const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: any[]) => { if (isDev) console.log(...args); };

export function movePaddle(
    state: GameState, 
    player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', 
    direction: 'up' | 'down'
): void {
    log('[BACKEND] movePaddle called:', player, direction, 'paddles.length=', state.paddles?.length);
    
    // ⚖️ Tous les joueurs (y compris l'IA) utilisent la même vitesse de paddle pour l'équité
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
        let idx = -1;
        if (player === 'LEFT') idx = 0;
        else if (player === 'DOWN') idx = 1;
        else if (player === 'RIGHT') idx = 2;
        else if (player === 'TOP') idx = 3;
        
        log(`[BACKEND] Mode 4 joueurs - player=${player}, idx=${idx}, paddles count=${state.paddles.length}`);
        
        if (idx !== -1) {
            // Paddle LEFT et RIGHT : verticaux (y bouge)
            if (player === 'LEFT' || player === 'RIGHT') {
                const oldY = state.paddles[idx].y;
                if (direction === 'up') state.paddles[idx].y = Math.max(0, state.paddles[idx].y - speed);
                else state.paddles[idx].y = Math.min(state.canvasHeight - state.paddles[idx].height, state.paddles[idx].y + speed);
                log(`[BACKEND] Paddle ${player} (vertical) moved from y=${oldY} to y=${state.paddles[idx].y} (direction=${direction})`);
            }
            // Paddle DOWN et TOP : horizontaux (x bouge)
            else if (player === 'DOWN' || player === 'TOP') {
                const minX = 0;
                const maxX = state.canvasWidth - state.paddles[idx].width;
                if (direction === 'up') state.paddles[idx].x = Math.max(minX, state.paddles[idx].x - speed); // left
                else state.paddles[idx].x = Math.min(maxX, state.paddles[idx].x + speed); // right
            }
        } else {
            log(`[BACKEND] ERREUR: Paddle ${player} non trouvé en mode 4 joueurs !`);
        }
    }
}
