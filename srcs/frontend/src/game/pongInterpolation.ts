// pongInterpolation.ts
// Système d'interpolation et de prédiction pour fluidifier le mouvement de la balle

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
const BUFFER_SIZE = 5; // Nombre d'états à conserver pour l'interpolation
const INTERPOLATION_DELAY = 10; // Délai d'interpolation en ms (réduit pour plus de réactivité)

// Variables pour la prédiction client-side
let lastPredictedState: GameState | null = null;
let lastPredictionTime: number = 0;
let lastServerState: GameState | null = null;
let lastScore: number = 0; // Pour détecter les changements de score

let isRenderLoopRunning = false;

/**
 * Calcule le score total de tous les paddles
 */
function getTotalScore(state: GameState): number {
    if (!state.paddles) return 0;
    return state.paddles.reduce((sum, p) => sum + (p.score || 0), 0);
}

/**
 * Détecte si la balle a été "téléportée" (reset après un but)
 */
function hasBallTeleported(oldState: GameState | null, newState: GameState): boolean {
    if (!oldState) return false;
    
    // Calculer la distance entre les deux positions
    const dx = newState.ballX - oldState.ballX;
    const dy = newState.ballY - oldState.ballY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Si la balle a bougé de plus de 100 pixels d'un coup, c'est un reset
    // (la balle normale ne peut pas bouger aussi vite en une frame)
    const teleportThreshold = 100;
    
    return distance > teleportThreshold;
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
    
    // Détecter un changement de score (= but marqué)
    const currentScore = getTotalScore(gameState);
    const scoreChanged = currentScore !== lastScore;
    lastScore = currentScore;
    
    // Détecter une téléportation de la balle
    const teleported = hasBallTeleported(lastServerState, gameState);
    
    // Si le score a changé ou la balle a été téléportée, reset la prédiction
    if (scoreChanged || teleported) {
        lastPredictedState = null;
        stateBuffer.length = 0; // Vider le buffer pour éviter l'interpolation avec les anciennes positions
    }
    
    // Sauvegarder le dernier état serveur pour la prédiction
    lastServerState = {...gameState};
    lastPredictionTime = Date.now();
    
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
    lastPredictedState = null;
    lastServerState = null;
    lastScore = 0;
    stateBuffer.length = 0;
}

/**
 * Prédit la position de la balle en fonction de sa vitesse
 * @param state État de base pour la prédiction
 * @param deltaTime Temps écoulé en ms depuis le dernier état serveur
 * @returns État prédit avec nouvelle position de balle
 */
function predictBallPosition(state: GameState, deltaTime: number): GameState {
    const result: GameState = { ...state };
    
    // Si on a la vitesse de la balle, prédire sa position
    if (state.ballSpeedX !== undefined && state.ballSpeedY !== undefined) {
        // Convertir deltaTime en secondes et appliquer un facteur de lissage
        const dt = deltaTime / 1000;
        
        // Calculer la nouvelle position prédite
        let newBallX = state.ballX + state.ballSpeedX * dt;
        let newBallY = state.ballY + state.ballSpeedY * dt;
        
        // Gérer les rebonds sur les bords (approximation simple)
        const ballRadius = state.ballRadius || 10;
        const margin = ballRadius;
        
        // Rebond horizontal (seulement en mode 4 joueurs avec paddles en haut/bas)
        if (state.paddles && state.paddles.length === 4) {
            if (newBallX <= margin || newBallX >= state.canvasWidth - margin) {
                newBallX = Math.max(margin, Math.min(state.canvasWidth - margin, newBallX));
            }
        }
        
        // Rebond vertical (en mode 2 joueurs classique)
        if (state.paddles && state.paddles.length === 2) {
            if (newBallY <= margin) {
                newBallY = margin;
            } else if (newBallY >= state.canvasHeight - margin) {
                newBallY = state.canvasHeight - margin;
            }
        }
        
        result.ballX = newBallX;
        result.ballY = newBallY;
    }
    
    return result;
}

/**
 * Interpole les positions des paddles pour un mouvement fluide
 */
function interpolatePaddles(state1: GameState, state2: GameState, alpha: number): GameState["paddles"] {
    return state1.paddles.map((paddle, index) => {
        if (index < state2.paddles.length && state2.paddles[index]) {
            const paddle2 = state2.paddles[index];
            return {
                ...paddle,
                x: paddle.x + alpha * (paddle2.x - paddle.x),
                y: paddle.y + alpha * (paddle2.y - paddle.y)
            };
        }
        return paddle;
    });
}

/**
 * Obtient l'état interpolé actuel basé sur le buffer avec prédiction client-side
 * @returns État interpolé ou dernier état disponible
 */
export function getCurrentInterpolatedState(): GameState | null {
    if (stateBuffer.length === 0 && !lastServerState) {
        return null;
    }
    
    const now = Date.now();
    
    // Si on a un état serveur récent, utiliser la prédiction client-side
    if (lastServerState) {
        const timeSinceLastUpdate = now - lastPredictionTime;
        
        // Si l'état serveur est très récent (< 100ms), prédire la position
        if (timeSinceLastUpdate < 150) {
            const predictedState = predictBallPosition(lastServerState, timeSinceLastUpdate);
            
            // Lissage avec l'état précédemment prédit pour éviter les saccades
            if (lastPredictedState) {
                const smoothingFactor = 0.3; // Plus bas = plus lisse mais moins réactif
                predictedState.ballX = lastPredictedState.ballX + smoothingFactor * (predictedState.ballX - lastPredictedState.ballX);
                predictedState.ballY = lastPredictedState.ballY + smoothingFactor * (predictedState.ballY - lastPredictedState.ballY);
            }
            
            lastPredictedState = predictedState;
            return predictedState;
        }
    }
    
    // Fallback: interpolation classique entre états du buffer
    if (stateBuffer.length === 1) {
        return stateBuffer[0] || null;
    }
    
    // Recherche des deux états entourant le temps cible
    const targetTime = now - INTERPOLATION_DELAY;
    
    // Trouver les deux états entourant le temps cible
    let state1Index = -1;
    let state2Index = -1;
    
    for (let i = 0; i < stateBuffer.length; i++) {
        const state = stateBuffer[i];
        if (state && state.timestamp !== undefined && state.timestamp <= targetTime) {
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
    
    if (!state1 || !state2) {
        return stateBuffer[stateBuffer.length - 1] || null;
    }
    
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
    
    // Interpolation linéaire des positions de la balle
    result.ballX = state1.ballX + alpha * (state2.ballX - state1.ballX);
    result.ballY = state1.ballY + alpha * (state2.ballY - state1.ballY);
    
    // Interpolation des positions des raquettes
    result.paddles = interpolatePaddles(state1, state2, alpha);
    
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
