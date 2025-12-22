// Implements AI logic for single-player Pong mode

import { GameState, AIDifficulty, AIConfig } from './gameState.js';
import { movePaddle } from './paddle.js';

// Difficulty settings for AI behavior
const DIFFICULTY_SETTINGS = {
    easy: {
        reactionTime: 800,
        errorMargin: 30,
        keyHoldDuration: 200,
        keyReleaseChance: 0.2,
        panicThreshold: 200,
        microcorrectionChance: 0.08,
        persistanceTime: 500,
        maxErrorFrequency: 0.20
    },
    medium: {
        reactionTime: 500,
        errorMargin: 10,
        keyHoldDuration: 100,
        keyReleaseChance: 0.1,
        panicThreshold: 100,
        microcorrectionChance: 0.25,
        persistanceTime: 250,
        maxErrorFrequency: 0.10
    },
    hard: {
        reactionTime: 100,
        errorMargin: 1,
        keyHoldDuration: 60,
        keyReleaseChance: 0.01,
        panicThreshold: 50,
        microcorrectionChance: 0.8,
        persistanceTime: 100,
        maxErrorFrequency: 0.01
    }
};

// Creates an AI configuration for the selected difficulty
export function createAIConfig(difficulty: AIDifficulty, paddleSpeed: number): AIConfig 
{
    const settings = DIFFICULTY_SETTINGS[difficulty];

    return {
        enabled: true,
        difficulty: difficulty,
        reactionTime: settings.reactionTime,
        errorMargin: settings.errorMargin,
        lastUpdate: 0,
        targetY: 400,
        currentY: 400,
        isMoving: false,
        reactionStartTime: 0,
        paddleSpeed: paddleSpeed,

        // Keyboard input simulation
        keyPressed: null,
        keyPressStartTime: 0,
        keyHoldDuration: settings.keyHoldDuration,
        keyReleaseChance: settings.keyReleaseChance,

        // Human-like behaviors
        panicMode: false,
        lastDecisionTime: 0,
        microcorrectionTimer: 0,
        panicThreshold: settings.panicThreshold,
        microcorrectionChance: settings.microcorrectionChance,
        persistanceTime: settings.persistanceTime,
        maxErrorFrequency: settings.maxErrorFrequency,

        // Debug and statistics
        debugMode: true,
        decisionCount: 0,
        errorCount: 0,
        panicCount: 0
    };
}

// Predicts where the ball will land on the left paddle
export function predictBallLanding(state: GameState): number 
{
    if (state.ballSpeedX >= 0)
        return state.ballY;

    const paddleLeftEdge = state.paddleMargin + state.paddleWidth;
    const timeToReachPaddle = (state.ballX - paddleLeftEdge) / Math.abs(state.ballSpeedX);

    let predictedY = state.ballY + (state.ballSpeedY * timeToReachPaddle);

    while (predictedY < 0 || predictedY > state.canvasHeight)
    {
        if (predictedY < 0)
            predictedY = Math.abs(predictedY);
        if (predictedY > state.canvasHeight)
            predictedY = state.canvasHeight - (predictedY - state.canvasHeight);
    }

    return predictedY;
}

// Updates the AI's target position (called up to once per second)
export function updateAITarget(state: GameState): void 
{
    if (!state.aiConfig) 
        return;

    const currentTime = Date.now();
    const aiConfig = state.aiConfig;
    const updateInterval = aiConfig.difficulty === 'easy' ? 2200 :
        aiConfig.difficulty === 'medium' ? 1600 : 1000;
    if (currentTime - aiConfig.lastUpdate < updateInterval) 
        return;

    const ballDistance = Math.abs(state.ballX - (state.paddleMargin + state.paddleWidth));
    const wasPanic = aiConfig.panicMode;
    aiConfig.panicMode = ballDistance <= aiConfig.panicThreshold && state.ballSpeedX < 0;
    if (aiConfig.panicMode && !wasPanic)
        aiConfig.panicCount++;
    
    let baseTargetY;
    let isNewDecision = false;
    if (aiConfig.lastDecisionTime > 0 && (currentTime - aiConfig.lastDecisionTime) < aiConfig.persistanceTime)
        baseTargetY = aiConfig.targetY;
    else
    {
        let predictedY = predictBallLanding(state);
        if (aiConfig.difficulty === 'easy')
        {
            const smallOffset = (Math.random() - 0.5) * aiConfig.errorMargin;
            predictedY += smallOffset;
            if (Math.random() < 0.05)
            {
                const bigMiss = (Math.random() - 0.5) * aiConfig.errorMargin * 5;
                predictedY += bigMiss;
            }
        }
        baseTargetY = predictedY;
        aiConfig.lastDecisionTime = currentTime;
        aiConfig.decisionCount++;
        isNewDecision = true;
    }

    let targetY = baseTargetY;
    const errorChance = aiConfig.panicMode ? aiConfig.maxErrorFrequency * 1.5 : aiConfig.maxErrorFrequency;
    if (Math.random() < errorChance)
    {
        const errorOffset = (Math.random() - 0.5) * aiConfig.errorMargin * 2;
        targetY += errorOffset;
        aiConfig.errorCount++;
    }

    if (Math.random() < aiConfig.microcorrectionChance)
    {
        const microError = (Math.random() - 0.5) * (aiConfig.errorMargin * 0.3);
        targetY += microError;
    }

    const paddleHeight = state.paddles[0]?.height || state.paddleHeight;
    const minY = paddleHeight / 2;
    const maxY = state.canvasHeight - paddleHeight / 2;

    targetY = Math.max(minY, Math.min(maxY, targetY));
    aiConfig.targetY = targetY;
    aiConfig.lastUpdate = currentTime;
    aiConfig.isMoving = Math.abs(targetY - aiConfig.currentY) > getAdaptiveThreshold(aiConfig);
}

