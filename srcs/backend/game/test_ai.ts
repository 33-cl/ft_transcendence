import { createAIConfig, predictBallLanding, updateAITarget, movePaddleWithLerp } from './ai.js';
import { GameState } from './gameState.js';

// Simule un état de jeu minimal pour tester l'IA
const state: GameState = {
    canvasHeight: 650,
    canvasWidth: 850,
    paddleHeight: 110,
    paddleWidth: 10,
    paddleMargin: 10,
    paddles: [{ x: 10, y: 325, width: 10, height: 110, side: 'A', score: 0 }, { x: 830, y: 325, width: 10, height: 110, side: 'C', score: 0 }],
    paddleSpeed: 20,
    ballX: 400,
    ballY: 300,
    ballRadius: 15,
    ballSpeedX: -5, // Va vers la gauche (IA)
    ballSpeedY: 2,
    win: 3,
    running: true,
    ballCountdown: 0,
    aiConfig: undefined,
};

// Initialise l'IA en mode medium
state.aiConfig = createAIConfig('medium');

// Test de la prédiction
console.log('Prédiction Y:', predictBallLanding(state));

// Test de la logique IA sur plusieurs frames
(async () => {
    for (let frame = 0; frame < 120; frame++) { // 2 secondes à 60 FPS
        if (frame % 60 === 0) updateAITarget(state); // 1x/seconde
        movePaddleWithLerp(state);
        if (state.aiConfig) {
            console.log(`Frame ${frame}: paddleY=${state.paddles[0].y.toFixed(2)}, targetY=${state.aiConfig.targetY.toFixed(2)}, isMoving=${state.aiConfig.isMoving}`);
        } else {
            console.log(`Frame ${frame}: paddleY=${state.paddles[0].y.toFixed(2)}, aiConfig=undefined`);
        }
        // Simule un déplacement de la balle pour voir l'adaptation
        state.ballX -= 5;
        state.ballY += 2;
        await new Promise(r => setTimeout(r, 16)); // Simule 60 FPS (optionnel)
    }
})();
