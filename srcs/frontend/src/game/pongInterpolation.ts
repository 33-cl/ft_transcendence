// pongInterpolation.ts
// Système de rendu pour le jeu Pong
// À 120 FPS serveur, on affiche simplement l'état le plus récent

// Interface pour les états de jeu avec timestamp
interface GameState {
    timestamp?: number;
    ballX: number;
    ballY: number;
    ballSpeedX?: number;
    ballSpeedY?: number;
    ballRadius?: number;
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

// Dernier état reçu du serveur
let latestState: GameState | null = null;

let isRenderLoopRunning = false;

/**
 * Ajoute un nouvel état (remplace simplement le précédent)
 * @param gameState État de jeu reçu du serveur
 */
export function addGameState(gameState: GameState): void {
    latestState = {...gameState};
}

/**
 * Démarre la boucle de rendu avec requestAnimationFrame
 */
export function startRenderLoop(): void {
    if (isRenderLoopRunning) return;
    
    isRenderLoopRunning = true;
    requestAnimationFrame(renderLoop);
}

/**
 * Arrête la boucle de rendu
 */
export function stopRenderLoop(): void {
    isRenderLoopRunning = false;
    latestState = null;
}

/**
 * Obtient le dernier état reçu
 * @returns Dernier état ou null
 */
export function getCurrentInterpolatedState(): GameState | null {
    return latestState;
}

/**
 * Boucle de rendu avec requestAnimationFrame
 */
function renderLoop(_timestamp: number): void {
    if (!isRenderLoopRunning) return;
    
    // Obtenir le dernier état
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
