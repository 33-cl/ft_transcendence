// pongInterpolation.ts
// Systeme d'interpolation et extrapolation pour le jeu Pong
// Lisse le mouvement de la balle entre les etats recus du serveur

// Interface pour les etats de jeu avec timestamp
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
    [key: string]: any;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Delai de rendu en ms (buffer pour absorber le jitter reseau)
// Plus eleve = plus fluide mais plus de latence visuelle
const RENDER_DELAY_MS = 50;

// Nombre max d'etats dans le buffer
const MAX_BUFFER_SIZE = 10;

// Duree max d'extrapolation en ms (au dela on freeze)
const MAX_EXTRAPOLATION_MS = 100;

// ============================================================================
// ETAT DU MODULE
// ============================================================================

// Buffer circulaire des etats recus (tries par timestamp)
let stateBuffer: GameState[] = [];

// Dernier etat interpole/extrapole (pour le rendu)
let currentRenderState: GameState | null = null;

// Offset entre le temps client et serveur (approximatif)
let serverTimeOffset = 0;

// Flag pour la boucle de rendu
let isRenderLoopRunning = false;

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

// Retourne le temps serveur estime
function getServerTime(): number {
    return Date.now() + serverTimeOffset;
}

// Interpole lineairement entre deux valeurs
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// Clone un etat de jeu
function cloneState(state: GameState): GameState {
    return {
        ...state,
        paddles: state.paddles.map(p => ({ ...p }))
    };
}

// ============================================================================
// GESTION DU BUFFER
// ============================================================================

/**
 * Ajoute un nouvel etat au buffer
 * Maintient le buffer trie par timestamp et limite sa taille
 */
export function addGameState(gameState: GameState): void {
    // S'assurer que l'etat a un timestamp
    if (!gameState.timestamp) {
        gameState.timestamp = Date.now();
    }
    
    // Mettre a jour l'offset serveur (moyenne glissante simple)
    const now = Date.now();
    const newOffset = gameState.timestamp - now;
    serverTimeOffset = serverTimeOffset * 0.9 + newOffset * 0.1;
    
    // Ajouter au buffer
    const newState = cloneState(gameState);
    stateBuffer.push(newState);
    
    // Trier par timestamp (normalement deja trie mais securite)
    stateBuffer.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Limiter la taille du buffer
    while (stateBuffer.length > MAX_BUFFER_SIZE) {
        stateBuffer.shift();
    }
}

/**
 * Trouve les deux etats encadrant un timestamp donne
 * Retourne [etatAvant, etatApres, ratio] ou null
 */
function findInterpolationStates(targetTime: number): [GameState, GameState, number] | null {
    if (stateBuffer.length < 2) {
        return null;
    }
    
    // Chercher les deux etats encadrant targetTime
    for (let i = 0; i < stateBuffer.length - 1; i++) {
        const before = stateBuffer[i]!;
        const after = stateBuffer[i + 1]!;
        const beforeTime = before.timestamp || 0;
        const afterTime = after.timestamp || 0;
        
        if (beforeTime <= targetTime && targetTime <= afterTime) {
            const duration = afterTime - beforeTime;
            const ratio = duration > 0 ? (targetTime - beforeTime) / duration : 0;
            return [before, after, Math.max(0, Math.min(1, ratio))];
        }
    }
    
    return null;
}

// ============================================================================
// INTERPOLATION / EXTRAPOLATION
// ============================================================================

/**
 * Interpole entre deux etats de jeu
 */
function interpolateStates(before: GameState, after: GameState, t: number): GameState {
    const result = cloneState(before);
    
    // Interpoler la position de la balle
    result.ballX = lerp(before.ballX, after.ballX, t);
    result.ballY = lerp(before.ballY, after.ballY, t);
    
    // Interpoler les paddles
    for (let i = 0; i < result.paddles.length && i < after.paddles.length; i++) {
        result.paddles[i]!.x = lerp(before.paddles[i]!.x, after.paddles[i]!.x, t);
        result.paddles[i]!.y = lerp(before.paddles[i]!.y, after.paddles[i]!.y, t);
        // Scores: pas d'interpolation, prendre la valeur la plus recente
        result.paddles[i]!.score = after.paddles[i]!.score;
    }
    
    // Copier les vitesses de l'etat le plus recent (pour extrapolation future)
    if (after.ballSpeedX !== undefined) result.ballSpeedX = after.ballSpeedX;
    if (after.ballSpeedY !== undefined) result.ballSpeedY = after.ballSpeedY;
    
    return result;
}

