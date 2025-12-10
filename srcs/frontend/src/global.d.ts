// Déclarations globales pour le front TypeScript (non inclus dans le JS final)

//--> Permet d'ajouter des fonctions utilisable dans la console

// Types pour Socket.io
type SocketIO = {
	emit: (event: string, ...args: any[]) => void;
	on: (event: string, callback: (...args: any[]) => void) => void;
	once: (event: string, callback: (...args: any[]) => void) => void;
	off: (event: string, callback?: (...args: any[]) => void) => void;
	removeAllListeners: (event?: string) => void;
	disconnect: () => void;
	connected: boolean;
};

// Types pour le système de jeu
type GameState = {
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

declare global
{
	interface Window
	{
		// === SOCKET & COMMUNICATION ===
		socket: SocketIO;
		joinOrCreateRoom: (maxPlayers: number, isLocalGame?: boolean) => Promise<void>;
		sendPing: () => void;
		sendMessage: (type: MessageType, data: MessageData) => void;
		reconnectWebSocket: () => void;
		leaveCurrentRoomAsync: () => Promise<void>;

		// === GAME STATE ===
		controlledPaddle: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP' | null;
		isLocalGame: boolean;
		setIsLocalGame: (isLocal: boolean) => void;
		maxPlayers: number;
		isSpectator: boolean;
		aiMode: boolean;
		_aiMode: boolean; // Internal flag for AI mode
		aiDifficulty: 'easy' | 'medium' | 'hard';
		isTournamentMode: boolean;
		lastGameType?: 'local2p' | 'local4p' | 'soloAI' | 'ranked1v1' | 'multiplayer4p' | 'tournament';

		// === GAME FUNCTIONS ===
		setupGameEventListeners: () => void;
		cleanupGameEventListeners: () => void;
		initPongRenderer: (canvasId: string) => void;
		addGameState: (state: GameState) => void;
		startRenderLoop: () => void;
		stopRenderLoop: () => void;
		updatePaddleKeyBindings: () => void;
		initAIDifficultySelector: () => void;
		initGameConfigManagers: () => void;
		initAIConfigManagers: () => void;
		sendKeyEvent: (type: 'keydown' | 'keyup', player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') => void;
		_pongControlsRoomJoinedListener: boolean;
		_roomJoinedHandlerSet: boolean;

		// === PONG RENDERER ===
		drawPongGame: (state: GameState) => void;
		resetPongRenderer: () => void;
		draw: (gameState: GameState) => void;
		cleanupPongControls: () => void;

		// === BACKGROUND ===
		setBackgroundThrottle: (enabled: boolean) => void;
		isBackgroundThrottled: () => boolean;

		// === NAVIGATION FLAGS ===
		_navigationListenerSet: boolean;
		_popStateListenerSet: boolean;

		// === TOURNAMENT ===
		currentTournamentId: string | null;
		currentMatchId: string | null;

		// === USER & AUTH ===
		currentUser: {
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

		// === 2FA PENDING STATE ===
		pending2FACredentials?: {
			login: string;
			password: string;
		};
		pendingOAuth2FA?: {
			tempToken: string;
		};

		// === PROFILE & NAVIGATION ===
		selectedProfileUser: any | null;
		selectedMatchData: any | null;
		selectedContextUser: any | null;
		contextMenuIsInGame: boolean;
		load: (page: string, data?: any) => Promise<void>;
		cleanupLandingHandlers: (() => void) | null;

		// === FRIENDS ===
		stopFriendListAutoRefresh: () => void;
		refreshFriendList: () => void;

		// === PAGES ===
		spectatorGameFinishedPage: any;

		// === FILES ===
		temporaryAvatarFile?: File;

		// === DEBUG ===
		__sessionDebug?: any;
	}
}
export {};
