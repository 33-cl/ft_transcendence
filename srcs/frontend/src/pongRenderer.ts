// pongRenderer.ts
// Gère l'affichage du jeu Pong à partir de l'état reçu du backend

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

export function initPongRenderer(canvasId: string = 'map')
{
    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas)
	{
        console.error('Canvas non trouvé:', canvasId);
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx)
        console.error('Impossible d\'obtenir le contexte 2D du canvas');
}

export function draw(gameState: any)
{
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Paddles
    ctx.fillStyle = 'white';
    ctx.fillRect(gameState.paddleMargin, gameState.leftPaddleY, gameState.paddleWidth, gameState.paddleHeight);
    ctx.fillRect(gameState.canvasWidth - gameState.paddleMargin - gameState.paddleWidth, gameState.rightPaddleY, gameState.paddleWidth, gameState.paddleHeight);
    // Balle
    ctx.beginPath();
    ctx.arc(gameState.ballX, gameState.ballY, gameState.ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    // Score
    const scoreElem = document.getElementById('score');
    if (scoreElem)
	{
        const left = gameState.leftScore ?? 0;
        const right = gameState.rightScore ?? 0;
        scoreElem.innerHTML = `<span id='leftScore'>${left}</span> - <span id='rightScore'>${right}</span>`;
    }
}

(window as any).draw = draw;
