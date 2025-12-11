// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'LEFT'|'DOWN'|'RIGHT'|'TOP' }
window.controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') {
    
    if (window.isLocalGame) {
        window.sendMessage(type, { player, direction });
    } else {
        if (window.controlledPaddle === player) {
            window.sendMessage(type, { player, direction });
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down' }> = {};

function updatePaddleKeyBindings() {
    const paddle = window.controlledPaddle;
    const isLocal = window.isLocalGame;
    
    if (isLocal) {
        const paddles = paddle;
        if (Array.isArray(paddles)) {
            keyToMove = {};
            // 1v1 local : LEFT/RIGHT
            if (!window.aiMode){
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
        else if (paddle && ['LEFT', 'DOWN', 'RIGHT', 'TOP'].includes(paddle)) {
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
            // En mode 4 joueurs online avec rotation du canvas,
            // on utilise gauche/droite car le paddle est visuellement en bas
            if (window.maxPlayers === 4) {
                // La rotation CSS fait que chaque joueur voit son paddle en bas.
                // Il faut adapter le mapping des touches selon la rotation appliquée
                // pour que gauche visuel = gauche sur l'écran.
                //
                // Rotations appliquées (voir pongRenderer.ts applyCanvasRotation):
                // - DOWN: 0° → pas d'inversion
                // - LEFT: -90° → le paddle LEFT devient horizontal en bas, mais les axes sont pivotés
                // - RIGHT: +90° → le paddle RIGHT devient horizontal en bas, mais les axes sont pivotés
                // - TOP: 180° → tout est inversé
                //
                // Pour LEFT et RIGHT, après rotation de ±90°, la gauche visuelle correspond 
                // à l'inverse de ce qu'on enverrait normalement.
                // Pour TOP, après rotation de 180°, gauche et droite sont aussi inversés.
                
                if (paddle === 'DOWN') {
                    // Rotation 0° : pas d'inversion
                    keyToMove = {
                        ArrowLeft: { player: paddle, direction: 'up' },   // Gauche visuel = 'up' 
                        ArrowRight: { player: paddle, direction: 'down' } // Droite visuel = 'down'
                    };
                } else if (paddle === 'LEFT' || paddle === 'RIGHT') {
                    // Rotation ±90° : il faut inverser les directions
                    // Car après rotation, la gauche visuelle devient la droite logique
                    keyToMove = {
                        ArrowLeft: { player: paddle, direction: 'down' },  // Gauche visuel = 'down' (inversé)
                        ArrowRight: { player: paddle, direction: 'up' }    // Droite visuel = 'up' (inversé)
                    };
                } else if (paddle === 'TOP') {
                    // Rotation 180° : tout est inversé, donc on inverse aussi
                    keyToMove = {
                        ArrowLeft: { player: paddle, direction: 'down' },  // Gauche visuel = 'down' (inversé)
                        ArrowRight: { player: paddle, direction: 'up' }    // Droite visuel = 'up' (inversé)
                    };
                }
            } else {
                // Mode 1v1 online : utiliser haut/bas classique
                keyToMove = {
                    ArrowUp: { player: paddle, direction: 'up' },
                    ArrowDown: { player: paddle, direction: 'down' }
                };
            }
        } else {
            keyToMove = {};
        }
    }
}

// Met à jour le mapping lors de l'attribution du paddle (événement roomJoined)
if (!window._pongControlsRoomJoinedListener) {
    window._pongControlsRoomJoinedListener = true;
    document.addEventListener('roomJoined', () => {
        updatePaddleKeyBindings();
    });
}

window.setIsLocalGame = (isLocal: boolean) => {
    window.isLocalGame = isLocal;
    updatePaddleKeyBindings();
};

updatePaddleKeyBindings(); // Initial

// Expose the function globally so websocket.ts can call it
window.updatePaddleKeyBindings = updatePaddleKeyBindings;

const pressedKeys: Record<string, boolean> = {};

// Fonction de nettoyage des contrôles
export function cleanupPongControls(): void {
    keyToMove = {};
    window.controlledPaddle = null;
    window.isLocalGame = false;
    window._pongControlsRoomJoinedListener = false;
    
    Object.keys(pressedKeys).forEach(key => {
        pressedKeys[key] = false;
    });
}

// Expose la fonction de cleanup globalement
window.cleanupPongControls = cleanupPongControls;

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

window.sendKeyEvent = sendKeyEvent;

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
window._aiMode = false;

// =============================================================================
// SYSTÈME DE DIFFICULTÉ IA (SIMPLIFIÉ)
// =============================================================================

// La difficulté est maintenant gérée directement dans aiConfig.ts
// On garde juste les fonctions minimales nécessaires