// Returns the adaptive movement threshold for the AI
function getAdaptiveThreshold(aiConfig: AIConfig): number 
{
    if (aiConfig.panicMode)                 return 3;
    if (aiConfig.difficulty === 'hard')     return 4;
    if (aiConfig.difficulty === 'medium')   return 6;

    return 8;
}

// Returns the adaptive reaction time for the AI
function getAdaptiveReactionTime(aiConfig: AIConfig): number 
{
    return aiConfig.panicMode ? aiConfig.reactionTime * 0.7 : aiConfig.reactionTime;
}

// Returns the adaptive key hold duration for the AI
function getAdaptiveHoldDuration(aiConfig: AIConfig): number 
{
    return aiConfig.panicMode ? aiConfig.keyHoldDuration * 0.6 : aiConfig.keyHoldDuration;
}

// Simulates keyboard input for the AI (called every frame)
export function simulateKeyboardInput(state: GameState): void 
{
    if (!state.aiConfig || !state.aiConfig.enabled) 
        return;

    const aiConfig = state.aiConfig;
    const currentTime = Date.now();
    if (state.paddles && state.paddles.length >= 1)
        aiConfig.currentY = state.paddles[0].y;

    if (aiConfig.microcorrectionTimer > 0)
        aiConfig.microcorrectionTimer = Math.max(0, aiConfig.microcorrectionTimer - 16);
    
    if (aiConfig.isMoving && aiConfig.reactionStartTime === 0)
    {
        aiConfig.reactionStartTime = currentTime;
        return;
    }

    const adaptiveReactionTime = getAdaptiveReactionTime(aiConfig);
    if (aiConfig.isMoving && currentTime - aiConfig.reactionStartTime < adaptiveReactionTime)
        return;

    if (!aiConfig.isMoving)
    {
        aiConfig.reactionStartTime = 0;
        aiConfig.keyPressed = null;
        aiConfig.keyPressStartTime = 0;
        return;
    }

    const paddleCenter = aiConfig.currentY + (state.paddles[0]?.height || state.paddleHeight) / 2;
    const distanceToTarget = aiConfig.targetY - paddleCenter;
    const threshold = aiConfig.panicMode ? 2 : getAdaptiveThreshold(aiConfig);
    if (Math.abs(distanceToTarget) <= threshold)
    {
        aiConfig.keyPressed = null;
        aiConfig.keyPressStartTime = 0;
        return;
    }

    const requiredDirection: 'up' | 'down' = distanceToTarget < 0 ? 'up' : 'down';
    if (!aiConfig.keyPressed)
    {
        aiConfig.keyPressed = requiredDirection;
        aiConfig.keyPressStartTime = currentTime;
        movePaddle(state, 'LEFT', requiredDirection);
    }
    else if (aiConfig.keyPressed === requiredDirection)
    {
        const keyHeldDuration = currentTime - aiConfig.keyPressStartTime;
        const adaptiveHoldDuration = getAdaptiveHoldDuration(aiConfig);
        let adaptiveReleaseChance = aiConfig.keyReleaseChance;
        if (aiConfig.panicMode && aiConfig.difficulty !== 'hard')
            adaptiveReleaseChance *= 1.5;

        if (keyHeldDuration >= adaptiveHoldDuration && Math.random() < adaptiveReleaseChance)
        {
            aiConfig.keyPressed = null;
            aiConfig.keyPressStartTime = 0;
            if (Math.random() < aiConfig.microcorrectionChance)
                aiConfig.microcorrectionTimer = 100 + Math.random() * 200;
        }
        else
            movePaddle(state, 'LEFT', requiredDirection);
    }
    else
    {
        const directionChangeDelay = aiConfig.panicMode ? 50 : 150;
        if (currentTime - aiConfig.keyPressStartTime >= directionChangeDelay)
        {
            aiConfig.keyPressed = requiredDirection;
            aiConfig.keyPressStartTime = currentTime;
            movePaddle(state, 'LEFT', requiredDirection);
        }
    }
}