// pongRenderer.ts
// Gère l'affichage du jeu Pong à partir de l'état reçu du backend

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

export function initPongRenderer(canvasId: string = 'map')
{
    console.log('[RENDERER] initPongRenderer appelé avec canvasId:', canvasId);
    console.log('[RENDERER] État actuel - canvas:', !!canvas, 'ctx:', !!ctx);
    
    const previousCanvas = canvas;
    const previousCtx = ctx;
    
    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
        console.error('[RENDERER] Canvas non trouvé:', canvasId);
        console.error('[RENDERER] Éléments disponibles:', Array.from(document.querySelectorAll('canvas')).map(c => c.id));
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('[RENDERER] Impossible d\'obtenir le contexte 2D du canvas');
        return;
    }
    
    console.log('[RENDERER] Canvas initialisé avec succès');
    console.log('[RENDERER] Changement d\'état - canvas:', previousCanvas !== canvas, 'ctx:', previousCtx !== ctx);
    console.log('[RENDERER] Canvas dimensions:', canvas.width, 'x', canvas.height);
}

// Fonction de nettoyage du renderer
export function resetPongRenderer(): void {
    console.log('[RENDERER] Nettoyage du renderer Pong');
    if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas = null;
    ctx = null;
}

// Expose la fonction de reset globalement pour le cleanup
(window as any).resetPongRenderer = resetPongRenderer;

export function draw(gameState: any)
{
    // Logs de debug temporairement désactivés pour les performances
    // const drawId = Math.random().toString(36).substr(2, 9);
    // console.log(`[DRAW-${drawId}] === DÉBUT RENDU ===`);
    // console.log(`[DRAW-${drawId}] Canvas/ctx disponibles:`, !!canvas, !!ctx);
    
    if (!ctx || !canvas) {
        console.error(`[DRAW] Pas de canvas/ctx - abandon du rendu`);
        return;
    }
    
    // Log simplifié pour debug uniquement si nécessaire
    // console.log(`[DRAW] gameState:`, {
    //     paddlesCount: gameState.paddles?.length,
    //     ballX: gameState.ballX,
    //     ballY: gameState.ballY,
    //     running: gameState.running
    // });
    
    // Clear le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ...existing code...

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
    if (gameState.paddles && gameState.paddles.length > 0) {
        for (const paddle of gameState.paddles) {
            // Fallback pour les propriétés manquantes (1v1 local)
            const width = paddle.width ?? gameState.paddleWidth ?? 10;
            const height = paddle.height ?? gameState.paddleHeight ?? 100;
            let x = paddle.x;
            if (x === undefined) {
                if (paddle.side === 'A' || paddle.side === 'left')
                    x = gameState.paddleMargin ?? 10;
                else if (paddle.side === 'B' || paddle.side === 'right')
                    x = (gameState.canvasWidth ?? canvas.width) - (gameState.paddleMargin ?? 10) - width;
                else
                    x = 0;
            }
            const y = paddle.y ?? 0;
            ctx.save();
            ctx.fillStyle = paddle.color || 'white';
            ctx.fillRect(x, y, width, height);
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
        if (gameState.paddles && Array.isArray(gameState.paddles)) {
            if (gameState.paddles.length === 3) {
                // Mode 1v1v1 : scores dynamiques
                scoreElem.innerHTML = gameState.paddles.map((p: any, i: number) => `<span id='score${i}'>${p.score || 0}</span>`).join(' - ');
            } else if (gameState.paddles.length === 2) {
                // Mode 1v1 : gauche vs droite
                const leftScore = gameState.paddles[0]?.score || 0;
                const rightScore = gameState.paddles[1]?.score || 0;
                scoreElem.innerHTML = `<span id='leftScore'>${leftScore}</span> - <span id='rightScore'>${rightScore}</span>`;
            }
        } else {
            // Fallback pour ancienne structure
            const left = gameState.leftScore ?? 0;
            const right = gameState.rightScore ?? 0;
            scoreElem.innerHTML = `<span id='leftScore'>${left}</span> - <span id='rightScore'>${right}</span>`;
        }
    }

    // console.log(`[DRAW] === FIN RENDU ===`);
}

(window as any).draw = draw;
