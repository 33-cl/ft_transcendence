"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialGameState = createInitialGameState;
function createInitialGameState() {
    const canvasHeight = 600;
    const canvasWidth = 800;
    const paddleHeight = 110;
    return {
        canvasHeight: canvasHeight,
        canvasWidth: canvasWidth,
        paddleHeight: paddleHeight,
        paddleWidth: 10,
        paddleMargin: 10,
        leftPaddleY: canvasHeight / 2 - paddleHeight / 2,
        rightPaddleY: canvasHeight / 2 - paddleHeight / 2,
        paddleSpeed: 15,
        ballX: canvasWidth / 2,
        ballY: canvasHeight / 2,
        ballRadius: 20,
        ballSpeedX: 5,
        ballSpeedY: 5,
        leftScore: 0,
        rightScore: 0,
        win: 3,
        running: false,
    };
}
