// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'A'|'B'|'C'|'left'|'right' }
(window as any).controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'A' | 'B' | 'C' | 'left' | 'right', direction: 'up' | 'down') {
    console.log(`[FRONT] sendKeyEvent: type=${type}, player=${player}, direction=${direction}, controlledPaddle=${(window as any).controlledPaddle}`);
    if ((window as any).isLocalGame) {
        console.log('[FRONT] sendMessage called:', type, player, direction, (window as any).sendMessage);
        (window as any).sendMessage(type, { player, direction });
    } else {
        if ((window as any).controlledPaddle === player) {
            (window as any).sendMessage(type, { player, direction });
        } else {
            console.log(`[FRONT] Refusé: tentative de contrôle d'un paddle non attribué (controlledPaddle=${(window as any).controlledPaddle}, demandé=${player})`);
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'A' | 'B' | 'C' | 'left' | 'right', direction: 'up' | 'down' }> = {};

function updatePaddleKeyBindings() {
    const paddle = (window as any).controlledPaddle;
    console.log('[FRONT] updatePaddleKeyBindings, controlledPaddle=', paddle);
    if ((window as any).isLocalGame) {
        let paddles = paddle;
        let isPatched1v1 = false;
        if (Array.isArray(paddle) && paddle.length === 2 && paddle.includes('A') && paddle.includes('C')) {
            paddles = ['left', 'right'];
            isPatched1v1 = true;
        }
        if (Array.isArray(paddles)) {
            keyToMove = {};
            // 1v1 local : left/right (patch appliqué)
            if (paddles.includes('left')) {
                keyToMove['w'] = { player: 'left', direction: 'up' };
                keyToMove['s'] = { player: 'left', direction: 'down' };
            }
            if (paddles.includes('right')) {
                keyToMove['ArrowUp'] = { player: 'right', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'right', direction: 'down' };
            }
            // 1v1v1 local : A/B/C (uniquement si patch non appliqué)
            if (!isPatched1v1) {
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
            }
        } else if (['A', 'B', 'C'].includes(paddle)) {
            // Cas fallback (jamais utilisé normalement)
            keyToMove = {
                w: { player: 'A', direction: 'up' },
                s: { player: 'A', direction: 'down' },
                i: { player: 'B', direction: 'up' }, // up = gauche pour paddle B horizontal
                k: { player: 'B', direction: 'down' }, // down = droite pour paddle B horizontal
                ArrowUp: { player: 'C', direction: 'up' },
                ArrowDown: { player: 'C', direction: 'down' }
            };
        } else {
            // 1v1 local : left = W/S, right = flèches
            keyToMove = {
                w: { player: 'left', direction: 'up' },
                s: { player: 'left', direction: 'down' },
                ArrowUp: { player: 'right', direction: 'up' },
                ArrowDown: { player: 'right', direction: 'down' }
            };
        }
    }
    else {
        // Mode online : chaque joueur ne contrôle que son paddle
        if (paddle === 'A') {
            keyToMove = {
                w: { player: 'A', direction: 'up' },
                s: { player: 'A', direction: 'down' }
            };
        } else if (paddle === 'B') {
            keyToMove = {
                i: { player: 'B', direction: 'up' }, // up = gauche pour paddle B horizontal
                k: { player: 'B', direction: 'down' } // down = droite pour paddle B horizontal
            };
        } else if (paddle === 'C') {
            keyToMove = {
                ArrowUp: { player: 'C', direction: 'up' },
                ArrowDown: { player: 'C', direction: 'down' }
            };
        } else if (paddle === 'left') {
            keyToMove = {
                w: { player: 'left', direction: 'up' },
                s: { player: 'left', direction: 'down' }
            };
        } else if (paddle === 'right') {
            keyToMove = {
                ArrowUp: { player: 'right', direction: 'up' },
                ArrowDown: { player: 'right', direction: 'down' }
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

const pressedKeys: Record<string, boolean> = {};

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