// Système de nettoyage pour éviter les conflits entre les sessions de jeu
// Ce module permet de nettoyer proprement l'état du jeu lors de la navigation

interface GameCleanupState {
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    eventListenersAdded: boolean;
    gameStateInitialized: boolean;
    sessionId: string;
    cleanupCount: number;
}

let cleanupState: GameCleanupState = {
    canvas: null,
    ctx: null,
    eventListenersAdded: false,
    gameStateInitialized: false,
    sessionId: 'none',
    cleanupCount: 0
};

// Génère un ID unique pour chaque session
function generateSessionId(): string {
    return 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

// Nettoie complètement l'état du jeu
export function cleanupGameState(): void {
    const sessionId = generateSessionId();
    cleanupState.cleanupCount++;
    
    // OPTIMISATION: Vérifier rapidement s'il y a vraiment quelque chose à nettoyer
    const hasGameState = window.controlledPaddle || 
                        window.isLocalGame || 
                        cleanupState.gameStateInitialized ||
                        cleanupState.canvas;
    
    if (!hasGameState) {
        // Rien à nettoyer, sortir rapidement
        return;
    }
    
    // 1. Reset des variables globales du jeu
    window.controlledPaddle = null;
    window.isLocalGame = false;
    window.maxPlayers = 2;
    
    // 2. Nettoyage du canvas et du contexte de rendu
    if (cleanupState.canvas) {
        const ctx = cleanupState.canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, cleanupState.canvas.width, cleanupState.canvas.height);
        }
    }
    
    // Reset des références canvas dans le renderer
    resetPongRenderer();
    
    // Reset de la rotation du canvas (mode 4 joueurs)
    if (window.resetCanvasRotation) {
        window.resetCanvasRotation('map');
    }
    
    // 3. Nettoyage des event listeners de contrôle
    cleanupPongControls();
    
    // 4. Nettoyage des event listeners WebSocket
    if (window.cleanupGameEventListeners) {
        window.cleanupGameEventListeners();
    }
    
    // 5. NOUVEAU : Forcer la sortie de la room côté serveur pour éviter les rooms fantômes
    forceLeaveCurrentRoom();
    
    // 6. Reset des flags d'état
    cleanupState.eventListenersAdded = false;
    cleanupState.gameStateInitialized = false;
    cleanupState.canvas = null;
    cleanupState.ctx = null;
    cleanupState.sessionId = sessionId;
    
    // 6b. Arrêter la boucle d'interpolation si elle existe
    if (typeof window.stopRenderLoop === 'function') {
        window.stopRenderLoop();
    }
    
    // 7. Reset des listeners WebSocket partiels
    window._pongControlsRoomJoinedListener = false;
    window._roomJoinedHandlerSet = false;
    window._navigationListenerSet = false; // Reset du flag de navigation
    
    // CLEANUP TERMINÉ - État remis à zéro pour la prochaine session
}

// Force la sortie de la room actuelle pour éviter les conflits
function forceLeaveCurrentRoom(): void {
    
    if (window.socket && window.socket.connected) {
        window.socket.emit('leaveAllRooms');
    }
}

// Force la réinitialisation du renderer Pong
function resetPongRenderer(): void {
    // Cette fonction sera appelée par le renderer pour se reset
    if (window.resetPongRenderer) {
        window.resetPongRenderer();
    }
}

// Force la réinitialisation des contrôles Pong
function cleanupPongControls(): void {
    // Cette fonction sera appelée par les contrôles pour se reset
    if (window.cleanupPongControls) {
        window.cleanupPongControls();
    }
}

// Met à jour l'état de nettoyage lors de l'initialisation du jeu
export function setGameInitialized(): void {
    cleanupState.gameStateInitialized = true;
}

// Vérifie si le jeu a été correctement nettoyé
export function isGameClean(): boolean {
    return !cleanupState.gameStateInitialized && 
           !cleanupState.eventListenersAdded && 
           cleanupState.canvas === null;
}
