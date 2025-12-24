// pongControls.ts
// This file manages keyboard controls and paddle movement events for the Pong game.
// It handles key bindings for both local and online modes, updates controls when the paddle assignment changes,
// and exposes utility functions for cleanup and configuration. It also manages AI mode and event listeners.

window.controlledPaddle = null;

// Sends a key event (keydown or keyup) for a specific paddle and direction to the backend or local handler.
function sendKeyEvent(type: 'keydown' | 'keyup', player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down')
{
    if (window.isLocalGame)
        window.sendMessage(type, { player, direction });
    else
        if (window.controlledPaddle === player)
            window.sendMessage(type, { player, direction });
}

let keyToMove: Record<string, { player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down' }> = {};

// Updates the key bindings for paddle movement based on the current game mode and paddle assignment.
function updatePaddleKeyBindings()
{
    const paddle = window.controlledPaddle;
    const isLocal = window.isLocalGame;
    
    if (isLocal)
    {
        const paddles = paddle;
        if (Array.isArray(paddles))
        {
            keyToMove = {};
            if (!window.aiMode)
            {
                if (paddles.includes('LEFT'))
                {
                    keyToMove['w'] = { player: 'LEFT', direction: 'up' };
                    keyToMove['s'] = { player: 'LEFT', direction: 'down' };
                }
            }
            if (paddles.includes('RIGHT'))
            {
                keyToMove['ArrowUp'] = { player: 'RIGHT', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'RIGHT', direction: 'down' };
            }
            if (paddles.includes('DOWN'))
            {
                keyToMove['v'] = { player: 'DOWN', direction: 'up' };
                keyToMove['b'] = { player: 'DOWN', direction: 'down' };
            }
            if (paddles.includes('TOP'))
            {
                keyToMove['o'] = { player: 'TOP', direction: 'up' };
                keyToMove['p'] = { player: 'TOP', direction: 'down' };
            }
        }
    }
    else
    {
        if (paddle === 'LEFT' || paddle === 'DOWN' || paddle === 'RIGHT' || paddle === 'TOP')
        {
            if (window.maxPlayers === 4)
            {
                switch (paddle)
                {
                    case 'DOWN':
                        keyToMove = {
                            ArrowLeft: { player: paddle, direction: 'up' },
                            ArrowRight: { player: paddle, direction: 'down' }
                        };
                        break;
                    case 'LEFT':
                        keyToMove = {
                            ArrowLeft: { player: paddle, direction: 'up' },
                            ArrowRight: { player: paddle, direction: 'down' }
                        };
                        break;
                    case 'RIGHT':
                        keyToMove = {
                            ArrowLeft: { player: paddle, direction: 'down' },
                            ArrowRight: { player: paddle, direction: 'up' }
                        };
                        break;
                    case 'TOP':
                        keyToMove = {
                            ArrowLeft: { player: paddle, direction: 'down' },
                            ArrowRight: { player: paddle, direction: 'up' }
                        };
                        break;
                }
            }
            else
            {
                keyToMove = {
                    ArrowUp: { player: paddle, direction: 'up' },
                    ArrowDown: { player: paddle, direction: 'down' }
                };
            }
        }
        else
        {
            keyToMove = {};
        }
    }
}

// Sets up the event listener to update key bindings when the room is joined.
if (!window._pongControlsRoomJoinedListener)
{
    window._pongControlsRoomJoinedListener = true;
    document.addEventListener('roomJoined', () =>
    {
        updatePaddleKeyBindings();
    });
}

// Sets the local game mode and updates key bindings accordingly.
window.setIsLocalGame = (isLocal: boolean) =>
{
    window.isLocalGame = isLocal;
    updatePaddleKeyBindings();
};

updatePaddleKeyBindings();

window.updatePaddleKeyBindings = updatePaddleKeyBindings;

const pressedKeys: Record<string, boolean> = {};

// Resets all paddle controls and listeners to their initial state.
export function cleanupPongControls(): void
{
    keyToMove = {};
    window.controlledPaddle = null;
    window.isLocalGame = false;
    window._pongControlsRoomJoinedListener = false;
    
    Object.keys(pressedKeys).forEach(key =>
    {
        pressedKeys[key] = false;
    });
}

window.cleanupPongControls = cleanupPongControls;

// Handles keydown events and sends movement commands if appropriate.
function handleKeyDown(event: KeyboardEvent)
{
    const mapping = keyToMove[event.key as string];
    if (!mapping) 
        return;
    if (!pressedKeys[event.key])
    {
        sendKeyEvent('keydown', mapping.player, mapping.direction);
        pressedKeys[event.key] = true;
    }
}

// Handles keyup events and sends stop movement commands if appropriate.
function handleKeyUp(event: KeyboardEvent)
{
    const mapping = keyToMove[event.key as string];
    if (!mapping) 
        return;
    if (pressedKeys[event.key])
    {
        sendKeyEvent('keyup', mapping.player, mapping.direction);
        pressedKeys[event.key] = false;
    }
}

// Sets up key event listeners for paddle controls if not already set.
if (!(document as any)._pongKeyListenersSet)
{
    (document as any)._pongKeyListenersSet = true;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
}

window.sendKeyEvent = sendKeyEvent;

// Defines the AI mode property on the window object.
Object.defineProperty(window, 'aiMode', {
    set: function (val)
    {
        (this as any)._aiMode = val;
    },
    get: function ()
    {
        return (this as any)._aiMode;
    },
    configurable: true
});
window._aiMode = false;