/**
 * Extrapole un etat dans le futur en utilisant les vitesses
 */
function extrapolateState(baseState: GameState, deltaMs: number): GameState {
    const result = cloneState(baseState);
    
    // Limiter l'extrapolation
    const limitedDelta = Math.min(deltaMs, MAX_EXTRAPOLATION_MS);
    const deltaSeconds = limitedDelta / 1000;
    
    // Extrapoler la balle avec sa vitesse
    // Note: les vitesses sont en pixels par frame a 60 FPS
    const speedMultiplier = 60; // Conversion vers pixels/seconde
    if (result.ballSpeedX !== undefined && result.ballSpeedY !== undefined) {
        result.ballX += result.ballSpeedX * speedMultiplier * deltaSeconds;
        result.ballY += result.ballSpeedY * speedMultiplier * deltaSeconds;
        
        // Borner dans le canvas (simple, sans rebond)
        const radius = result.ballRadius || 15;
        result.ballX = Math.max(radius, Math.min(result.canvasWidth - radius, result.ballX));
        result.ballY = Math.max(radius, Math.min(result.canvasHeight - radius, result.ballY));
    }
    
    // Les paddles ne sont pas extrapoles (on n'a pas leur direction)
    
    return result;
}

/**
 * Calcule l'etat a afficher pour un temps donne
 */
function computeRenderState(renderTime: number): GameState | null {
    if (stateBuffer.length === 0) {
        return null;
    }
    
    // Cas 1: Interpolation - on a des etats encadrant renderTime
    const interpResult = findInterpolationStates(renderTime);
    if (interpResult) {
        const [before, after, t] = interpResult;
        return interpolateStates(before, after, t);
    }
    
    // Cas 2: Extrapolation - renderTime est apres tous les etats
    const latestState = stateBuffer[stateBuffer.length - 1]!;
    const latestTime = latestState.timestamp || 0;
    
    if (renderTime > latestTime) {
        const deltaMs = renderTime - latestTime;
        return extrapolateState(latestState, deltaMs);
    }
    
    // Cas 3: renderTime est avant tous les etats (rare) - utiliser le plus ancien
    return cloneState(stateBuffer[0]!);
}

// ============================================================================
// BOUCLE DE RENDU
// ============================================================================

/**
 * Demarre la boucle de rendu
 */
export function startRenderLoop(): void {
    if (isRenderLoopRunning) return;
    
    isRenderLoopRunning = true;
    requestAnimationFrame(renderLoop);
}

/**
 * Arrete la boucle de rendu et nettoie le buffer
 */
export function stopRenderLoop(): void {
    isRenderLoopRunning = false;
    stateBuffer = [];
    currentRenderState = null;
    serverTimeOffset = 0;
}

/**
 * Retourne l'etat actuel interpole (pour usage externe)
 */
export function getCurrentInterpolatedState(): GameState | null {
    return currentRenderState;
}

/**
 * Boucle de rendu principale
 */
function renderLoop(_timestamp: number): void {
    if (!isRenderLoopRunning) return;
    
    // Calculer le temps de rendu (temps serveur - delai)
    const renderTime = getServerTime() - RENDER_DELAY_MS;
    
    // Calculer l'etat a afficher
    currentRenderState = computeRenderState(renderTime);
    
    // Si on a un etat, appeler la fonction de rendu
    if (currentRenderState && window.drawPongGame) {
        window.drawPongGame(currentRenderState);
    }
    
    // Nettoyer les vieux etats (garder seulement ceux utiles)
    const cutoffTime = renderTime - 200; // Garder 200ms d'historique
    while (stateBuffer.length > 2 && (stateBuffer[0]?.timestamp || 0) < cutoffTime) {
        stateBuffer.shift();
    }
    
    // Continuer la boucle
    requestAnimationFrame(renderLoop);
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

window.addGameState = addGameState;
window.startRenderLoop = startRenderLoop;
window.stopRenderLoop = stopRenderLoop;
