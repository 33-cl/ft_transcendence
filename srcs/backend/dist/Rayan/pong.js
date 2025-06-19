// Pong logic backend (TypeScript, sans DOM)
// Ce module gère l'état du jeu et les mises à jour, sans aucune dépendance au DOM ou au navigateur.
import { createInitialGameState } from './gameState.js';
export class PongGame {
    constructor() {
        this.interval = null;
        this.state = createInitialGameState();
    }
    start() {
        if (this.interval)
            return;
        this.state.running = true;
        this.interval = setInterval(() => this.update(), 1000 / 60); // 60 FPS
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
        this.state.running = false;
    }
    movePaddle(player, direction) {
        const speed = this.state.paddleSpeed;
        if (player === 'left') {
            if (direction === 'up')
                this.state.leftPaddleY = Math.max(0, this.state.leftPaddleY - speed);
            else
                this.state.leftPaddleY = Math.min(this.state.canvasHeight - this.state.paddleHeight, this.state.leftPaddleY + speed);
        }
        else {
            if (direction === 'up')
                this.state.rightPaddleY = Math.max(0, this.state.rightPaddleY - speed);
            else
                this.state.rightPaddleY = Math.min(this.state.canvasHeight - this.state.paddleHeight, this.state.rightPaddleY + speed);
        }
    }
    update() {
        // Déplacement de la balle
        this.state.ballX += this.state.ballSpeedX;
        this.state.ballY += this.state.ballSpeedY;
        // Collisions haut/bas
        if (this.state.ballY < this.state.ballRadius || this.state.ballY > this.state.canvasHeight - this.state.ballRadius) {
            this.state.ballSpeedY *= -1;
        }
        // Collisions avec les paddles
        // Paddle gauche
        if (this.state.ballX - this.state.ballRadius < this.state.paddleMargin + this.state.paddleWidth &&
            this.state.ballY > this.state.leftPaddleY &&
            this.state.ballY < this.state.leftPaddleY + this.state.paddleHeight) {
            this.state.ballSpeedX *= -1;
            this.state.ballX = this.state.paddleMargin + this.state.paddleWidth + this.state.ballRadius;
        }
        // Paddle droit
        if (this.state.ballX + this.state.ballRadius > this.state.canvasWidth - this.state.paddleMargin - this.state.paddleWidth &&
            this.state.ballY > this.state.rightPaddleY &&
            this.state.ballY < this.state.rightPaddleY + this.state.paddleHeight) {
            this.state.ballSpeedX *= -1;
            this.state.ballX = this.state.canvasWidth - this.state.paddleMargin - this.state.paddleWidth - this.state.ballRadius;
        }
        // But à gauche
        if (this.state.ballX < 0) {
            this.state.rightScore++;
            this.resetBall();
        }
        // But à droite
        if (this.state.ballX > this.state.canvasWidth) {
            this.state.leftScore++;
            this.resetBall();
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
