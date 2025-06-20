// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'left'|'right' }
window.controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'left' | 'right', direction: 'up' | 'down') {
    console.log(`[FRONT] sendKeyEvent: type=${type}, player=${player}, direction=${direction}, controlledPaddle=${window.controlledPaddle}`);
    if (window.isLocalGame) {
        window.sendMessage(type, { player, direction });
    } else {
        if (window.controlledPaddle === player) {
            window.sendMessage(type, { player, direction });
        } else {
            console.log(`[FRONT] Refusé: tentative de contrôle d'un paddle non attribué (controlledPaddle=${window.controlledPaddle}, demandé=${player})`);
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'left' | 'right', direction: 'up' | 'down' }> = {};

function updatePaddleKeyBindings()
{
    const paddle = window.controlledPaddle;
    console.log('[FRONT] updatePaddleKeyBindings, controlledPaddle=', paddle);
    if (window.isLocalGame)
    {
        keyToMove =
        {
            w:    { player: 'left',  direction: 'up' },
            s:    { player: 'left',  direction: 'down' },
            ArrowUp:    { player: 'right', direction: 'up' },
            ArrowDown:  { player: 'right', direction: 'down' }
        };
    }
    else
    {
        if (paddle === 'left' || paddle === 'right')
        {
            keyToMove =
            {
                ArrowUp:    { player: paddle, direction: 'up' },
                ArrowDown:  { player: paddle, direction: 'down' }
            };
        }
        else
            keyToMove = {};
    }
}

// Met à jour le mapping lors de l'attribution du paddle (événement roomJoined)
if (!window._pongControlsRoomJoinedListener)
{
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

const pressedKeys: Record<string, boolean> = {};

document.addEventListener("keydown", function(e){
    const move = keyToMove[e.key as string];
    if (move && !pressedKeys[e.key]) {
        sendKeyEvent('keydown', move.player, move.direction);
        pressedKeys[e.key] = true;
    }
});

document.addEventListener("keyup", function(e){
    const move = keyToMove[e.key as string];
    if (move && pressedKeys[e.key]) {
        sendKeyEvent('keyup', move.player, move.direction);
        pressedKeys[e.key] = false;
    }
});

window.sendKeyEvent = sendKeyEvent;
