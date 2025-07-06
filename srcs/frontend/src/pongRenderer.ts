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

    // --- DESSIN DU TERRAIN ---
    if (gameState.paddles && gameState.paddles.length === 3) {
        // Mode 1v1v1 : hexagone irrégulier
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.42;
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    } else {
        // Mode 1v1 : rectangle classique
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // --- DESSIN DES PADDLES ---
    if (gameState.paddles) {
        for (const paddle of gameState.paddles) {
            console.log('DRAW paddle', paddle, 'canvas', canvas.width, canvas.height); // DEBUG
            ctx.save();
            ctx.fillStyle = paddle.color || 'white';
            ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
            ctx.restore();
        }
    } else {
        // Rétrocompatibilité 1v1
        ctx.fillStyle = 'white';
        ctx.fillRect(gameState.paddleMargin, gameState.leftPaddleY, gameState.paddleWidth, gameState.paddleHeight);
        ctx.fillRect(gameState.canvasWidth - gameState.paddleMargin - gameState.paddleWidth, gameState.rightPaddleY, gameState.paddleWidth, gameState.paddleHeight);
    }

    // --- DESSIN DE LA BALLE ---
    ctx.beginPath();
    ctx.arc(gameState.ballX, gameState.ballY, gameState.ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // --- AFFICHAGE DES SCORES ---
    const scoreElem = document.getElementById('score');
    if (scoreElem) {
        if (gameState.scores && Array.isArray(gameState.scores)) {
            // Mode 1v1v1 : scores dynamiques
            scoreElem.innerHTML = gameState.scores.map((s: number, i: number) => `<span id='score${i}'>${s}</span>`).join(' - ');
        } else {
            // Mode 1v1 classique
            const left = gameState.leftScore ?? 0;
            const right = gameState.rightScore ?? 0;
            scoreElem.innerHTML = `<span id='leftScore'>${left}</span> - <span id='rightScore'>${right}</span>`;
        }
    }
}

(window as any).draw = draw;
