// Handles paddle movement logic for Pong

import { GameState } from './gameState.js';

// Moves the paddle for a player in the specified direction
export function movePaddle(
    state: GameState, 
    player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', 
    direction: 'up' | 'down'
): void {
    const speed = Math.max(1, Math.floor(state.paddleSpeed));

    if (state.paddles && state.paddles.length === 2) 
    {
        if (player === 'LEFT') 
        {
            if (direction === 'up') 
                state.paddles[0].y = Math.max(0, state.paddles[0].y - speed);
            else 
                state.paddles[0].y = Math.min(state.canvasHeight - state.paddles[0].height, state.paddles[0].y + speed);
        } 
        else if (player === 'RIGHT') 
        {
            if (direction === 'up') 
                state.paddles[1].y = Math.max(0, state.paddles[1].y - speed);
            else 
                state.paddles[1].y = Math.min(state.canvasHeight - state.paddles[1].height, state.paddles[1].y + speed);
        }
    }
    else if (state.paddles && state.paddles.length === 4)
    {
        let paddleIndex = -1;
    
        if (player === 'LEFT')          paddleIndex = 0;
        else if (player === 'DOWN')     paddleIndex = 1;
        else if (player === 'RIGHT')    paddleIndex = 2;
        else if (player === 'TOP')      paddleIndex = 3;
        
        if (paddleIndex !== -1) 
        {  
            if (player === 'LEFT' || player === 'RIGHT') // Vertical movement (y changes)
            {
                if (direction === 'up') 
                    state.paddles[paddleIndex].y = Math.max(0, state.paddles[paddleIndex].y - speed);
                else 
                    state.paddles[paddleIndex].y = Math.min(state.canvasHeight - state.paddles[paddleIndex].height, state.paddles[paddleIndex].y + speed);
            }
            else if (player === 'DOWN' || player === 'TOP') // Horizontal movement (x changes)
            {
                const minX = 0;
                const maxX = state.canvasWidth - state.paddles[paddleIndex].width;

                if (direction === 'up') 
                    state.paddles[paddleIndex].x = Math.max(minX, state.paddles[paddleIndex].x - speed); // left
                else 
                    state.paddles[paddleIndex].x = Math.min(maxX, state.paddles[paddleIndex].x + speed); // right
            }
        }
    }
}
