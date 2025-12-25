// Cleanup system to avoid conflicts between game sessions
// This module allows for proper cleanup of the game state during navigation

interface GameCleanupState
{
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    eventListenersAdded: boolean;
    gameStateInitialized: boolean;
    sessionId: string;
    cleanupCount: number;
}

let cleanupState: GameCleanupState =
{
    canvas: null,
    ctx: null,
    eventListenersAdded: false,
    gameStateInitialized: false,
    sessionId: 'none',
    cleanupCount: 0
};

// Generates a unique ID for each session
function generateSessionId(): string
{
    return 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

// Completely cleans up the game state
export function cleanupGameState(): void
{
    const sessionId = generateSessionId();
    cleanupState.cleanupCount++;

    // OPTIMIZATION: Quickly check if there is actually something to clean up
    const hasGameState = window.controlledPaddle ||
                        window.isLocalGame ||
                        cleanupState.gameStateInitialized ||
                        cleanupState.canvas;

    if (!hasGameState)
    {
        // Nothing to clean up, exit quickly
        return;
    }

    // 1. Reset global game variables
    window.controlledPaddle = null;
    window.isLocalGame = false;
    window.maxPlayers = 2;

    // 2. Clean up the canvas and rendering context
    if (cleanupState.canvas)
    {
        const ctx = cleanupState.canvas.getContext('2d');
        if (ctx)
        {
            ctx.clearRect(0, 0, cleanupState.canvas.width, cleanupState.canvas.height);
        }
    }

    // Reset canvas references in the renderer
    resetPongRenderer();

    // Reset canvas rotation (4-player mode)
    if (window.resetCanvasRotation)
    {
        window.resetCanvasRotation('map');
    }

    // 3. Clean up control event listeners
    cleanupPongControls();

    // 4. Clean up WebSocket event listeners
    if (window.cleanupGameEventListeners)
    {
        window.cleanupGameEventListeners();
    }

    // 5 Force leaving the room on the server side to avoid ghost rooms
    forceLeaveCurrentRoom();

    // 6. Reset state flags
    cleanupState.eventListenersAdded = false;
    cleanupState.gameStateInitialized = false;
    cleanupState.canvas = null;
    cleanupState.ctx = null;
    cleanupState.sessionId = sessionId;

    // 6b. Stop the interpolation loop if it exists
    if (typeof window.stopRenderLoop === 'function')
    {
        window.stopRenderLoop();
    }

    // 7. Reset partial WebSocket listeners
    window._pongControlsRoomJoinedListener = false;
    window._roomJoinedHandlerSet = false;
    window._navigationListenerSet = false; // Reset navigation flag

    // CLEANUP COMPLETE - State reset for the next session
}

// Forces leaving the current room to avoid conflicts
function forceLeaveCurrentRoom(): void
{
    if (window.socket && window.socket.connected)
    {
        window.socket.emit('leaveAllRooms');
    }
}

// Forces Pong renderer reset
function resetPongRenderer(): void
{
    // This function will be called by the renderer to reset itself
    if (window.resetPongRenderer)
    {
        window.resetPongRenderer();
    }
}

// Forces Pong controls reset
function cleanupPongControls(): void
{
    // This function will be called by the controls to reset themselves
    if (window.cleanupPongControls)
    {
        window.cleanupPongControls();
    }
}

// Updates the cleanup state when the game is initialized
export function setGameInitialized(): void
{
    cleanupState.gameStateInitialized = true;
}

// Checks if the game has been properly cleaned up
export function isGameClean(): boolean
{
    return !cleanupState.gameStateInitialized &&
           !cleanupState.eventListenersAdded &&
           cleanupState.canvas === null;
}
