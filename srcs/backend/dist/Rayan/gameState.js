export function createInitialGameState(numPlayers = 2) {
    const canvasHeight = 650;
    const canvasWidth = 850;
    const paddleHeight = 110;
    const paddleWidth = 10;
    const paddleMargin = 10;
    const paddleY = canvasHeight / 2 - paddleHeight / 2;
    const paddleSides = ['A', 'B', 'C'];
    const paddles = [];
    for (let i = 0; i < numPlayers; i++) {
        let side = paddleSides[i];
        let x = 0, y = paddleY, width = paddleWidth, height = paddleHeight;
        if (numPlayers === 2) {
            // Mode 1v1 : on veut A (gauche) et C (droite), pas B
            if (i === 1)
                side = 'C'; // Deuxième paddle = C au lieu de B
            if (side === 'A') {
                x = paddleMargin;
            }
            else if (side === 'C') {
                x = canvasWidth - paddleMargin - paddleWidth;
            }
        }
        else if (numPlayers === 3) {
            // Mode 1v1v1 : paddle A à gauche, paddle C à droite, paddle B en bas (horizontal)
            if (side === 'A') {
                x = paddleMargin;
            }
            else if (side === 'B') {
                // Paddle B : horizontal en bas
                x = canvasWidth / 2 - paddleHeight / 2; // Centré horizontalement
                y = canvasHeight - paddleMargin - paddleWidth;
                width = paddleHeight; // Largeur du paddle horizontal
                height = paddleWidth; // Hauteur du paddle horizontal
            }
            else if (side === 'C') {
                x = canvasWidth - paddleMargin - paddleWidth;
            }
        }
        paddles.push({ x, y, width, height, side, score: 0 });
    }
    return {
        canvasHeight: canvasHeight,
        canvasWidth: canvasWidth,
        paddleHeight: paddleHeight,
        paddleWidth: paddleWidth,
        paddleMargin: paddleMargin,
        paddles: paddles,
        paddleSpeed: 7,
        ballX: canvasWidth / 2,
        ballY: canvasHeight / 2,
        ballRadius: 20,
        ballSpeedX: 5,
        ballSpeedY: 5,
        win: 4,
        running: false,
        ballCountdown: 3, // Délai de 3 secondes avant que la balle commence
    };
}
