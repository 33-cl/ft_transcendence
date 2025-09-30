// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend
// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'A'|'B'|'C'|'left'|'right' }
window.controlledPaddle = null;
function sendKeyEvent(type, player, direction) {
    // Log des touches actives pour debug visuel
    if (type === 'keydown') {
        console.log(`🎮 Touche active: ${player} ${direction}`);
    }
    // console.log(`[FRONT] sendKeyEvent: type=${type}, player=${player}, direction=${direction}, controlledPaddle=${(window as any).controlledPaddle}`);
    if (window.isLocalGame) {
        window.sendMessage(type, { player, direction });
    }
    else {
        if (window.controlledPaddle === player) {
            window.sendMessage(type, { player, direction });
        }
    }
}
// Mapping dynamique selon le mode de jeu
let keyToMove = {};
function updatePaddleKeyBindings() {
    const paddle = window.controlledPaddle;
    const isLocal = window.isLocalGame;
    if (isLocal) {
        let paddles = paddle;
        if (Array.isArray(paddle) && paddle.length === 2 && paddle.includes('A') && paddle.includes('C')) {
            paddles = ['left', 'right'];
        }
        if (Array.isArray(paddles)) {
            keyToMove = {};
            // 1v1 local : left/right (patch appliqué)
            if (!window.aiMode) {
                if (paddles.includes('left')) {
                    keyToMove['w'] = { player: 'left', direction: 'up' };
                    keyToMove['s'] = { player: 'left', direction: 'down' };
                }
            }
            if (paddles.includes('right')) {
                keyToMove['ArrowUp'] = { player: 'right', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'right', direction: 'down' };
            }
            // 1v1v1v1 local : A/B/C/D 
            if (paddles.includes('A')) {
                keyToMove['w'] = { player: 'A', direction: 'up' };
                keyToMove['s'] = { player: 'A', direction: 'down' };
            }
            if (paddles.includes('B')) {
                // Paddle B est horizontal : i = gauche, k = droite
                keyToMove['i'] = { player: 'B', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['k'] = { player: 'B', direction: 'down' }; // down = droite pour paddle horizontal
            }
            if (paddles.includes('C')) {
                keyToMove['ArrowUp'] = { player: 'C', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'C', direction: 'down' };
            }
            if (paddles.includes('D')) {
                // Paddle D est horizontal : v = gauche, b = droite
                keyToMove['v'] = { player: 'D', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['b'] = { player: 'D', direction: 'down' }; // down = droite pour paddle horizontal
            }
        }
        else if (['A', 'B', 'C', 'D'].includes(paddle)) {
            // Cas fallback (jamais utilisé normalement)
            keyToMove = {
                w: { player: 'A', direction: 'up' },
                s: { player: 'A', direction: 'down' },
                i: { player: 'B', direction: 'up' }, // up = gauche pour paddle B horizontal
                k: { player: 'B', direction: 'down' }, // down = droite pour paddle B horizontal
                ArrowUp: { player: 'C', direction: 'up' },
                ArrowDown: { player: 'C', direction: 'down' },
                v: { player: 'D', direction: 'up' }, // up = gauche pour paddle D horizontal
                b: { player: 'D', direction: 'down' } // down = droite pour paddle D horizontal
            };
        }
    }
    else {
        // Mode online : chaque joueur utilise les flèches directionnelles
        if (paddle === 'A' || paddle === 'B' || paddle === 'C' || paddle === 'D') {
            keyToMove = {
                ArrowUp: { player: paddle, direction: 'up' },
                ArrowDown: { player: paddle, direction: 'down' }
            };
        }
        else if (paddle === 'left') {
            keyToMove = {
                ArrowUp: { player: 'left', direction: 'up' },
                ArrowDown: { player: 'left', direction: 'down' }
            };
        }
        else if (paddle === 'right') {
            keyToMove = {
                ArrowUp: { player: 'right', direction: 'up' },
                ArrowDown: { player: 'right', direction: 'down' }
            };
        }
        else {
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
window.setIsLocalGame = (isLocal) => {
    window.isLocalGame = isLocal;
    updatePaddleKeyBindings();
};
updatePaddleKeyBindings(); // Initial
// Expose the function globally so websocket.ts can call it
window.updatePaddleKeyBindings = updatePaddleKeyBindings;
const pressedKeys = {};
// Fonction de nettoyage des contrôles
export function cleanupPongControls() {
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
    const move = keyToMove[e.key];
    if (move && !pressedKeys[e.key]) {
        sendKeyEvent('keydown', move.player, move.direction);
        pressedKeys[e.key] = true;
    }
});
document.addEventListener("keyup", function (e) {
    const move = keyToMove[e.key];
    if (move && pressedKeys[e.key]) {
        sendKeyEvent('keyup', move.player, move.direction);
        pressedKeys[e.key] = false;
    }
});
window.sendKeyEvent = sendKeyEvent;
// Patch global pour gérer le mode IA sans notifications
Object.defineProperty(window, 'aiMode', {
    set: function (val) {
        this._aiMode = val;
        // La difficulté est maintenant gérée dans aiConfig.ts
    },
    get: function () {
        return this._aiMode;
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
//# sourceMappingURL=pongControls.js.map