// score.ts - Gestion du score et attribution des points

import { GameState } from './gameState.js';
import { BallState } from './ball.js';

export interface GameEndInfo {
    winner: { side: string; score: number };
    loser: { side: string; score: number };
}

export function checkScoring4Players(state: GameState, ballState: BallState): void {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4 || ballState.pointScored) return;

    // Comptabiliser le point quand la MOITIÉ de la balle est sortie, mais seulement UNE FOIS
    
    // Si la moitié de la balle sort par le côté gauche - joueur A éliminé
    if (state.ballX + ballRadius/2 <= 0) {
        if (ballState.lastContact === 1) paddles[1].score++; // B gagne
        else if (ballState.lastContact === 2) paddles[2].score++; // C gagne
        else if (ballState.lastContact === 3) paddles[3].score++; // D gagne
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
    // Si la moitié de la balle sort par le côté droit - joueur C éliminé
    else if (state.ballX - ballRadius/2 >= canvasWidth) {
        if (ballState.lastContact === 0) paddles[0].score++; // A gagne
        else if (ballState.lastContact === 1) paddles[1].score++; // B gagne
        else if (ballState.lastContact === 3) paddles[3].score++; // D gagne
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
    // Si la moitié de la balle sort par le bas - joueur B éliminé
    else if (state.ballY - ballRadius/2 >= canvasHeight) {
        if (ballState.lastContact === 0) paddles[0].score++; // A gagne
        else if (ballState.lastContact === 2) paddles[2].score++; // C gagne
        else if (ballState.lastContact === 3) paddles[3].score++; // D gagne
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
    // Si la moitié de la balle sort par le haut - joueur D éliminé
    else if (state.ballY + ballRadius/2 <= 0) {
        if (ballState.lastContact === 0) paddles[0].score++; // A gagne
        else if (ballState.lastContact === 1) paddles[1].score++; // B gagne
        else if (ballState.lastContact === 2) paddles[2].score++; // C gagne
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
}

export function checkScoring2Players(state: GameState, ballState: BallState): void {
    const { canvasWidth, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2 || ballState.pointScored) return;

    // Comptabiliser le point quand la MOITIÉ de la balle est sortie, mais seulement UNE FOIS
    
    // But à gauche - la moitié de la balle sort par la gauche
    if (state.ballX + ballRadius/2 <= 0) {
        paddles[1].score++;
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
    // But à droite - la moitié de la balle sort par la droite
    else if (state.ballX - ballRadius/2 >= canvasWidth) {
        paddles[0].score++;
        ballState.pointScored = true; // Marquer qu'un point a été attribué
    }
}

export function checkGameEnd4Players(state: GameState): GameEndInfo | null {
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4) return null;

    // Fin de partie si un joueur atteint le score cible
    for (const p of paddles) {
        if (p.score >= state.win) {
            // Find winner and loser for 1v1v1 mode
            const winner = paddles.find(paddle => paddle.score >= state.win);
            const losers = paddles.filter(paddle => paddle.score < state.win);
            if (winner && losers.length > 0) {
                // For 1v1v1, we'll pick the loser with the lowest score
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

export function checkGameEnd2Players(state: GameState): GameEndInfo | null {
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2) return null;

    // Arrêt de la partie si un joueur atteint le score de victoire
    if (paddles[0].score >= state.win || paddles[1].score >= state.win) {
        const winner = paddles[0].score >= state.win ? paddles[0] : paddles[1];
        const loser = paddles[0].score >= state.win ? paddles[1] : paddles[0];
        return {
            winner: { side: winner.side, score: winner.score },
            loser: { side: loser.side, score: loser.score }
        };
    }
    return null;
}
