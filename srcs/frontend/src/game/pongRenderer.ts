// pongRenderer.ts
// Gère l'affichage du jeu Pong à partir de l'état reçu du backend

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

// Importer le système d'interpolation
import './pongInterpolation.js';

// Fonction pour obtenir la couleur selon le paddle
function getColorForSide(side: string): string {
    const colors: Record<string, string> = {
        'LEFT': '#ffffff',   // Gauche
        'DOWN': '#ffffff',   // Bas  
        'RIGHT': '#ffffff',  // Droite
        'TOP': '#ffffff'     // Haut
    };
    return colors[side] || '#ffffff';
}

/**
 * Applique une rotation CSS au canvas pour que le joueur ait toujours
 * son paddle en bas de l'écran visuellement (mode 4 joueurs uniquement)
 */
export function applyCanvasRotation(paddle: string | null, canvasId: string = 'map'): void {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvasElement) return;
    
    // Ne pas appliquer de rotation en mode 1v1 (seulement LEFT/RIGHT)
    // ou si pas de paddle assigné
    if (!paddle || (paddle !== 'LEFT' && paddle !== 'DOWN' && paddle !== 'RIGHT' && paddle !== 'TOP')) {
        canvasElement.style.transform = '';
        return;
    }
    
    // Calculer l'angle de rotation pour que le paddle soit toujours en bas
    let rotation = 0;
    switch (paddle) {
        case 'DOWN':
            rotation = 0;      // Déjà en bas, pas de rotation
            break;
        case 'LEFT':
            rotation = -90;    // Paddle gauche → tourner de -90° pour le mettre en bas
            break;
        case 'TOP':
            rotation = 180;    // Paddle haut → tourner de 180° pour le mettre en bas
            break;
        case 'RIGHT':
            rotation = 90;     // Paddle droite → tourner de 90° pour le mettre en bas
            break;
    }
    
    // Appliquer la rotation CSS avec une transition fluide
    canvasElement.style.transition = 'transform 0.3s ease';
    canvasElement.style.transform = rotation !== 0 ? `rotate(${rotation}deg)` : '';
}

/**
 * Réinitialise la rotation du canvas (appelé au cleanup)
 */
export function resetCanvasRotation(canvasId: string = 'map'): void {
    const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvasElement) {
        canvasElement.style.transform = '';
        canvasElement.style.transition = '';
    }
}

// Fonction d'initialisation du renderer Pong
export function initPongRenderer(canvasId: string = 'map')
{
    canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
        console.error(` Canvas #${canvasId} not found in DOM!`);
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(` Could not get 2D context from canvas`);
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
window.resetPongRenderer = resetPongRenderer;

// Exposer les fonctions de rotation globalement
window.applyCanvasRotation = applyCanvasRotation;
window.resetCanvasRotation = resetCanvasRotation;

// Exposer la fonction de dessin pour être utilisée par le système d'interpolation
window.drawPongGame = draw;

export function draw(gameState: any)
{   
    if (!ctx || !canvas) {
        return;
    }

    // Obtenir les dimensions du terrain de jeu depuis le gameState
    const gameWidth = gameState.canvasWidth || canvas.width;
    const gameHeight = gameState.canvasHeight || canvas.height;

    // Mettre à jour les dimensions du canvas si nécessaire
    if (canvas.width !== gameWidth || canvas.height !== gameHeight) {
        canvas.width = gameWidth;
        canvas.height = gameHeight;
    }

    // Clear le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- DESSIN DU TERRAIN ---
    if (gameState.paddles && gameState.paddles.length === 4) {
        // Mode 1v1v1v1 : carré avec bordures ROUGES
        ctx.save();
        ctx.strokeStyle = '#ff0000';  // Rouge pour mode 4 joueurs
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, gameWidth, gameHeight);
        ctx.restore();
    } else {
        // Mode 1v1 : rectangle classique avec bordures BLEUES
        ctx.save();
        ctx.strokeStyle = '#0000ff';  // Bleu pour mode 2 joueurs
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
                if (paddle.side === 'LEFT')
                    x = gameState.paddleMargin ?? 10;
                else if (paddle.side === 'RIGHT')
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
        
        const centerX = gameState.canvasWidth / 2;
        const centerY = gameState.canvasHeight / 2;
        
        // Appliquer une contre-rotation pour que le texte reste lisible
        // quand le canvas est tourné en mode 4 joueurs
        const paddle = window.controlledPaddle;
        if (paddle && gameState.paddles && gameState.paddles.length === 4) {
            ctx.translate(centerX, centerY);
            switch (paddle) {
                case 'LEFT':
                    ctx.rotate(Math.PI / 2);  // +90° pour contrer la rotation -90°
                    break;
                case 'RIGHT':
                    ctx.rotate(-Math.PI / 2); // -90° pour contrer la rotation +90°
                    break;
                case 'TOP':
                    ctx.rotate(Math.PI);      // 180° pour contrer la rotation 180°
                    break;
                // DOWN: pas de rotation nécessaire
            }
            ctx.translate(-centerX, -centerY);
        }
        
        // Configuration de la typographie selon la DA du site
        ctx.font = 'bold 96px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const countdownText = gameState.ballCountdown.toString();
        
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

    // --- AFFICHAGE DES SCORES (avec cache pour éviter les modifications DOM inutiles) ---
    const scoreElem = document.getElementById('score');
    if (scoreElem) {
        let newScoreHTML = '';
        if (gameState.paddles && Array.isArray(gameState.paddles)) {
            if (gameState.paddles.length === 4) {
                // Mode 1v1v1v1 : scores des 4 joueurs avec leurs noms
                newScoreHTML = gameState.paddles.map((p: any, i: number) => {
                    // Utiliser le nom du joueur si disponible, sinon la position
                    const displayName = p.playerName || p.side;
                    return `<span id='score${i}' style='color: ${getColorForSide(p.side)}'>${displayName}: ${p.score || 0}</span>`;
                }).join(' | ');
            } else if (gameState.paddles.length === 2) {
                // Mode 1v1 : gauche vs droite (avec noms si disponibles)
                const leftName = gameState.paddles[0]?.playerName || 'P1';
                const rightName = gameState.paddles[1]?.playerName || 'P2';
                const leftScore = gameState.paddles[0]?.score || 0;
                const rightScore = gameState.paddles[1]?.score || 0;
                newScoreHTML = `<span id='leftScore'>${leftName}: ${leftScore}</span> - <span id='rightScore'>${rightName}: ${rightScore}</span>`;
            }
        } else {
            // Fallback pour ancienne structure
            const left = gameState.leftScore ?? 0;
            const right = gameState.rightScore ?? 0;
            newScoreHTML = `<span id='leftScore'>${left}</span> - <span id='rightScore'>${right}</span>`;
        }
        // Ne mettre à jour le DOM que si le contenu a changé
        if (scoreElem.innerHTML !== newScoreHTML) {
            scoreElem.innerHTML = newScoreHTML;
        }
    }
}

window.draw = draw;
window.initPongRenderer = initPongRenderer;
