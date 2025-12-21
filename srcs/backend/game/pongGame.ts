// PongGame.ts - Main backend class for Pong game
// Manages game state and updates.

import { GameState, createInitialGameState } from './gameState.js';
import { movePaddle } from './paddle.js';
import { resetBall, BallState, checkBallCollisions4Players, checkBallCollisions2Players, shouldResetBall } from './ball.js';
import { checkScoring4Players, checkScoring2Players, checkGameEnd4Players, checkGameEnd2Players } from './score.js';
import { updateAITarget, simulateKeyboardInput, createAIConfig } from './ai.js';

export class PongGame {
    public state: GameState;
    private interval: ReturnType<typeof setInterval> | null = null;
    private ballStartTime: number = 0;
    private readonly ballDelayMs: number = 3000;
    private isFirstLaunch: boolean = true;
    private onGameEnd?: (winner: { side: string; score: number }, loser: { side: string; score: number }) => void;
    private ballState: BallState = {
        accelerationCount: 0,
        pointScored: false,
        lastContact: -1
    };

    // Constructor initializes game state
    constructor(numPlayers: number = 2, onGameEnd?: (winner: { side: string; score: number }, loser: { side: string; score: number }) => void) {
        this.state = createInitialGameState(numPlayers);
        this.onGameEnd = onGameEnd; 
        this.ballState.accelerationCount = 0;
    }

    // Starts the game loop
    start() {
        if (this.state.running) return;
        this.state.running = true;
        this.ballStartTime = Date.now();
    }

    // Stops the game loop
    stop() {
        this.interval = null;
        this.state.running = false;
    }

    // Public method called by handleGameTick to advance one tick.
    tick(): void {
        if (!this.state.running) return;
        this.state.timestamp = Date.now();
        this.update(1 / 120);
    }

    // Moves the specified paddle in the given direction
    movePaddle(player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') {
        movePaddle(this.state, player, direction);
    }

    // Main update method called each tick
    update(dt: number = 1/60) {
        const currentTime = Date.now();
        const timeElapsed = currentTime - this.ballStartTime;
        const ballShouldMove = timeElapsed >= this.ballDelayMs;

        this.handleBallCountdownAndPosition(ballShouldMove, timeElapsed);
        if (this.isFirstLaunch && !ballShouldMove) return;

        this.moveBall(dt, ballShouldMove);

        if (this.state.paddles && this.state.paddles.length === 4) {
            this.handleFourPlayersMode();
            return;
        }

        if (this.state.paddles && this.state.paddles.length === 2) {
            this.handleTwoPlayersMode();
            return;
        }
    }

    // Handles countdown and initial ball position
    private handleBallCountdownAndPosition(ballShouldMove: boolean, timeElapsed: number) {
        if (this.isFirstLaunch && !ballShouldMove && timeElapsed >= 0) {
            const remainingTime = Math.max(0, this.ballDelayMs - timeElapsed);
            this.state.ballCountdown = Math.ceil(remainingTime / 1000);
            this.state.ballX = this.state.canvasWidth / 2;
            this.state.ballY = this.state.canvasHeight / 2;
            this.state.ballSpeedX = 0;
            this.state.ballSpeedY = 0;
        } else {
            this.state.ballCountdown = 0;
            if (ballShouldMove && this.isFirstLaunch) {
                this.isFirstLaunch = false;
                const angle = Math.random() * Math.PI / 2 - Math.PI / 4;
                const direction = Math.random() < 0.5 ? 1 : -1;
                const speed = 6.5;
                this.state.ballSpeedX = Math.cos(angle) * speed * direction;
                this.state.ballSpeedY = Math.sin(angle) * speed;
            }
        }
    }

    // Moves the ball if delay has passed
    private moveBall(dt: number, ballShouldMove: boolean) {
        if (!this.isFirstLaunch || ballShouldMove) {
            const moveFactor = dt * 60;
            this.state.ballX += this.state.ballSpeedX * moveFactor;
            this.state.ballY += this.state.ballSpeedY * moveFactor;
        }
    }

    // Four players mode logic
    private handleFourPlayersMode() {
        checkBallCollisions4Players(this.state, this.ballState);
        checkScoring4Players(this.state, this.ballState);
        if (shouldResetBall(this.state)) {
            this.resetBall();
        }
        const gameEndInfo = checkGameEnd4Players(this.state);
        if (gameEndInfo) {
            this.stop();
            if (this.onGameEnd) {
                this.onGameEnd(gameEndInfo.winner, gameEndInfo.loser);
            }
        }
    }

    // Two players mode logic (and AI)
    private handleTwoPlayersMode() {
        if (this.state.aiConfig && this.state.aiConfig.enabled) {
            updateAITarget(this.state);
            simulateKeyboardInput(this.state);
        }
        checkBallCollisions2Players(this.state, this.ballState);
        checkScoring2Players(this.state, this.ballState);
        if (shouldResetBall(this.state)) {
            this.resetBall();
        }
        const gameEndInfo = checkGameEnd2Players(this.state);
        if (gameEndInfo) {
            this.stop();
            if (this.onGameEnd) {
                this.onGameEnd(gameEndInfo.winner, gameEndInfo.loser);
            }
        }
    }

    // Resets the ball to the center with initial speed
    resetBall() {
        resetBall(this.state, this.ballState, this.isFirstLaunch);
        if (this.isFirstLaunch) {
            this.ballStartTime = Date.now();
        }
    }

    // Enables AI with specified difficulty
    enableAI(difficulty: 'easy' | 'medium' | 'hard') {
        if (this.state.paddles.length !== 2)
            return;
        this.state.aiConfig = createAIConfig(difficulty, this.state.paddleSpeed);
    }

    // Disables AI (2 human players mode)
    disableAI() {
        this.state.aiConfig = undefined;
    }

    // Enables AI debug mode to visualize decisions
    enableAIDebug() {
        if (this.state.aiConfig)
            this.state.aiConfig.debugMode = true;
    }

    // Disables AI debug mode
    disableAIDebug() {
        if (this.state.aiConfig)
            this.state.aiConfig.debugMode = false;
    }

    // Returns AI stats for evaluation
    getAIStats() {
        if (!this.state.aiConfig) {
            return null;
        }
        const ai = this.state.aiConfig;
        const errorRate = ai.decisionCount > 0 ? (ai.errorCount / ai.decisionCount * 100) : 0;
        return {
            difficulty: ai.difficulty,
            decisionCount: ai.decisionCount,
            errorCount: ai.errorCount,
            panicCount: ai.panicCount,
            errorRate: errorRate.toFixed(2) + '%',
            currentState: {
                panicMode: ai.panicMode,
                isMoving: ai.isMoving,
                keyPressed: ai.keyPressed,
                targetY: ai.targetY.toFixed(1),
                currentY: ai.currentY.toFixed(1)
            }
        };
    }
}


