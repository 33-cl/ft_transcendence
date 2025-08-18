// Pong logic backend (TypeScript, sans DOM)
// Ce module gère l'état du jeu et les mises à jour, sans aucune dépendance au DOM ou au navigateur.

import { GameState, createInitialGameState } from './gameState.js';

export class PongGame {
    public state: GameState;
    private interval: ReturnType<typeof setInterval> | null = null;

    constructor(numPlayers: number = 2) {
        this.state = createInitialGameState(numPlayers);
    }

    start() {
        if (this.interval) return;
        this.state.running = true;
        this.interval = setInterval(() => this.update(), 1000 / 60); // 60 FPS
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.state.running = false;
    }

    movePaddle(player: 'left' | 'right' | 'A' | 'B' | 'C' | 'D', direction: 'up' | 'down') {
        console.log('[BACKEND] movePaddle called:', player, direction, 'paddles.length=', this.state.paddles?.length);
        const speed = this.state.paddleSpeed;
        // Mode 1v1 : paddles[0] = A (gauche), paddles[1] = C (droite)
        if (this.state.paddles && this.state.paddles.length === 2) {
            console.log('[BACKEND] Mode 1v1, paddle sides:', this.state.paddles.map(p => p.side));
            if (player === 'left' || player === 'A') {
                // Paddle A est à l'index 0
                console.log('[BACKEND] Déplacement paddle A (index 0)');
                if (direction === 'up') this.state.paddles[0].y = Math.max(0, this.state.paddles[0].y - speed);
                else this.state.paddles[0].y = Math.min(this.state.canvasHeight - this.state.paddles[0].height, this.state.paddles[0].y + speed);
            } else if (player === 'right' || player === 'C') {
                // Paddle C est à l'index 1
                console.log('[BACKEND] Déplacement paddle C (index 1)');
                if (direction === 'up') this.state.paddles[1].y = Math.max(0, this.state.paddles[1].y - speed);
                else this.state.paddles[1].y = Math.min(this.state.canvasHeight - this.state.paddles[1].height, this.state.paddles[1].y + speed);
            } else {
                console.log('[BACKEND] Player non reconnu en mode 1v1:', player);
            }
        }
        // Mode 1v1v1v1 : paddles[0]=A, paddles[1]=B, paddles[2]=C, paddles[3]=D
        else if (this.state.paddles && this.state.paddles.length === 4) {
            let idx = -1;
            if (player === 'A') idx = 0;
            else if (player === 'B') idx = 1;
            else if (player === 'C') idx = 2;
            else if (player === 'D') idx = 3;
            
            console.log(`[BACKEND] Mode 4 joueurs - player=${player}, idx=${idx}, paddles count=${this.state.paddles.length}`);
            
            if (idx !== -1) {
                // Paddle A et C : verticaux (y bouge)
                if (player === 'A' || player === 'C') {
                    const oldY = this.state.paddles[idx].y;
                    if (direction === 'up') this.state.paddles[idx].y = Math.max(0, this.state.paddles[idx].y - speed);
                    else this.state.paddles[idx].y = Math.min(this.state.canvasHeight - this.state.paddles[idx].height, this.state.paddles[idx].y + speed);
                    console.log(`[BACKEND] Paddle ${player} (vertical) moved from y=${oldY} to y=${this.state.paddles[idx].y} (direction=${direction})`);
                }
                // Paddle B et D : horizontaux (x bouge)
                else if (player === 'B' || player === 'D') {
                    const minX = 0;
                    const maxX = this.state.canvasWidth - this.state.paddles[idx].width;
                    const oldX = this.state.paddles[idx].x;
                    if (direction === 'up') this.state.paddles[idx].x = Math.max(minX, this.state.paddles[idx].x - speed); // left
                    else this.state.paddles[idx].x = Math.min(maxX, this.state.paddles[idx].x + speed); // right
                    console.log(`[BACKEND] Paddle ${player} (horizontal) moved from x=${oldX} to x=${this.state.paddles[idx].x} (direction=${direction}, minX=${minX}, maxX=${maxX})`);
                }
            } else {
                console.log(`[BACKEND] ERREUR: Paddle ${player} non trouvé en mode 4 joueurs !`);
            }
        }
    }

