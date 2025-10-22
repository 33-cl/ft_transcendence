// pongRenderer.ts
// Gère l'affichage du jeu Pong à partir de l'état reçu du backend

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

// Fonction pour obtenir la couleur selon le paddle
function getColorForSide(side: string): string {
    const colors: Record<string, string> = {
        'A': '#ff4444',  // Rouge - Gauche
        'B': '#44ff44',  // Vert - Bas  
        'C': '#4444ff',  // Bleu - Droite
        'D': '#ffff44'   // Jaune - Haut
    };
    return colors[side] || '#ffffff';
}

export function initPongRenderer(canvasId: string = 'map')
{
    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
}

// Fonction de nettoyage du renderer
export function resetPongRenderer(): void {
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
    if (!ctx || !canvas) {
        return;
    }
    
    
    // Clear le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Obtenir les dimensions du terrain de jeu depuis le gameState
    const gameWidth = gameState.canvasWidth || canvas.width;
    const gameHeight = gameState.canvasHeight || canvas.height;

    // --- DESSIN DU TERRAIN ---
    if (gameState.paddles && gameState.paddles.length === 4) {
        // Mode 1v1v1v1 : carré avec bordures
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, gameWidth, gameHeight);
        ctx.restore();
    } else {
        // Mode 1v1 : rectangle classique
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, gameWidth, gameHeight);
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

    // --- AFFICHAGE DU COMPTE À REBOURS ---
    if (gameState.ballCountdown && gameState.ballCountdown > 0) {
        ctx.save();
        
        // Configuration de la typographie selon la DA du site
        ctx.font = 'bold 96px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const countdownText = gameState.ballCountdown.toString();
        const centerX = gameState.canvasWidth / 2;
        const centerY = gameState.canvasHeight / 2;
        
        // Effet d'ombre portée pour plus de visibilité
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(countdownText, centerX + 4, centerY + 4);
        
        // Contour blanc pour un meilleur contraste
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.strokeText(countdownText, centerX, centerY);
        
        // Texte principal en vert selon la DA du site
        ctx.fillStyle = '#22c55e'; // Vert conforme à la palette du site
        ctx.fillText(countdownText, centerX, centerY);
        
        // Effet de brillance/glow
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 20;
        ctx.fillText(countdownText, centerX, centerY);
        
        ctx.restore();
    }

    // --- AFFICHAGE DES SCORES ---
    const scoreElem = document.getElementById('score');
    if (scoreElem) {
        if (gameState.paddles && Array.isArray(gameState.paddles)) {
            if (gameState.paddles.length === 4) {
                // Mode 1v1v1v1 : scores des 4 joueurs
                scoreElem.innerHTML = gameState.paddles.map((p: any, i: number) => `<span id='score${i}' style='color: ${getColorForSide(p.side)}'>${p.side}: ${p.score || 0}</span>`).join(' | ');
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
}

(window as any).draw = draw;
