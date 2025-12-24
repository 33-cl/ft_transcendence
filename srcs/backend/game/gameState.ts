// Defines game state, paddle positions, and initial setup for Pong

export type PaddleSide = 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP';
export type AIDifficulty = 'easy' | 'medium' | 'hard';

// Describes AI configuration for single-player mode
export interface AIConfig 
{
    // Basic settings
    enabled: boolean;
    difficulty: AIDifficulty;
    reactionTime: number;
    errorMargin: number;
    lastUpdate: number;
    targetY: number;
    currentY: number;
    isMoving: boolean;
    reactionStartTime: number;
    paddleSpeed: number;

    // Keyboard input simulation
    keyPressed: 'up' | 'down' | null;
    keyPressStartTime: number;
    keyHoldDuration: number;
    keyReleaseChance: number;

    // Human-like behaviors
    panicMode: boolean;
    lastDecisionTime: number;
    microcorrectionTimer: number;
    panicThreshold: number;
    microcorrectionChance: number;
    persistanceTime: number;
    maxErrorFrequency: number;

    // Debug and statistics
    debugMode: boolean;
    decisionCount: number;
    errorCount: number;
    panicCount: number;
}

// Represents the full state of a Pong game
export interface GameState
{
    // Canvas dimensions
    canvasHeight:   number;
    canvasWidth:    number;

    // Paddle properties
    paddleHeight:   number;
    paddleWidth:    number;
    paddleMargin:   number;
    paddles: 
    {
        x: number;
        y: number;
        width: number;
        height: number;
        side: PaddleSide;
        score: number;
    }[];
    paddleSpeed:    number;

    // Ball properties
    ballX:          number;
    ballY:          number;
    ballRadius:     number;
    ballSpeedX:     number;
    ballSpeedY:     number;

    // Game state
    win:            number;
    running:        boolean;
    ballCountdown:  number;
    timestamp?:     number;
    aiConfig: AIConfig | undefined;
}

// Creates the initial game state for Pong
export function createInitialGameState(numPlayers: number = 2): GameState 
{
    const canvasHeight  = 800;
    const canvasWidth   = numPlayers === 4 ? 800 : 1200;
    const paddleHeight  = 115;
    const paddleWidth   = 10;
    const paddleMargin  = 12;
    const defaultPaddleY = canvasHeight / 2 - paddleHeight / 2;
    const orderedPaddleSides: PaddleSide[] = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
    type PaddleSpec = { x: number; y: number; width: number; height: number; side: PaddleSide; score: number };

    // Generates paddle positions for 2 or 4 players
    function createPaddles(count: number): PaddleSpec[] 
    {
        const result: PaddleSpec[] = [];
        for (let i = 0; i < count; i++) 
        {
            let side = orderedPaddleSides[i];
            let x = 0;
            let y = defaultPaddleY;
            let width = paddleWidth;
            let height = paddleHeight;

            if (count === 2) 
            {
                if (i === 1)
                    side = 'RIGHT' as PaddleSide;
                if (side === 'LEFT')        x = paddleMargin;
                else if (side === 'RIGHT')  x = canvasWidth - paddleMargin - paddleWidth;
            } 
            else if (count === 4) 
            {
                switch (side) 
                {
                    case 'LEFT': 
                        x = paddleMargin;
                        y = canvasHeight / 2 - paddleHeight / 2;
                        width = paddleWidth;
                        height = paddleHeight;
                        break;
                    case 'DOWN': 
                        x = canvasWidth / 2 - paddleHeight / 2;
                        y = canvasHeight - paddleMargin - paddleWidth;
                        width = paddleHeight;
                        height = paddleWidth;
                        break;
                    case 'RIGHT': 
                        x = canvasWidth - paddleMargin - paddleWidth;
                        y = canvasHeight / 2 - paddleHeight / 2;
                        width = paddleWidth;
                        height = paddleHeight;
                        break;
                    case 'TOP': 
                        x = canvasWidth / 2 - paddleHeight / 2;
                        y = paddleMargin;
                        width = paddleHeight;
                        height = paddleWidth;
                        break;
                }
            }
            result.push({ x, y, width, height, side, score: 0 });
        }
        return result;
    }

    const paddles = createPaddles(numPlayers);
    return {
        canvasHeight:   canvasHeight,
        canvasWidth:    canvasWidth,
        paddleHeight:   paddleHeight,
        paddleWidth:    paddleWidth,
        paddleMargin:   paddleMargin,
        paddles:        paddles,
        paddleSpeed:    10,
        ballX:          canvasWidth / 2,
        ballY:          canvasHeight / 2,
        ballRadius:     15,
        ballSpeedX:     0,
        ballSpeedY:     0,
        win:            5,
        running:        false,
        ballCountdown:  3,
        timestamp:      Date.now(),
        aiConfig:       undefined,
    };
}
