// pongInterpolation.ts
// Système d'interpolation simple pour fluidifier le mouvement de la balle

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

// Buffer pour stocker les états de jeu récents
const stateBuffer: GameState[] = [];
const BUFFER_SIZE = 6; // 6 états (~50ms d'historique à 120Hz)

let isRenderLoopRunning = false;

// Seuil pour détecter une téléportation (reset de balle)
const TELEPORT_THRESHOLD = 0.2; // 20% de la taille du canvas

/**
 * Détecte si la balle s'est téléportée (reset après un point)
 */
function detectTeleport(oldState: GameState, newState: GameState): boolean {
    const dx = Math.abs(newState.ballX - oldState.ballX);
    const dy = Math.abs(newState.ballY - oldState.ballY);
    const threshold = Math.max(newState.canvasWidth, newState.canvasHeight) * TELEPORT_THRESHOLD;
    return dx > threshold || dy > threshold;
}

/**
 * Ajoute un nouvel état au buffer et applique un timestamp s'il n'en a pas
 * @param gameState État de jeu à ajouter au buffer
 */
export function addGameState(gameState: GameState): void {
    // Ajouter un timestamp si absent
    if (!gameState.timestamp) {
        gameState.timestamp = Date.now();
    }
    
    // Détecter téléportation (reset de balle) - vider le buffer pour éviter interpolation
    if (stateBuffer.length > 0) {
        const lastState = stateBuffer[stateBuffer.length - 1];
        if (lastState && detectTeleport(lastState, gameState)) {
            stateBuffer.length = 0; // Clear buffer on teleport
        }
    }
    
    // Ajouter l'état au buffer
    stateBuffer.push({...gameState}); // Copie pour éviter les références
    
    // Limiter la taille du buffer
    while (stateBuffer.length > BUFFER_SIZE) {
        stateBuffer.shift();
    }
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
    stateBuffer.length = 0;
}

/**
 * Obtient l'état interpolé actuel basé sur le buffer
 * Utilise l'extrapolation depuis le dernier état pour une animation fluide
 * @returns État interpolé ou dernier état disponible
 */
export function getCurrentInterpolatedState(): GameState | null {
    if (stateBuffer.length === 0) {
        return null;
    }
    
    // Utiliser le dernier état et extrapoler la position de la balle
    const latestState = stateBuffer[stateBuffer.length - 1];
    if (!latestState) {
        return null;
    }
    
    // Si on n'a pas de vitesse ou pas de timestamp, retourner l'état tel quel
    if (!latestState.timestamp || latestState.ballSpeedX === undefined || latestState.ballSpeedY === undefined) {
        return latestState;
    }
    
    // Calculer le temps écoulé depuis le dernier état
    const now = Date.now();
    const timeSinceLastState = now - latestState.timestamp;
    
    // Limiter l'extrapolation à 100ms max pour éviter les dérives
    const extrapolationTime = Math.min(timeSinceLastState, 100);
    
    // Copier l'état et extrapoler la position de la balle
    const result: GameState = { ...latestState };
    
    // Extrapoler la position basée sur la vitesse (conversion ms -> s)
    result.ballX = latestState.ballX + latestState.ballSpeedX * (extrapolationTime / 1000);
    result.ballY = latestState.ballY + latestState.ballSpeedY * (extrapolationTime / 1000);
    
    // Garder la balle dans le canvas
    result.ballX = Math.max(0, Math.min(result.canvasWidth, result.ballX));
    result.ballY = Math.max(0, Math.min(result.canvasHeight, result.ballY));
    
    // Copier les paddles sans modification (ils sont déjà à jour)
    result.paddles = [...latestState.paddles];
    
    return result;
}

/**
 * Boucle de rendu avec requestAnimationFrame
 */
function renderLoop(_timestamp: number): void {
    if (!isRenderLoopRunning) return;
    
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
