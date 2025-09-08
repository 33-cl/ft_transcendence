import { PongGame } from './PongGame.js';
import { createAIConfig } from './ai.js';

// Test de l'IA intégrée dans PongGame
console.log('🎮 Test IA intégrée dans PongGame...\n');

// Crée une partie 1v1
const game = new PongGame(2);

// Active l'IA en mode medium
game.state.aiConfig = createAIConfig('medium');
console.log(`✅ IA activée en mode ${game.state.aiConfig.difficulty}`);

// Configure la balle pour qu'elle aille vers l'IA (gauche)
game.state.ballX = 600;
game.state.ballY = 300;
game.state.ballSpeedX = -4; // Va vers la gauche
game.state.ballSpeedY = 3;

// Lance la partie
game.start();

// Force le début immédiat de la balle (skip countdown)
game.state.ballCountdown = 0;
(game as any).isFirstLaunch = false; // Force le bypass du délai initial

console.log('🚀 Partie lancée avec IA (délai désactivé)\n');

// Test pendant 5 secondes
let frameCount = 0;
const testDuration = 5000; // 5 secondes
const startTime = Date.now();

const testInterval = setInterval(() => {
    frameCount++;
    const elapsed = Date.now() - startTime;
    
    // Log toutes les 30 frames (0.5 sec)
    if (frameCount % 30 === 0) {
        const paddle = game.state.paddles[0]; // Paddle IA (gauche)
        const ai = game.state.aiConfig;
        console.log(`⏱️  ${(elapsed/1000).toFixed(1)}s | Frame ${frameCount}`);
        console.log(`   Ball: (${game.state.ballX.toFixed(0)}, ${game.state.ballY.toFixed(0)}) speed:(${game.state.ballSpeedX}, ${game.state.ballSpeedY})`);
        if (ai) {
            console.log(`   IA Paddle: Y=${paddle.y.toFixed(1)}, Target=${ai.targetY.toFixed(1)}, Moving=${ai.isMoving}`);
        }
        console.log('');
    }
    
    if (elapsed >= testDuration) {
        clearInterval(testInterval);
        game.stop();
        console.log('🏁 Test terminé');
        console.log(`📊 Résultat: ${frameCount} frames simulées en ${(elapsed/1000).toFixed(1)}s`);
        process.exit(0);
    }
}, 16); // ~60 FPS
