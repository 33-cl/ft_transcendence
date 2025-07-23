export type PaddleSide = 'A' | 'B' | 'C';

export interface GameState{
    canvasHeight:   number;
    canvasWidth:    number;

    paddleHeight:   number;
    paddleWidth:    number;
    paddleMargin:   number;
    paddles: {
        x: number;
        y: number;
        width: number;
        height: number;
        side: PaddleSide;
        score: number;
    }[];
    paddleSpeed:    number;

    ballX:          number;
    ballY:          number;
    ballRadius:     number;
    ballSpeedX:     number;
    ballSpeedY:     number;

    win:            number;
    running:        boolean;
}

export function createInitialGameState(numPlayers: number = 2): GameState {
    const canvasHeight  = 650;
    const canvasWidth   = 850;
    const paddleHeight  = 110;
    const paddleWidth   = 10;
    const paddleMargin  = 10;
    const paddleY       = canvasHeight / 2 - paddleHeight / 2;

    const paddleSides: PaddleSide[] = ['A', 'B', 'C'];
    const paddles: { x: number; y: number; width: number; height: number; side: PaddleSide; score: number }[] = [];
    
    for (let i = 0; i < numPlayers; i++) {
        let side = paddleSides[i];
        let x = 0, y = paddleY, width = paddleWidth, height = paddleHeight;
        
        if (numPlayers === 2) {
            // Mode 1v1 : on veut A (gauche) et C (droite), pas B
            if (i === 1) side = 'C' as PaddleSide; // Deuxième paddle = C au lieu de B
            
            if (side === 'A') {
                x = paddleMargin;
            } else if (side === 'C') {
                x = canvasWidth - paddleMargin - paddleWidth;
            }
        } else if (numPlayers === 3) {
            // Mode 1v1v1 : paddle A à gauche, paddle C à droite, paddle B en bas (horizontal)
            if (side === 'A') {
                x = paddleMargin;
            } else if (side === 'B') {
                // Paddle B : horizontal en bas
                x = canvasWidth / 2 - paddleHeight / 2; // Centré horizontalement
                y = canvasHeight - paddleMargin - paddleWidth;
                width = paddleHeight; // Largeur du paddle horizontal
                height = paddleWidth; // Hauteur du paddle horizontal
            } else if (side === 'C') {
                x = canvasWidth - paddleMargin - paddleWidth;
            }
        }
        
        paddles.push({ x, y, width, height, side, score: 0 });
    }
    return {
        canvasHeight:   canvasHeight,
        canvasWidth:    canvasWidth,
        paddleHeight:   paddleHeight,
        paddleWidth:    paddleWidth,
        paddleMargin:   paddleMargin,
        paddles:        paddles,
        paddleSpeed:    1,
        ballX:          canvasWidth / 2,
        ballY:          canvasHeight / 2,
        ballRadius:     20,
        ballSpeedX:     6,
        ballSpeedY:     6,
        win:            3,
        running:        false,
    };
}
