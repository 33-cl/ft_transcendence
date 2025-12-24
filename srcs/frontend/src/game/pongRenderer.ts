// pongRenderer.ts
// Manages the display of the Pong game based on the state received from the backend

import './pongInterpolation.js';

// ============================================================================
// CONFIGURATION & THEME
// ============================================================================

const THEME = {
    colors: {
        white: '#ffffff',
        red: '#ff0000',
        blue: '#0000ff',
        green: '#22c55e',
        shadow: 'rgba(0, 0, 0, 0.8)',
        paddles: {
            LEFT: '#ffffff',
            DOWN: '#ffffff',
            RIGHT: '#ffffff',
            TOP: '#ffffff',
            default: '#ffffff'
        }
    },
    fonts: {
        countdown: 'bold 96px "Press Start 2P", monospace'
    },
    layout: {
        lineWidth: 4,
        defaultPaddleWidth: 10,
        defaultPaddleHeight: 100,
        defaultMargin: 10
    }
};

// ============================================================================
// TYPES
// ============================================================================

interface PaddleState {
    x: number;
    y: number;
    width: number;
    height: number;
    side: string;
    score: number;
    color?: string;
    playerName?: string;
}

interface GameState {
    canvasWidth: number;
    canvasHeight: number;
    paddles: PaddleState[];
    paddleWidth?: number;
    paddleHeight?: number;
    paddleMargin?: number;
    leftPaddleY?: number;
    rightPaddleY?: number;
    leftScore?: number;
    rightScore?: number;
    ballX: number;
    ballY: number;
    ballRadius: number;
    ballCountdown?: number;
    [key: string]: any;
}

// ============================================================================
// STATE
// ============================================================================

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastGameState: GameState | null = null;

// ============================================================================
// HELPERS
// ============================================================================

function getColorForSide(side: string): string 
{
    return (THEME.colors.paddles as any)[side] || THEME.colors.paddles.default;
}

export function applyCanvasRotation(paddle: string | null, canvasId: string = 'map'): void {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvasElement) 
        return;
    
    if (!paddle || (paddle !== 'LEFT' && paddle !== 'DOWN' && paddle !== 'RIGHT' && paddle !== 'TOP')) {
        canvasElement.style.transform = '';
        return;
    }
    
    let rotation = 0;
    switch (paddle) {
        case 'LEFT': rotation = -90; break;
        case 'TOP': rotation = 180; break;
        case 'RIGHT': rotation = 90; break;
        case 'DOWN': rotation = 0; break;
    }
    
    canvasElement.style.transition = 'transform 0.3s ease';
    canvasElement.style.transform = rotation !== 0 ? `rotate(${rotation}deg)` : '';
}

export function resetCanvasRotation(canvasId: string = 'map'): void {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvasElement) 
    {
        canvasElement.style.transform = '';
        canvasElement.style.transition = '';
    }
}

// ============================================================================
// INITIALIZATION & CLEANUP
// ============================================================================

export function initPongRenderer(canvasId: string = 'map') {
    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) 
        return;
    
    ctx = canvas.getContext('2d');
    if (!ctx) 
        return;

    window.addEventListener('resize', handlePongResize);
}

function handlePongResize() {
    if (!canvas || !ctx) 
        return;

    if (lastGameState) 
        draw(lastGameState);
    else
        ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function resetPongRenderer(): void {
    window.removeEventListener('resize', handlePongResize);
    
    if (canvas && ctx) 
        ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas = null;
    ctx = null;
    lastGameState = null;
}

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================



function drawPaddles(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.paddles && state.paddles.length > 0) 
    {
        for (const paddle of state.paddles) 
        {
            const width = paddle.width ?? state.paddleWidth ?? THEME.layout.defaultPaddleWidth;
            const height = paddle.height ?? state.paddleHeight ?? THEME.layout.defaultPaddleHeight;
            
            let x = paddle.x;
            if (x === undefined) 
            {
                const margin = state.paddleMargin ?? THEME.layout.defaultMargin;
                if (paddle.side === 'LEFT') x = margin;
                else if (paddle.side === 'RIGHT') x = (state.canvasWidth ?? ctx.canvas.width) - margin - width;
                else x = 0;
            }
            
            const y = paddle.y ?? 0;
            
            ctx.save();
            ctx.fillStyle = paddle.color || THEME.colors.white;
            ctx.fillRect(x, y, width, height);
            ctx.restore();
        }
    } 
    else 
    {
        // Fallback 1v1 legacy
        const margin = state.paddleMargin ?? THEME.layout.defaultMargin;
        const width = state.paddleWidth ?? THEME.layout.defaultPaddleWidth;
        const height = state.paddleHeight ?? THEME.layout.defaultPaddleHeight;
        
        ctx.fillStyle = THEME.colors.white;
        ctx.fillRect(margin, state.leftPaddleY!, width, height);
        ctx.fillRect(state.canvasWidth - margin - width, state.rightPaddleY!, width, height);
    }
}