    update() {
        // Déplacement de la balle
        this.state.ballX += this.state.ballSpeedX;
        this.state.ballY += this.state.ballSpeedY;

        // Mode 1v1v1v1 (carré, 4 paddles)
        if (this.state.paddles && this.state.paddles.length === 4) {
            const { canvasWidth, canvasHeight, ballRadius } = this.state;
            const paddles = this.state.paddles;

            // --- Collisions avec les paddles ---
            // Paddle A (gauche, vertical)
            if (
                this.state.ballX - ballRadius <= paddles[0].x + paddles[0].width &&
                this.state.ballX > paddles[0].x &&
                this.state.ballY >= paddles[0].y &&
                this.state.ballY <= paddles[0].y + paddles[0].height
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddles[0].x + paddles[0].width + ballRadius;
            }

            // Paddle B (bas, horizontal)
            if (
                this.state.ballY + ballRadius >= paddles[1].y &&
                this.state.ballY < paddles[1].y + paddles[1].height &&
                this.state.ballX >= paddles[1].x &&
                this.state.ballX <= paddles[1].x + paddles[1].width
            ) {
                this.state.ballSpeedY *= -1;
                this.state.ballY = paddles[1].y - ballRadius;
            }

            // Paddle C (droite, vertical)
            if (
                this.state.ballX + ballRadius >= paddles[2].x &&
                this.state.ballX < paddles[2].x + paddles[2].width &&
                this.state.ballY >= paddles[2].y &&
                this.state.ballY <= paddles[2].y + paddles[2].height
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddles[2].x - ballRadius;
            }

            // Paddle D (haut, horizontal)
            if (
                this.state.ballY - ballRadius <= paddles[3].y + paddles[3].height &&
                this.state.ballY > paddles[3].y &&
                this.state.ballX >= paddles[3].x &&
                this.state.ballX <= paddles[3].x + paddles[3].width
            ) {
                this.state.ballSpeedY *= -1;
                this.state.ballY = paddles[3].y + paddles[3].height + ballRadius;
                console.log(`[BACKEND] Collision avec paddle D ! ballY=${this.state.ballY}, paddleD.y=${paddles[3].y}, paddleD.height=${paddles[3].height}, paddleD.width=${paddles[3].width}`);
            }

            // --- Buts (attribution des points) ---
            // Si la balle sort par le côté A (gauche) - joueur A éliminé
            if (this.state.ballX < 0) {
                paddles[1].score++; // B gagne
                paddles[2].score++; // C gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort par le côté C (droite) - joueur C éliminé
            if (this.state.ballX > canvasWidth) {
                paddles[0].score++; // A gagne
                paddles[1].score++; // B gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort par le bas - joueur B éliminé
            if (this.state.ballY > canvasHeight) {
                paddles[0].score++; // A gagne
                paddles[2].score++; // C gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort par le haut - joueur D éliminé
            if (this.state.ballY < 0) {
                paddles[0].score++; // A gagne
                paddles[1].score++; // B gagne
                paddles[2].score++; // C gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }

            // Fin de partie si un joueur atteint le score cible
            for (const p of paddles) {
                if (p.score >= this.state.win) {
                    this.stop();
                }
            }
            return;
        }

        // Mode 1v1 (2 paddles)
        if (this.state.paddles && this.state.paddles.length === 2) {
            const { canvasWidth, canvasHeight, paddleHeight, paddleWidth, paddleMargin, ballRadius } = this.state;
            const paddles = this.state.paddles;
            // Collisions haut/bas
            if (this.state.ballY < ballRadius || this.state.ballY > canvasHeight - ballRadius) {
                this.state.ballSpeedY *= -1;
            }
            // Paddle gauche (paddles[0])
            if (
                this.state.ballX - ballRadius < paddles[0].x + paddles[0].width &&
                this.state.ballY > paddles[0].y &&
                this.state.ballY < paddles[0].y + paddles[0].height
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddles[0].x + paddles[0].width + ballRadius;
            }
            // Paddle droit (paddles[1])
            if (
                this.state.ballX + ballRadius > paddles[1].x &&
                this.state.ballY > paddles[1].y &&
                this.state.ballY < paddles[1].y + paddles[1].height
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddles[1].x - ballRadius;
            }
            // But à gauche
            if (this.state.ballX - this.state.ballRadius < 0) {
                paddles[1].score++;
                console.log(`[BACKEND] But ! Score mis à jour - Gauche: ${paddles[0].score}, Droite: ${paddles[1].score}`);
                this.resetBall();
            }
            // But à droite
            if (this.state.ballX + this.state.ballRadius > canvasWidth) {
                paddles[0].score++;
                console.log(`[BACKEND] But ! Score mis à jour - Gauche: ${paddles[0].score}, Droite: ${paddles[1].score}`);
                this.resetBall();
            }
            // Arrêt de la partie si un joueur atteint le score de victoire
            if (paddles[0].score >= this.state.win || paddles[1].score >= this.state.win) {
                this.stop();
            }
            return;
        }
    }

    resetBall() {
        this.state.ballX = this.state.canvasWidth / 2;
        this.state.ballY = this.state.canvasHeight / 2;
        this.state.ballSpeedX *= -1;
        this.state.ballSpeedY = 5 * (Math.random() > 0.5 ? 1 : -1);
    }
}

// Pour usage backend :
// - Instancier PongGame pour chaque partie/room
// - Appeler movePaddle('left'|'right', 'up'|'down') sur réception d'un message
// - Appeler start() pour lancer la partie
// - À chaque tick, envoyer this.state aux clients via WebSocket
