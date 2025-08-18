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
    
    console.log(`[CLEANUP-${sessionId}] Nettoyage #${cleanupState.cleanupCount}`);
    // console.log(`[CLEANUP-${sessionId}] État avant:`, {
    //     previousSessionId: cleanupState.sessionId,
    //     windowControlledPaddle: (window as any).controlledPaddle,
    //     windowIsLocalGame: (window as any).isLocalGame
    // });
    
    // 1. Reset des variables globales du jeu
    (window as any).controlledPaddle = null;
    (window as any).isLocalGame = false;
    (window as any).maxPlayers = 2;
    
    // 2. Nettoyage du canvas et du contexte de rendu
    if (cleanupState.canvas) {
        const ctx = cleanupState.canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, cleanupState.canvas.width, cleanupState.canvas.height);
            console.log(`[CLEANUP-${sessionId}] Canvas nettoyé`);
        }
    }
    
    // Reset des références canvas dans le renderer
    resetPongRenderer();
    
    // 3. Nettoyage des event listeners de contrôle
    cleanupPongControls();
    
    // 4. Nettoyage des event listeners WebSocket
    if ((window as any).cleanupGameEventListeners) {
        (window as any).cleanupGameEventListeners();
    }
    
    // 5. NOUVEAU : Forcer la sortie de la room côté serveur pour éviter les rooms fantômes
    forceLeaveCurrentRoom();
    
    // 6. Reset des flags d'état
    cleanupState.eventListenersAdded = false;
    cleanupState.gameStateInitialized = false;
    cleanupState.canvas = null;
    cleanupState.ctx = null;
    cleanupState.sessionId = sessionId;
    
    // 7. Reset des listeners WebSocket partiels
    (window as any)._pongControlsRoomJoinedListener = false;
    (window as any)._roomJoinedHandlerSet = false;
    (window as any)._navigationListenerSet = false; // Reset du flag de navigation
    
    console.log(`[CLEANUP-${sessionId}] === FIN NETTOYAGE ===`);
}

// Force la sortie de la room actuelle pour éviter les conflits
function forceLeaveCurrentRoom(): void {
    if ((window as any).socket) {
        console.log('[CLEANUP] Envoi de leaveAllRooms au serveur');
        (window as any).socket.emit('leaveAllRooms');
    }
}

// Force la réinitialisation du renderer Pong
function resetPongRenderer(): void {
    // Cette fonction sera appelée par le renderer pour se reset
    if ((window as any).resetPongRenderer) {
        (window as any).resetPongRenderer();
    }
}

// Force la réinitialisation des contrôles Pong
function cleanupPongControls(): void {
    // Cette fonction sera appelée par les contrôles pour se reset
    if ((window as any).cleanupPongControls) {
        (window as any).cleanupPongControls();
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
