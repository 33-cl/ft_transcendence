// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'left'|'right' }
(window as any).controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'left' | 'right', direction: 'up' | 'down') {
    if ((window as any).isLocalGame) {
        // En local, on autorise le contrôle des deux paddles
        window.sendMessage(type, { player, direction });
    } else {
        // En multi, on ne contrôle que son paddle attribué
        if ((window as any).controlledPaddle === player) {
            window.sendMessage(type, { player, direction });
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'left' | 'right', direction: 'up' | 'down' }> = {};

function updateKeyMapping()
{
	const paddle = (window as any).controlledPaddle;
	if ((window as any).isLocalGame)
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
if (!(window as any)._pongControlsRoomJoinedListener) {
    (window as any)._pongControlsRoomJoinedListener = true;
    document.addEventListener('roomJoined', () => {
        updateKeyMapping();
    });
}

(window as any).setIsLocalGame = (isLocal: boolean) => {
    (window as any).isLocalGame = isLocal;
    updateKeyMapping();
};

updateKeyMapping(); // Initial

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

(window as any).sendKeyEvent = sendKeyEvent;
