// Handles scoring and game end logic for Pong matches

import { GameState } from './gameState.js';
import { BallState } from './ball.js';

// Returns winner and loser info when the game ends
export interface GameEndInfo 
{
    winner: { side: string; score: number };
    loser: { side: string; score: number };
}

// Checks if a point should be scored in 4-player mode
export function checkScoring4Players(state: GameState, ballState: BallState): void 
{
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4 || ballState.pointScored) 
        return;

    if (state.ballX + ballRadius/2 <= 0) 
    {
        if (ballState.lastContact === 1)        paddles[1].score++;
        else if (ballState.lastContact === 2)   paddles[2].score++;
        else if (ballState.lastContact === 3)   paddles[3].score++;
        ballState.pointScored = true;
    }
    else if (state.ballX - ballRadius/2 >= canvasWidth)
    {
        if (ballState.lastContact === 0)       paddles[0].score++;
        else if (ballState.lastContact === 1)  paddles[1].score++;
        else if (ballState.lastContact === 3)  paddles[3].score++;
        ballState.pointScored = true;
    }
    else if (state.ballY - ballRadius/2 >= canvasHeight) 
    {
        if (ballState.lastContact === 0)        paddles[0].score++;
        else if (ballState.lastContact === 2)   paddles[2].score++;
        else if (ballState.lastContact === 3)   paddles[3].score++;
        ballState.pointScored = true;
    }
    else if (state.ballY + ballRadius/2 <= 0) 
    {
        if (ballState.lastContact === 0)        paddles[0].score++;
        else if (ballState.lastContact === 1)   paddles[1].score++;
        else if (ballState.lastContact === 2)   paddles[2].score++;
        ballState.pointScored = true;
    }
}

// Checks if a point should be scored in 2-player mode
export function checkScoring2Players(state: GameState, ballState: BallState): void 
{
    const { canvasWidth, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2 || ballState.pointScored) 
        return;

    if (state.ballX + ballRadius/2 <= 0) 
    {
        paddles[1].score++;
        ballState.pointScored = true;
    }
    else if (state.ballX - ballRadius/2 >= canvasWidth) 
    {
        paddles[0].score++;
        ballState.pointScored = true;
    }
}

// Determines if the game has ended in 4-player mode and returns result
export function checkGameEnd4Players(state: GameState): GameEndInfo | null 
{
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4) 
        return null;

    for (const paddle of paddles) {
        if (paddle.score >= state.win) 
        {
            const winner = paddles.find(paddle => paddle.score >= state.win);
            const losers = paddles.filter(paddle => paddle.score < state.win);
        
            if (winner && losers.length > 0) 
            {
                const loser = losers.reduce((prev, curr) => prev.score < curr.score ? prev : curr);

                return {
                    winner: { side: winner.side, score: winner.score },
                    loser: { side: loser.side, score: loser.score }
                };
            }
        }
    }

    return null;
}

// Determines if the game has ended in 2-player mode and returns result
export function checkGameEnd2Players(state: GameState): GameEndInfo | null {
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2) 
        return null;

    if (paddles[0].score >= state.win || paddles[1].score >= state.win) 
    {
        const winner = paddles[0].score >= state.win ? paddles[0] : paddles[1];
        const loser = paddles[0].score >= state.win ? paddles[1] : paddles[0];

        return {
            winner: { side: winner.side, score: winner.score },
            loser: { side: loser.side, score: loser.score }
        };
    }

    return null;
}
