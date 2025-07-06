export function createInitialGameState(numPlayers = 2) {
    const canvasHeight = 650;
    const canvasWidth = 850;
    const paddleHeight = 110;
    const paddleY = canvasHeight / 2 - paddleHeight / 2;
    const paddleSides = ['A', 'B', 'C'];
    const paddles = paddleSides.slice(0, numPlayers).map(side => ({
        y: paddleY,
        side,
        score: 0
    }));
    return {
        canvasHeight: canvasHeight,
        canvasWidth: canvasWidth,
        paddleHeight: paddleHeight,
        paddleWidth: 10,
        paddleMargin: 10,
        paddles: paddles,
        paddleSpeed: 7,
        ballX: canvasWidth / 2,
        ballY: canvasHeight / 2,
        ballRadius: 20,
        ballSpeedX: 5,
        ballSpeedY: 5,
        win: 3,
        running: false,
    };
}
