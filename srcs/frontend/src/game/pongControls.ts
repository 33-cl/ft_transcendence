// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'LEFT'|'DOWN'|'RIGHT'|'TOP' }
(window as any).controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') {
    
    if ((window as any).isLocalGame) {
        (window as any).sendMessage(type, { player, direction });
    } else {
        if ((window as any).controlledPaddle === player) {
            (window as any).sendMessage(type, { player, direction });
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down' }> = {};

function updatePaddleKeyBindings() {
    const paddle = (window as any).controlledPaddle;
    const isLocal = (window as any).isLocalGame;
    
    if (isLocal) {
        const paddles = paddle;
        if (Array.isArray(paddles)) {
            keyToMove = {};
            // 1v1 local : LEFT/RIGHT
            if (!(window as any).aiMode){
                if (paddles.includes('LEFT')) {
                    keyToMove['w'] = { player: 'LEFT', direction: 'up' };
                    keyToMove['s'] = { player: 'LEFT', direction: 'down' };
                }
            }
            if (paddles.includes('RIGHT')) {
                keyToMove['ArrowUp'] = { player: 'RIGHT', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'RIGHT', direction: 'down' };
            }
            // 1v1v1v1 local : LEFT/DOWN/RIGHT/TOP 
            if (paddles.includes('DOWN')) {
                // Paddle DOWN est horizontal : v = gauche, b = droite
                keyToMove['v'] = { player: 'DOWN', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['b'] = { player: 'DOWN', direction: 'down' }; // down = droite pour paddle horizontal
            }
            if (paddles.includes('TOP')) {
                // Paddle TOP est horizontal : o = gauche, p = droite
                keyToMove['o'] = { player: 'TOP', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['p'] = { player: 'TOP', direction: 'down' }; // down = droite pour paddle horizontal
            }
        } 
        else if (['LEFT', 'DOWN', 'RIGHT', 'TOP'].includes(paddle)) {
            // Cas fallback (jamais utilisé normalement)
            keyToMove = {
                w: { player: 'LEFT', direction: 'up' },
                s: { player: 'LEFT', direction: 'down' },
                v: { player: 'DOWN', direction: 'up' }, // up = gauche pour paddle DOWN horizontal
                b: { player: 'DOWN', direction: 'down' }, // down = droite pour paddle DOWN horizontal
                ArrowUp: { player: 'RIGHT', direction: 'up' },
                ArrowDown: { player: 'RIGHT', direction: 'down' },
                o: { player: 'TOP', direction: 'up' }, // up = gauche pour paddle TOP horizontal
                p: { player: 'TOP', direction: 'down' } // down = droite pour paddle TOP horizontal
            };
        }
    }
    else {
        // Mode online : chaque joueur utilise les flèches directionnelles
        if (paddle === 'LEFT' || paddle === 'DOWN' || paddle === 'RIGHT' || paddle === 'TOP') {
            keyToMove = {
                ArrowUp: { player: paddle, direction: 'up' },
                ArrowDown: { player: paddle, direction: 'down' }
            };
        } else {
            keyToMove = {};
        }
    }
}

// Met à jour le mapping lors de l'attribution du paddle (événement roomJoined)
if (!(window as any)._pongControlsRoomJoinedListener) {
    (window as any)._pongControlsRoomJoinedListener = true;
    document.addEventListener('roomJoined', () => {
        updatePaddleKeyBindings();
    });
}

(window as any).setIsLocalGame = (isLocal: boolean) => {
    (window as any).isLocalGame = isLocal;
    updatePaddleKeyBindings();
};

updatePaddleKeyBindings(); // Initial

// Expose the function globally so websocket.ts can call it
(window as any).updatePaddleKeyBindings = updatePaddleKeyBindings;

const pressedKeys: Record<string, boolean> = {};

// Fonction de nettoyage des contrôles
export function cleanupPongControls(): void {
    keyToMove = {};
    (window as any).controlledPaddle = null;
    (window as any).isLocalGame = false;
    (window as any)._pongControlsRoomJoinedListener = false;
    
    Object.keys(pressedKeys).forEach(key => {
        pressedKeys[key] = false;
    });
}

// Expose la fonction de cleanup globalement
(window as any).cleanupPongControls = cleanupPongControls;

document.addEventListener("keydown", function (e) {
    const move = keyToMove[e.key as string];
    if (move && !pressedKeys[e.key]) {
        sendKeyEvent('keydown', move.player, move.direction);
        pressedKeys[e.key] = true;
    }
});

document.addEventListener("keyup", function (e) {
    const move = keyToMove[e.key as string];
    if (move && pressedKeys[e.key]) {
        sendKeyEvent('keyup', move.player, move.direction);
        pressedKeys[e.key] = false;
    }
});

(window as any).sendKeyEvent = sendKeyEvent;

// Patch global pour gérer le mode IA sans notifications
Object.defineProperty(window, 'aiMode', {
    set: function (val) {
        (this as any)._aiMode = val;
        // La difficulté est maintenant gérée dans aiConfig.ts
    },
    get: function () {
        return (this as any)._aiMode;
    },
    configurable: true
});
// Valeur initiale
(window as any)._aiMode = false;

// =============================================================================
// SYSTÈME DE DIFFICULTÉ IA (SIMPLIFIÉ)
// =============================================================================

// La difficulté est maintenant gérée directement dans aiConfig.ts
// On garde juste les fonctions minimales nécessaires