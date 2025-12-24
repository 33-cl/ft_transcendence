// pongInterpolation.ts
// Interpolation and extrapolation system for the Pong game
// Smooths the ball movement between states received from the server

// Interface for game states with timestamp
interface GameState {
    timestamp?: number;
    ballX: number;
    ballY: number;
    ballSpeedX?: number;
    ballSpeedY?: number;
    ballRadius?: number;
    ballCountdown?: number;
    canvasWidth: number;
    canvasHeight: number;
    paddles: {
        x: number;
        y: number;
        width: number;
        height: number;
        side: string;
        score: number;
    }[];
    [key: string]: any;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Render delay in ms (buffer to absorb network jitter)
// Higher = smoother but more visual latency
// 80ms absorbs ~60ms bursts observed in logs
const RENDER_DELAY_MS = 80;

// Max number of states in the buffer
const MAX_BUFFER_SIZE = 15;

// Max extrapolation duration in ms (beyond that, freeze)
const MAX_EXTRAPOLATION_MS = 100;

// Threshold to consider two positions as identical (server duplicates)
const DUPLICATE_THRESHOLD = 0.01;

// Max age threshold to accept a state (ignore too old states arriving in burst)
const MAX_STATE_AGE_MS = 200;

// Server speed conversion
// Server speed is in "pixels per frame at 60 FPS" (normalized with dt * 60)
// Real speed in px/sec = ballSpeed * 60
// Speed in px/ms = ballSpeed * 60 / 1000 = ballSpeed * 0.06
const SPEED_TO_PX_PER_MS = 0.06; // Conversion factor: speed * 0.06 = px/ms

// ============================================================================
// MODULE STATE
// ============================================================================

// Circular buffer of received states (sorted by timestamp)
let stateBuffer: GameState[] = [];

// Last interpolated/extrapolated state (for rendering)
let currentRenderState: GameState | null = null;

// Offset between client and server time (approximate)
let serverTimeOffset = 0;

// Flag for the render loop
let isRenderLoopRunning = false;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Returns the estimated server time
function getServerTime(): number {
    return Date.now() + serverTimeOffset;
}

// Linearly interpolates between two values
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// Clone a game state
function cloneState(state: GameState): GameState {
    return {
        ...state,
        paddles: state.paddles.map(p => ({ ...p }))
    };
}

// Utility: computes the distance between two points
function distanceToCenter(x: number, y: number, centerX: number, centerY: number): number {
    return Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
}

// Utility: checks if paddles have moved
function paddlesHaveMoved(paddlesA: {x: number, y: number}[], paddlesB: {x: number, y: number}[]): boolean {
    for (let i = 0; i < paddlesA.length; i++) {
        const curr = paddlesA[i];
        const prev = paddlesB[i];
        if (curr && prev && (Math.abs(curr.x - prev.x) > 0.5 || Math.abs(curr.y - prev.y) > 0.5)) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// BUFFER MANAGEMENT
// ============================================================================

/**
 * Adds a new state to the buffer
 * Keeps the buffer sorted by timestamp and limits its size
 * Filters duplicates and too old states
 */
export function addGameState(gameState: GameState): void {
    // Normalize and force numeric fields to avoid strings or undefined
    if (!gameState.timestamp) {
        gameState.timestamp = Date.now();
    }
    gameState.timestamp = Number(gameState.timestamp);
    gameState.ballX = Number(gameState.ballX);
    gameState.ballY = Number(gameState.ballY);
    if (gameState.ballSpeedX !== undefined) gameState.ballSpeedX = Number(gameState.ballSpeedX);
    if (gameState.ballSpeedY !== undefined) gameState.ballSpeedY = Number(gameState.ballSpeedY);
    if (gameState.ballRadius !== undefined) gameState.ballRadius = Number(gameState.ballRadius);

    const now = Date.now();
    
    // Ignore too old states (arrived in delayed burst)
    const stateAge = now - gameState.timestamp;
    if (stateAge > MAX_STATE_AGE_MS) {
        return;
    }

    // Detect a ball reset (position at center + large teleportation)
    // When this happens, clear the buffer to avoid visual artifacts
    if (stateBuffer.length > 0) {
        const last = stateBuffer[stateBuffer.length - 1]!;
        const centerX = gameState.canvasWidth / 2;
        const centerY = gameState.canvasHeight / 2;
        const isAtCenter = Math.abs(gameState.ballX - centerX) < 20 && 
                           Math.abs(gameState.ballY - centerY) < 20;
        const lastDistance = distanceToCenter(last.ballX, last.ballY, centerX, centerY);
        // If the ball is at the center and was far before = reset detected
        if (isAtCenter && lastDistance > 100) {
            // Clear the buffer for immediate transition
            // stateBuffer = []; // COMMENTED: We keep the buffer to allow exit extrapolation in interpolateStates
        }
    }

    // Filter duplicates: same position as the last state
    // IMPORTANT: Do not filter if:
    // - The ballCountdown has changed (otherwise the 3-2-1 does not display)
    // - We are in countdown phase (ball stationary but paddles move)
    // - The paddles have changed position
    if (stateBuffer.length > 0) {
        const last = stateBuffer[stateBuffer.length - 1]!;
        const deltaBallX = Math.abs(gameState.ballX - last.ballX);
        const deltaBallY = Math.abs(gameState.ballY - last.ballY);
        const countdownChanged = (gameState.ballCountdown !== undefined && 
                                   gameState.ballCountdown !== last.ballCountdown);
        const isInCountdown = gameState.ballCountdown !== undefined && gameState.ballCountdown > 0;
        
        // Check if paddles have moved
        let paddlesMoved = false;
        if (gameState.paddles && last.paddles && gameState.paddles.length === last.paddles.length) {
            paddlesMoved = paddlesHaveMoved(gameState.paddles, last.paddles);
        }
        
        // Do not filter if we are in countdown OR if paddles have moved OR if countdown has changed
        if (deltaBallX < DUPLICATE_THRESHOLD && deltaBallY < DUPLICATE_THRESHOLD && 
            !countdownChanged && !isInCountdown && !paddlesMoved) {
            return;
        }
    }

    // Update server offset (more stable moving average)
    // We use a lower factor to avoid fluctuations due to network bursts
    const newOffset = gameState.timestamp - now;
    // Only update if the difference is not too large (avoid jumps)
    const offsetDiff = Math.abs(newOffset - serverTimeOffset);
    if (serverTimeOffset === 0) {
        // First state - initialize directly
        serverTimeOffset = newOffset;
    } else if (offsetDiff < 50) {
        // Reasonable difference - progressive update
        serverTimeOffset = serverTimeOffset * 0.95 + newOffset * 0.05;
    }
    // If offsetDiff >= 50ms, ignore this update (probably a burst)
    
    // Add to buffer
    const newState = cloneState(gameState);
    stateBuffer.push(newState);
    
    // Sort by timestamp (normally already sorted but for safety)
    stateBuffer.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Limit buffer size
    while (stateBuffer.length > MAX_BUFFER_SIZE) {
        stateBuffer.shift();
    }
}

// Helper: computes velocity (pixels per millisecond) from the last two states in the buffer
function computeVelocityFromBuffer(): { vx: number; vy: number } | null {
    if (stateBuffer.length < 2) return null;
    const last = stateBuffer[stateBuffer.length - 1]!;
    const prev = stateBuffer[stateBuffer.length - 2]!;
    const lastTimestamp = Number(last.timestamp || 0);
    const prevTimestamp = Number(prev.timestamp || 0);
    const deltaTime = lastTimestamp - prevTimestamp;
    if (!deltaTime) return null;
    const vx = (last.ballX - prev.ballX) / deltaTime; // pixels per ms
    const vy = (last.ballY - prev.ballY) / deltaTime; // pixels per ms
    return { vx, vy };
}

/**
 * Finds the two states surrounding a given timestamp
 * Returns [beforeState, afterState, ratio] or null
 */
function findInterpolationStates(targetTime: number): [GameState, GameState, number] | null {
    if (stateBuffer.length < 2) {
        return null;
    }
    // Search for the two states surrounding targetTime
    for (let i = 0; i < stateBuffer.length - 1; i++) {
        const before = stateBuffer[i]!;
        const after = stateBuffer[i + 1]!;
        const beforeTime = before.timestamp || 0;
        const afterTime = after.timestamp || 0;
        if (beforeTime <= targetTime && targetTime <= afterTime) {
            const duration = afterTime - beforeTime;
            const ratio = duration > 0 ? (targetTime - beforeTime) / duration : 0;
            return [before, after, Math.max(0, Math.min(1, ratio))];
        }
    }
    return null;
}

// ============================================================================
// INTERPOLATION / EXTRAPOLATION
// ============================================================================

/**
 * Interpolates between two game states
 */
function interpolateStates(before: GameState, after: GameState, t: number): GameState {
    const result = cloneState(before);
    
    // Copy the countdown from the most recent state BEFORE interpolation
    // to be able to check if we need to freeze the ball
    if (after.ballCountdown !== undefined) result.ballCountdown = after.ballCountdown;
    
    // During the countdown, DO NOT interpolate the ball - it must stay in the center
    if (result.ballCountdown && result.ballCountdown > 0) {
        result.ballX = result.canvasWidth / 2;
        result.ballY = result.canvasHeight / 2;
    } else {
        // Interpolate the ball position normally
        // Detect a large jump (reset) > 100px
        const distSq = Math.pow(before.ballX - after.ballX, 2) + Math.pow(before.ballY - after.ballY, 2);
        
        if (distSq > 10000) {
            // This is a reset! Extrapolate the exit trajectory instead of interpolating to the center
            let vx = 0, vy = 0;
            if (before.ballSpeedX !== undefined && before.ballSpeedY !== undefined) {
                 vx = before.ballSpeedX * SPEED_TO_PX_PER_MS;
                 vy = before.ballSpeedY * SPEED_TO_PX_PER_MS;
            }
            // Extrapolate from 'before'
            const duration = (after.timestamp || 0) - (before.timestamp || 0);
            const dt = duration * t; // Time elapsed since 'before'
            
            result.ballX = before.ballX + vx * dt;
            result.ballY = before.ballY + vy * dt;
        } else {
            result.ballX = lerp(before.ballX, after.ballX, t);
            result.ballY = lerp(before.ballY, after.ballY, t);
        }
    }
    
    // Interpolate paddles
    for (let i = 0; i < result.paddles.length && i < after.paddles.length; i++) {
        result.paddles[i]!.x = lerp(before.paddles[i]!.x, after.paddles[i]!.x, t);
        result.paddles[i]!.y = lerp(before.paddles[i]!.y, after.paddles[i]!.y, t);
        // Scores: no interpolation, take the most recent value
        result.paddles[i]!.score = after.paddles[i]!.score;
    }
    
    // Copy speeds from the most recent state (for future extrapolation)
    if (after.ballSpeedX !== undefined) result.ballSpeedX = after.ballSpeedX;
    if (after.ballSpeedY !== undefined) result.ballSpeedY = after.ballSpeedY;
    
    return result;
}

/**
 * Extrapolates a state into the future using the speeds
 */
function extrapolateState(baseState: GameState, deltaMs: number): GameState {
    const result = cloneState(baseState);
    
    // Limit extrapolation
    const limitedDelta = Math.min(deltaMs, MAX_EXTRAPOLATION_MS);
    
    // DO NOT extrapolate the BALL during the countdown - it must stay in the center
    // But continue for paddles (no extrapolation needed as they are in the state)
    if (result.ballCountdown && result.ballCountdown > 0) {
        // Force the ball to the center during the countdown
        result.ballX = result.canvasWidth / 2;
        result.ballY = result.canvasHeight / 2;
        // Do not return here - we want to keep the paddle positions from the base state
        return result;
    }

    // Determine speed in pixels/milliseconds
    let vx: number = 0;
    let vy: number = 0;

    if (result.ballSpeedX !== undefined && result.ballSpeedY !== undefined) {
        // Convert from "pixels per frame at 60FPS" to px/ms
        // Real speed = ballSpeed * 60 pixels/sec = ballSpeed * 0.06 px/ms
        vx = result.ballSpeedX * SPEED_TO_PX_PER_MS;
        vy = result.ballSpeedY * SPEED_TO_PX_PER_MS;
    } else {
        // Fallback: calculate from the last two states
        const derived = computeVelocityFromBuffer();
        if (derived) {
            vx = derived.vx;
            vy = derived.vy;
        }
    }

    // Extrapolate the ball: position = position + speed * delta_ms
    result.ballX += vx * limitedDelta;
    result.ballY += vy * limitedDelta;

    // Clamp within the canvas (simple, no bounce)
    const radius = result.ballRadius || 15;
    // Do not clamp X to let the ball visually exit
    // result.ballX = Math.max(radius, Math.min(result.canvasWidth - radius, result.ballX));
    result.ballY = Math.max(radius, Math.min(result.canvasHeight - radius, result.ballY));

    return result;
}

/**
 * Computes the state to display for a given time
 */
function computeRenderState(renderTime: number): GameState | null {
    if (stateBuffer.length === 0) {
        return null;
    }
    
    // Case 1: Interpolation - we have states surrounding renderTime
    const interpResult = findInterpolationStates(renderTime);
    if (interpResult) {
        const [before, after, t] = interpResult;
        return interpolateStates(before, after, t);
    }
    
    // Case 2: Extrapolation - renderTime is after all states
    const latestState = stateBuffer[stateBuffer.length - 1]!;
    const latestTime = latestState.timestamp || 0;
    
    if (renderTime > latestTime) {
        const deltaMs = renderTime - latestTime;
        return extrapolateState(latestState, deltaMs);
    }
    
    // Case 3: renderTime is before all states (rare) - use the oldest
    return cloneState(stateBuffer[0]!);
}

// ============================================================================
// RENDER LOOP
// ============================================================================

/**
 * Starts the render loop
 */
export function startRenderLoop(): void {
    if (isRenderLoopRunning) return;
    
    isRenderLoopRunning = true;
    requestAnimationFrame(renderLoop);
}

/**
 * Stops the render loop and clears the buffer
 */
export function stopRenderLoop(): void {
    isRenderLoopRunning = false;
    stateBuffer = [];
    currentRenderState = null;
    serverTimeOffset = 0;
}

/**
 * Returns the current interpolated state (for external use)
 */
export function getCurrentInterpolatedState(): GameState | null {
    return currentRenderState;
}

/**
 * Main render loop
 */
function renderLoop(_timestamp: number): void
{
    if (!isRenderLoopRunning)
    {
        return;
    }
    // Compute render time (server time - delay)
    const renderTime = getServerTime() - RENDER_DELAY_MS;
    // Compute the state to display
    currentRenderState = computeRenderState(renderTime);
    // If we have a state, call the render function
    if (currentRenderState && window.drawPongGame)
    {
        window.drawPongGame(currentRenderState);
    }
    // Clean up old states (keep only the useful ones)
    const cutoffTime = renderTime - 200; // Keep 200ms of history
    while (stateBuffer.length > 2 && (stateBuffer[0]?.timestamp || 0) < cutoffTime)
    {
        stateBuffer.shift();
    }
    // Continue the loop
    requestAnimationFrame(renderLoop);
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Returns diagnostic information for debugging
 */
export function getInterpolationDiagnostics(): {
    bufferSize: number;
    renderDelayMs: number;
    serverTimeOffset: number;
    latestServerTs: number | null;
    renderTs: number;
    isExtrapolating: boolean;
    extrapolationMs: number;
}
{
    const renderTime = getServerTime() - RENDER_DELAY_MS;
    const latestState = stateBuffer.length > 0 ? stateBuffer[stateBuffer.length - 1] : null;
    const latestServerTs = latestState?.timestamp || null;
    let isExtrapolating = false;
    let extrapolationMs = 0;
    if (latestServerTs !== null && renderTime > latestServerTs)
    {
        isExtrapolating = true;
        extrapolationMs = renderTime - latestServerTs;
    }
    return {
        bufferSize: stateBuffer.length,
        renderDelayMs: RENDER_DELAY_MS,
        serverTimeOffset,
        latestServerTs,
        renderTs: renderTime,
        isExtrapolating,
        extrapolationMs
    };
}
// Expose for debug
window.getInterpolationDiagnostics = getInterpolationDiagnostics;

// ============================================================================
// EXPORT GLOBAL
// ============================================================================
window.addGameState = addGameState;
window.startRenderLoop = startRenderLoop;
window.stopRenderLoop = stopRenderLoop;
window.getCurrentInterpolatedState = getCurrentInterpolatedState;
