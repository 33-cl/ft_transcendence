// pongInterpolation.ts
// Système d'interpolation pour fluidifier le mouvement de la balle

// Interface pour les états de jeu avec timestamp
interface GameState {
    timestamp?: number;
    ballX: number;
    ballY: number;
    ballSpeedX?: number;
    ballSpeedY?: number;
    canvasWidth: number;
    canvasHeight: number;
    paddles: {
        x: number;
        y: number;
        width: number;
        height: number;
        side: string;
        score: number;
    }[];
    [key: string]: any; // Pour les autres propriétés
}

// Buffer pour stocker les états de jeu récents
const stateBuffer: GameState[] = [];
const BUFFER_SIZE = 3; // Nombre d'états à conserver pour l'interpolation
const INTERPOLATION_DELAY = 100; // Délai d'interpolation en ms (ajuster selon latence)

let lastRenderTime = 0;
let isRenderLoopRunning = false;

/**
 * Ajoute un nouvel état au buffer et applique un timestamp s'il n'en a pas
 * @param gameState État de jeu à ajouter au buffer
 */
export function addGameState(gameState: GameState): void {
    // Ajouter un timestamp si absent
    if (!gameState.timestamp) {
        gameState.timestamp = Date.now();
    }
    
    // Ajouter l'état au buffer
    stateBuffer.push({...gameState}); // Copie pour éviter les références
    
    // Limiter la taille du buffer
    if (stateBuffer.length > BUFFER_SIZE + 2) { // +2 pour avoir une marge
        stateBuffer.shift();
    }
}

/**
 * Démarre la boucle de rendu avec requestAnimationFrame
 */
export function startRenderLoop(): void {
    if (isRenderLoopRunning) return;
    
    isRenderLoopRunning = true;
    lastRenderTime = performance.now();
    requestAnimationFrame(renderLoop);
}

/**
 * Arrête la boucle de rendu
 */
export function stopRenderLoop(): void {
    isRenderLoopRunning = false;
}

/**
 * Obtient l'état interpolé actuel basé sur le buffer
 * @returns État interpolé ou dernier état disponible
 */
export function getCurrentInterpolatedState(): GameState | null {
    if (stateBuffer.length === 0) {
        return null;
    }
    
    // Si un seul état, le retourner directement
    if (stateBuffer.length === 1) {
        return stateBuffer[0];
    }
    
    // Recherche des deux états entourant le temps cible
    const targetTime = Date.now() - INTERPOLATION_DELAY;
    
    // Trouver les deux états entourant le temps cible
    let state1Index = -1;
    let state2Index = -1;
    
    for (let i = 0; i < stateBuffer.length; i++) {
        if (stateBuffer[i].timestamp! <= targetTime) {
            state1Index = i;
        } else {
            state2Index = i;
            break;
        }
    }
    
    // Si pas d'état avant le temps cible, utiliser les deux premiers
    if (state1Index === -1) {
        state1Index = 0;
        state2Index = Math.min(1, stateBuffer.length - 1);
    }
    
    // Si pas d'état après le temps cible, utiliser les deux derniers
    if (state2Index === -1) {
        state2Index = stateBuffer.length - 1;
        state1Index = Math.max(0, state2Index - 1);
    }
    
    const state1 = stateBuffer[state1Index];
    const state2 = stateBuffer[state2Index];
    
    // Calculer le facteur d'interpolation
    let alpha = 0;
    if (state1.timestamp !== state2.timestamp) {
        alpha = (targetTime - state1.timestamp!) / (state2.timestamp! - state1.timestamp!);
        alpha = Math.max(0, Math.min(1, alpha)); // Clamp entre 0 et 1
    }
    
    // Interpoler entre les deux états
    return interpolateStates(state1, state2, alpha);
}

/**
 * Interpolation entre deux états de jeu
 */
function interpolateStates(state1: GameState, state2: GameState, alpha: number): GameState {
    // Copier les propriétés de base du premier état
    const result: GameState = { ...state1 };
    
    // Interpolation linéaire des positions
    result.ballX = state1.ballX + alpha * (state2.ballX - state1.ballX);
    result.ballY = state1.ballY + alpha * (state2.ballY - state1.ballY);
    
    // Interpolation des positions des raquettes
    result.paddles = state1.paddles.map((paddle, index) => {
        if (index < state2.paddles.length) {
            return {
                ...paddle,
                x: paddle.x + alpha * (state2.paddles[index].x - paddle.x),
                y: paddle.y + alpha * (state2.paddles[index].y - paddle.y)
            };
        }
        return paddle;
    });
    
    return result;
}

/**
 * Boucle de rendu avec requestAnimationFrame
 */
function renderLoop(timestamp: number): void {
    if (!isRenderLoopRunning) return;
    
    // Calculer le temps écoulé
    const deltaTime = timestamp - lastRenderTime;
    lastRenderTime = timestamp;
    
    // Obtenir l'état interpolé actuel
    const currentState = getCurrentInterpolatedState();
    
    // Si on a un état à rendre, appeler la fonction de rendu externe
    if (currentState && (window as any).drawPongGame) {
        (window as any).drawPongGame(currentState);
    }
    
    // Continuer la boucle
    requestAnimationFrame(renderLoop);
}

// Exporter les fonctions vers l'espace global pour les tests
(window as any).addGameState = addGameState;
(window as any).startRenderLoop = startRenderLoop;
(window as any).stopRenderLoop = stopRenderLoop;
