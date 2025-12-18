// Provides type definitions for Socket.io client communication with the server
type SocketIO =
{
    emit: (event: string, ...args: any[]) => void;
    on: (event: string, callback: (...args: any[]) => void) => void;
    once: (event: string, callback: (...args: any[]) => void) => void;
    off: (event: string, callback?: (...args: any[]) => void) => void;
    removeAllListeners: (event?: string) => void;
    disconnect: () => void;
    connected: boolean;
};

// Represents the complete game state received from the server for rendering the Pong game
type GameState =
{
    ballX: number;
    ballY: number;
    ballSpeedX?: number;
    ballSpeedY?: number;
    canvasWidth: number;
    canvasHeight: number;
    paddles: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        side: string;
        score: number;
    }>;
    [key: string]: any;
};

// Extends the global Window interface to include all application-specific properties and functions
declare global
{
    interface Window
    {
        socket: SocketIO;
        joinOrCreateRoom: (maxPlayers: number, isLocalGame?: boolean) => Promise<void>;
        sendPing: () => void;
        sendMessage: (type: MessageType, data: MessageData) => void;
        reconnectWebSocket: () => void;
        leaveCurrentRoomAsync: () => Promise<void>;

        isNavigatingAwayFromGame: boolean;

        controlledPaddle: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP' | null;
        isLocalGame: boolean;
        setIsLocalGame: (isLocal: boolean) => void;
        maxPlayers: number;
        isSpectator: boolean;
        aiMode: boolean;
        _aiMode: boolean;
        aiDifficulty: 'easy' | 'medium' | 'hard';
        isTournamentMode: boolean;
        lastGameType?: 'local2p' | 'local4p' | 'soloAI' | 'ranked1v1' | 'multiplayer4p' | 'tournament';

        setupGameEventListeners: () => void;
        cleanupGameEventListeners: () => void;
        initPongRenderer: (canvasId: string) => void;
        addGameState: (state: GameState) => void;
        startRenderLoop: () => void;
        stopRenderLoop: () => void;
        getCurrentInterpolatedState: () => GameState | null;
        getInterpolationDiagnostics: () =>
        {
            bufferSize: number;
            renderDelayMs: number;
            serverTimeOffset: number;
            latestServerTs: number | null;
            renderTs: number;
            isExtrapolating: boolean;
            extrapolationMs: number;
        };
        updatePaddleKeyBindings: () => void;
        initAIDifficultySelector: () => void;
        initGameConfigManagers: () => void;
        initAIConfigManagers: () => void;
        sendKeyEvent: (type: 'keydown' | 'keyup', player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') => void;
        _pongControlsRoomJoinedListener: boolean;
        _roomJoinedHandlerSet: boolean;

        drawPongGame: (state: GameState) => void;
        resetPongRenderer: () => void;
        draw: (gameState: GameState) => void;
        cleanupPongControls: () => void;
        applyCanvasRotation: (paddle: string | null, canvasId?: string) => void;
        resetCanvasRotation: (canvasId?: string) => void;

        setBackgroundThrottle: (enabled: boolean) => void;
        isBackgroundThrottled: () => boolean;
        pauseBackground: () => void;
        resumeBackground: () => void;

        _navigationListenerSet: boolean;
        _popStateListenerSet: boolean;

        currentTournamentId: string | null;
        currentMatchId: string | null;

        currentUser:
        {
            id: number;
            email?: string;
            username: string;
            avatar_url: string | null;
            wins?: number;
            losses?: number;
            created_at?: string;
            updated_at?: string;
            provider?: string;
            twoFactorEnabled?: boolean;
        } | null;
        logout: () => Promise<void>;
        refreshUserStats: () => Promise<boolean>;

        selectedProfileUser: any | null;
        selectedMatchData: any | null;
        selectedContextUser: any | null;
        contextMenuIsInGame: boolean;
        load: (page: string, data?: any) => Promise<void>;
        cleanupLandingHandlers: (() => void) | null;

        stopFriendListAutoRefresh: () => void;
        refreshFriendList: () => void;

        spectatorGameFinishedPage: any;

        temporaryAvatarFile?: File;

        __sessionDebug?: any;
    }
}

export {};