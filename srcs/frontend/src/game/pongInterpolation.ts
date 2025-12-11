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
    ballCountdown?: number;
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
// 80ms permet d'absorber les bursts de ~60ms observes dans les logs
const RENDER_DELAY_MS = 80;

// Nombre max d'etats dans le buffer
const MAX_BUFFER_SIZE = 15;

// Duree max d'extrapolation en ms (au dela on freeze)
const MAX_EXTRAPOLATION_MS = 100;

// Seuil pour considerer deux positions comme identiques (duplicates serveur)
const DUPLICATE_THRESHOLD = 0.01;

// Seuil d'age max pour accepter un etat (ignore les etats trop vieux arrives en burst)
const MAX_STATE_AGE_MS = 200;

// Conversion des vitesses serveur
// La vitesse serveur est en "pixels par frame à 60 FPS" (normalisée avec dt * 60)
// Vitesse réelle en px/sec = ballSpeed * 60
// Vitesse en px/ms = ballSpeed * 60 / 1000 = ballSpeed * 0.06
const SPEED_TO_PX_PER_MS = 0.06; // Facteur de conversion: speed * 0.06 = px/ms

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
 * Filtre les duplicates et les etats trop vieux
 */
export function addGameState(gameState: GameState): void {
    // Normaliser et coerce les champs numeriques pour eviter des strings ou undefined
    if (!gameState.timestamp) {
        gameState.timestamp = Date.now();
    }
    gameState.timestamp = Number(gameState.timestamp);
    gameState.ballX = Number(gameState.ballX);
    gameState.ballY = Number(gameState.ballY);
    if (gameState.ballSpeedX !== undefined) gameState.ballSpeedX = Number(gameState.ballSpeedX);
    if (gameState.ballSpeedY !== undefined) gameState.ballSpeedY = Number(gameState.ballSpeedY);
    if (gameState.ballRadius !== undefined) gameState.ballRadius = Number(gameState.ballRadius);

    const now = Date.now();
    
    // Ignorer les etats trop vieux (arrives en burst retarde)
    const stateAge = now - gameState.timestamp;
    if (stateAge > MAX_STATE_AGE_MS) {
        return;
    }

    // Detecter un reset de balle (position au centre + grande teleportation)
    // Quand cela arrive, vider le buffer pour eviter les artefacts visuels
    if (stateBuffer.length > 0) {
        const last = stateBuffer[stateBuffer.length - 1]!;
        const centerX = gameState.canvasWidth / 2;
        const centerY = gameState.canvasHeight / 2;
        const isAtCenter = Math.abs(gameState.ballX - centerX) < 20 && 
                           Math.abs(gameState.ballY - centerY) < 20;
        const lastDistance = Math.sqrt(
            Math.pow(last.ballX - centerX, 2) + 
            Math.pow(last.ballY - centerY, 2)
        );
        // Si la balle est au centre et etait loin avant = reset detecte
        if (isAtCenter && lastDistance > 100) {
            // Vider le buffer pour transition immediate
            stateBuffer = [];
        }
    }

    // Filtrer les duplicates: meme position que le dernier etat
    // IMPORTANT: Ne pas filtrer si:
    // - Le ballCountdown a changé (sinon le 3-2-1 ne s'affiche pas)
    // - On est en phase de countdown (balle immobile mais paddles bougent)
    // - Les paddles ont changé de position
    if (stateBuffer.length > 0) {
        const last = stateBuffer[stateBuffer.length - 1]!;
        const dx = Math.abs(gameState.ballX - last.ballX);
        const dy = Math.abs(gameState.ballY - last.ballY);
        const countdownChanged = (gameState.ballCountdown !== undefined && 
                                   gameState.ballCountdown !== last.ballCountdown);
        const isInCountdown = gameState.ballCountdown !== undefined && gameState.ballCountdown > 0;
        
        // Vérifier si les paddles ont bougé
        let paddlesMoved = false;
        if (gameState.paddles && last.paddles && gameState.paddles.length === last.paddles.length) {
            for (let i = 0; i < gameState.paddles.length; i++) {
                const curr = gameState.paddles[i];
                const prev = last.paddles[i];
                if (curr && prev && (Math.abs(curr.x - prev.x) > 0.5 || Math.abs(curr.y - prev.y) > 0.5)) {
                    paddlesMoved = true;
                    break;
                }
            }
        }
        
        // Ne pas filtrer si on est en countdown OU si les paddles ont bougé OU si countdown a changé
        if (dx < DUPLICATE_THRESHOLD && dy < DUPLICATE_THRESHOLD && 
            !countdownChanged && !isInCountdown && !paddlesMoved) {
            return;
        }
    }

    // Mettre a jour l'offset serveur (moyenne glissante plus stable)
    // On utilise un facteur plus faible pour eviter les fluctuations dues aux bursts reseau
    const newOffset = gameState.timestamp - now;
    // Ne mettre à jour que si la différence n'est pas trop grande (éviter les sauts)
    const offsetDiff = Math.abs(newOffset - serverTimeOffset);
    if (serverTimeOffset === 0) {
        // Premier état - initialiser directement
        serverTimeOffset = newOffset;
    } else if (offsetDiff < 50) {
        // Différence raisonnable - mise à jour progressive
        serverTimeOffset = serverTimeOffset * 0.95 + newOffset * 0.05;
    }
    // Si offsetDiff >= 50ms, ignorer cette mise à jour (probablement un burst)
    
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

// Helper: calcule la vitesse (pixels par milliseconde) a partir des deux derniers etats du buffer
function computeVelocityFromBuffer(): { vx: number; vy: number } | null {
    if (stateBuffer.length < 2) return null;
    const last = stateBuffer[stateBuffer.length - 1]!;
    const prev = stateBuffer[stateBuffer.length - 2]!;
    const tLast = Number(last.timestamp || 0);
    const tPrev = Number(prev.timestamp || 0);
    const dt = tLast - tPrev;
    if (!dt) return null;
    const vx = (last.ballX - prev.ballX) / dt; // pixels per ms
    const vy = (last.ballY - prev.ballY) / dt; // pixels per ms
    return { vx, vy };
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
    
    // Copier le countdown de l'etat le plus recent AVANT l'interpolation
    // pour pouvoir vérifier si on doit geler la balle
    if (after.ballCountdown !== undefined) result.ballCountdown = after.ballCountdown;
    
    // Pendant le countdown, NE PAS interpoler la balle - elle doit rester au centre
    if (result.ballCountdown && result.ballCountdown > 0) {
        result.ballX = result.canvasWidth / 2;
        result.ballY = result.canvasHeight / 2;
    } else {
        // Interpoler la position de la balle normalement
        result.ballX = lerp(before.ballX, after.ballX, t);
        result.ballY = lerp(before.ballY, after.ballY, t);
    }
    
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
    
    // NE PAS extrapoler la BALLE pendant le countdown - elle doit rester au centre
    // Mais on continue pour les paddles (pas d'extrapolation nécessaire car elles sont dans l'état)
    if (result.ballCountdown && result.ballCountdown > 0) {
        // Forcer la balle au centre pendant le countdown
        result.ballX = result.canvasWidth / 2;
        result.ballY = result.canvasHeight / 2;
        // Ne pas retourner ici - on veut garder les positions de paddles de l'état de base
        return result;
    }

    // Determiner la vitesse en pixels/millisecondes
    let vx: number = 0;
    let vy: number = 0;

    if (result.ballSpeedX !== undefined && result.ballSpeedY !== undefined) {
        // Convertir de "pixels par frame à 60FPS" vers px/ms
        // Vitesse réelle = ballSpeed * 60 pixels/sec = ballSpeed * 0.06 px/ms
        vx = result.ballSpeedX * SPEED_TO_PX_PER_MS;
        vy = result.ballSpeedY * SPEED_TO_PX_PER_MS;
    } else {
        // Fallback: calculer a partir des deux derniers etats
        const derived = computeVelocityFromBuffer();
        if (derived) {
            vx = derived.vx;
            vy = derived.vy;
        }
    }

    // Extrapoler la balle: position = position + vitesse * delta_ms
    result.ballX += vx * limitedDelta;
    result.ballY += vy * limitedDelta;

    // Borner dans le canvas (simple, sans rebond)
    const radius = result.ballRadius || 15;
    result.ballX = Math.max(radius, Math.min(result.canvasWidth - radius, result.ballX));
    result.ballY = Math.max(radius, Math.min(result.canvasHeight - radius, result.ballY));

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
// DIAGNOSTICS
// ============================================================================

/**
 * Retourne des informations de diagnostic pour le debug
 */
export function getInterpolationDiagnostics(): {
    bufferSize: number;
    renderDelayMs: number;
    serverTimeOffset: number;
    latestServerTs: number | null;
    renderTs: number;
    isExtrapolating: boolean;
    extrapolationMs: number;
} {
    const renderTime = getServerTime() - RENDER_DELAY_MS;
    const latestState = stateBuffer.length > 0 ? stateBuffer[stateBuffer.length - 1] : null;
    const latestServerTs = latestState?.timestamp || null;
    
    let isExtrapolating = false;
    let extrapolationMs = 0;
    
    if (latestServerTs !== null && renderTime > latestServerTs) {
        isExtrapolating = true;
        extrapolationMs = renderTime - latestServerTs;
    }
    
    return {
        bufferSize: stateBuffer.length,
        renderDelayMs: RENDER_DELAY_MS,
        serverTimeOffset,
        latestServerTs,
        renderTs: renderTime,
        isExtrapolating,
        extrapolationMs
    };
}

// Expose for debug
window.getInterpolationDiagnostics = getInterpolationDiagnostics;

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

window.addGameState = addGameState;
window.startRenderLoop = startRenderLoop;
window.stopRenderLoop = stopRenderLoop;
window.getCurrentInterpolatedState = getCurrentInterpolatedState;
