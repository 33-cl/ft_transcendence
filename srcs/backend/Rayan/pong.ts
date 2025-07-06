// Pong logic backend (TypeScript, sans DOM)
// Ce module gère l'état du jeu et les mises à jour, sans aucune dépendance au DOM ou au navigateur.

import { GameState, createInitialGameState } from './gameState.js';

export class PongGame {
    public state: GameState;
    private interval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.state = createInitialGameState();
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

    movePaddle(player: 'left' | 'right' | 'A' | 'B' | 'C', direction: 'up' | 'down') {
        const speed = this.state.paddleSpeed;
        // Mode 1v1 : paddles[0] = gauche, paddles[1] = droite
        if (this.state.paddles && this.state.paddles.length === 2) {
            if (player === 'left') {
                if (direction === 'up') this.state.paddles[0].y = Math.max(0, this.state.paddles[0].y - speed);
                else this.state.paddles[0].y = Math.min(this.state.canvasHeight - this.state.paddleHeight, this.state.paddles[0].y + speed);
            } else {
                if (direction === 'up') this.state.paddles[1].y = Math.max(0, this.state.paddles[1].y - speed);
                else this.state.paddles[1].y = Math.min(this.state.canvasHeight - this.state.paddleHeight, this.state.paddles[1].y + speed);
            }
        }
        // Mode 1v1v1 : paddles[0]=A, paddles[1]=B, paddles[2]=C
        else if (this.state.paddles && this.state.paddles.length === 3) {
            let idx = -1;
            if (player === 'A') idx = 0;
            else if (player === 'B') idx = 1;
            else if (player === 'C') idx = 2;
            if (idx !== -1) {
                // Paddle A et C : verticaux (y bouge)
                if (player === 'A' || player === 'C') {
                    if (direction === 'up') this.state.paddles[idx].y = Math.max(0, this.state.paddles[idx].y - speed);
                    else this.state.paddles[idx].y = Math.min(this.state.canvasHeight - this.state.paddleHeight, this.state.paddles[idx].y + speed);
                }
                // Paddle B : horizontal (x bouge, stocké dans y)
                else if (player === 'B') {
                    // Pour paddle B, y = position horizontale (x)
                    const minX = 0;
                    const maxX = this.state.canvasWidth - this.state.paddleHeight;
                    if (direction === 'up') this.state.paddles[idx].y = Math.max(minX, this.state.paddles[idx].y - speed);
                    else this.state.paddles[idx].y = Math.min(maxX, this.state.paddles[idx].y + speed);
                }
            }
        }
    }

    update() {
        // Déplacement de la balle
        this.state.ballX += this.state.ballSpeedX;
        this.state.ballY += this.state.ballSpeedY;

        // Mode 1v1v1 (hexagone, 3 paddles)
        if (this.state.paddles && this.state.paddles.length === 3) {
            // --- Définition des 3 côtés joueurs (A, B, C) ---
            // Pour simplifier, on place les paddles sur 3 côtés d'un hexagone irrégulier
            // Paddle A : côté gauche vertical
            // Paddle B : côté bas-gauche à bas-droit (oblique)
            // Paddle C : côté droit vertical
            // Les 3 autres côtés sont des murs (rebond)
            const { canvasWidth, canvasHeight, paddleHeight, paddleWidth, paddleMargin, ballRadius } = this.state;
            const paddles = this.state.paddles;
            // --- Paddle A (gauche) ---
            if (
                this.state.ballX - ballRadius < paddleMargin + paddleWidth &&
                this.state.ballY > paddles[0].y &&
                this.state.ballY < paddles[0].y + paddleHeight
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddleMargin + paddleWidth + ballRadius;
            }
            // --- Paddle C (droit) ---
            if (
                this.state.ballX + ballRadius > canvasWidth - paddleMargin - paddleWidth &&
                this.state.ballY > paddles[2].y &&
                this.state.ballY < paddles[2].y + paddleHeight
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = canvasWidth - paddleMargin - paddleWidth - ballRadius;
            }
            // --- Paddle B (bas, horizontal) ---
            // On place le paddle B en bas, horizontal (pour simplifier)
            const paddleB_Y = canvasHeight - paddleMargin - paddleWidth;
            if (
                this.state.ballY + ballRadius > paddleB_Y &&
                this.state.ballX > paddles[1].y && // paddles[1].y = x du paddle B (horizontal)
                this.state.ballX < paddles[1].y + paddleHeight
            ) {
                this.state.ballSpeedY *= -1;
                this.state.ballY = paddleB_Y - ballRadius;
            }
            // --- Collisions murs hexagone (haut, bas-gauche, bas-droit) ---
            // Mur haut
            if (this.state.ballY < ballRadius) {
                this.state.ballSpeedY *= -1;
                this.state.ballY = ballRadius;
            }
            // Mur bas-gauche (coin bas gauche)
            if (this.state.ballX < ballRadius && this.state.ballY > canvasHeight - ballRadius) {
                this.state.ballSpeedX *= -1;
                this.state.ballSpeedY *= -1;
            }
            // Mur bas-droit (coin bas droit)
            if (this.state.ballX > canvasWidth - ballRadius && this.state.ballY > canvasHeight - ballRadius) {
                this.state.ballSpeedX *= -1;
                this.state.ballSpeedY *= -1;
            }
            // --- Buts ---
            // Si la balle sort par le côté A (gauche)
            if (this.state.ballX < 0) {
                paddles[1].score++;
                paddles[2].score++;
                this.resetBall();
            }
            // Si la balle sort par le côté C (droit)
            if (this.state.ballX > canvasWidth) {
                paddles[0].score++;
                paddles[1].score++;
                this.resetBall();
            }
            // Si la balle sort par le bas (sous le paddle B)
            if (this.state.ballY > canvasHeight) {
                paddles[0].score++;
                paddles[2].score++;
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
                this.state.ballX - ballRadius < paddleMargin + paddleWidth &&
                this.state.ballY > paddles[0].y &&
                this.state.ballY < paddles[0].y + paddleHeight
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = paddleMargin + paddleWidth + ballRadius;
            }
            // Paddle droit (paddles[1])
            if (
                this.state.ballX + ballRadius > canvasWidth - paddleMargin - paddleWidth &&
                this.state.ballY > paddles[1].y &&
                this.state.ballY < paddles[1].y + paddleHeight
            ) {
                this.state.ballSpeedX *= -1;
                this.state.ballX = canvasWidth - paddleMargin - paddleWidth - ballRadius;
            }
            // But à gauche
            if (this.state.ballX < 0) {
                paddles[1].score++;
                this.resetBall();
            }
            // But à droite
            if (this.state.ballX > canvasWidth) {
                paddles[0].score++;
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