function drawBall(ctx: CanvasRenderingContext2D, state: GameState) 
{
    ctx.beginPath();
    ctx.arc(state.ballX, state.ballY, state.ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = THEME.colors.white;
    ctx.fill();
}

function drawCountdown(ctx: CanvasRenderingContext2D, state: GameState) {
    if (!state.ballCountdown || state.ballCountdown <= 0) 
        return;

    ctx.save();
    const centerX = state.canvasWidth / 2;
    const centerY = state.canvasHeight / 2;
    
    // Counter-rotation logic
    const paddle = (window as any).controlledPaddle;
    if (paddle && state.paddles && state.paddles.length === 4) 
    {
        ctx.translate(centerX, centerY);
        switch (paddle) 
        {
            case 'LEFT': ctx.rotate(Math.PI / 2); break;
            case 'RIGHT': ctx.rotate(-Math.PI / 2); break;
            case 'TOP': ctx.rotate(Math.PI); break;
        }
        ctx.translate(-centerX, -centerY);
    }
    
    ctx.font = THEME.fonts.countdown;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = state.ballCountdown.toString();
    
    // Shadow
    ctx.fillStyle = THEME.colors.shadow;
    ctx.fillText(text, centerX + 4, centerY + 4);
    
    // Outline
    ctx.strokeStyle = THEME.colors.white;
    ctx.lineWidth = THEME.layout.lineWidth;
    ctx.strokeText(text, centerX, centerY);
    
    // Main text
    ctx.fillStyle = THEME.colors.green;
    ctx.fillText(text, centerX, centerY);
    
    // Glow
    ctx.shadowColor = THEME.colors.green;
    ctx.shadowBlur = 20;
    ctx.fillText(text, centerX, centerY);
    
    ctx.restore();
}

function updateScoreBoard(state: GameState)
{
    const scoreElem = document.getElementById('score');
    if (!scoreElem)
        return;

    let newScoreHTML = '';
    if (state.paddles && Array.isArray(state.paddles))
    {
        if (state.paddles.length === 4)
        {
            newScoreHTML = state.paddles.map((p, i) =>
            {
                const displayName = p.playerName || p.side;
                return `<span id='score${i}' style='color: ${getColorForSide(p.side)}'>${displayName}: ${p.score || 0}</span>`;
            }).join(' | ');
        }
        else if (state.paddles.length === 2)
        {
            // Detect if it's an AI game by checking if window.aiMode is active
            const isAIMode = (window as any).aiMode === true;
            const currentUsername = (window as any).currentUser?.username;
            let leftName = state.paddles[0]?.playerName || 'P1';
            let rightName = state.paddles[1]?.playerName || 'P2';
            // In AI mode: AI is on the left (paddle 0), player is on the right (paddle 1)
            if (isAIMode)
            {
                leftName = 'AI';
                rightName = currentUsername || 'Player';
            }
            const leftScore = state.paddles[0]?.score || 0;
            const rightScore = state.paddles[1]?.score || 0;
            newScoreHTML = `<span id='leftScore'>${leftName}: ${leftScore}</span> - <span id='rightScore'>${rightName}: ${rightScore}</span>`;
        }
    }
    else
    {
        // Fallback 1v1 legacy
        const left = state.leftScore ?? 0;
        const right = state.rightScore ?? 0;
        newScoreHTML = `<span id='leftScore'>${left}</span> - <span id='rightScore'>${right}</span>`;
    }

    if (scoreElem.innerHTML !== newScoreHTML)
        scoreElem.innerHTML = newScoreHTML;

    // Update the display of the other semi-final (if available)
    updateOtherSemifinalDisplay(state);
}

/**
 * Updates the display of the other semi-final score in real time
 */
function updateOtherSemifinalDisplay(state: GameState)
{
    const otherSemifinalContainer = document.getElementById('other-semifinal');
    const otherSemifinalScore = document.getElementById('other-semifinal-score');
    const otherSemifinal = (state as any).otherSemifinal;
    if (!otherSemifinal || !otherSemifinalContainer || !otherSemifinalScore)
    {
        // No data for the other semi-final, hide the panel
        if (otherSemifinalContainer)
            otherSemifinalContainer.style.display = 'none';

        return;
    }
    // Show the panel
    otherSemifinalContainer.style.display = 'block';

    // Build the score display (simple text line)
    let scoreHTML = '';

    if (otherSemifinal.finished)
    {
        // Match finished
        const winner = otherSemifinal.score1 > otherSemifinal.score2 
            ? otherSemifinal.player1 
            : otherSemifinal.player2;
        scoreHTML = `Other semi-final: ${otherSemifinal.player1} vs ${otherSemifinal.player2} (${winner} won)`;
    }
    else
        scoreHTML = `Other semi-final: ${otherSemifinal.player1} vs ${otherSemifinal.player2}`;// Match in progress

    if (otherSemifinalScore.innerHTML !== scoreHTML)
        otherSemifinalScore.innerHTML = scoreHTML;
}

export function draw(gameState: GameState) 
{   
    if (!ctx || !canvas) 
        return;

    lastGameState = gameState;

    const gameWidth = gameState.canvasWidth || canvas.width;
    const gameHeight = gameState.canvasHeight || canvas.height;

    if (canvas.width !== gameWidth || canvas.height !== gameHeight) 
    {
        canvas.width = gameWidth;
        canvas.height = gameHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPaddles(ctx, gameState);
    drawBall(ctx, gameState);
    drawCountdown(ctx, gameState);
    updateScoreBoard(gameState);
}

// ============================================================================
// EXPORTS
// ============================================================================

(window as any).resetPongRenderer = resetPongRenderer;
(window as any).applyCanvasRotation = applyCanvasRotation;
(window as any).resetCanvasRotation = resetCanvasRotation;
(window as any).drawPongGame = draw;
(window as any).draw = draw;
(window as any).initPongRenderer = initPongRenderer;
