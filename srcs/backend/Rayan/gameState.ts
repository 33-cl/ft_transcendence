export type PaddleSide = 'A' | 'B' | 'C' | 'D';

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

    const paddleSides: PaddleSide[] = ['A', 'B', 'C', 'D'];
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
        } else if (numPlayers === 4) {
            // Mode 1v1v1v1 : disposition carrée avec 4 paddles
            if (side === 'A') {
                // Paddle A : gauche (vertical)
                x = paddleMargin;
                y = canvasHeight / 2 - paddleHeight / 2;
                width = paddleWidth;
                height = paddleHeight;
            } else if (side === 'B') {
                // Paddle B : bas (horizontal)
                x = canvasWidth / 2 - paddleHeight / 2;
                y = canvasHeight - paddleMargin - paddleWidth;
                width = paddleHeight; // 110 pixels de largeur
                height = paddleWidth; // 10 pixels de hauteur
            } else if (side === 'C') {
                // Paddle C : droite (vertical)
                x = canvasWidth - paddleMargin - paddleWidth;
                y = canvasHeight / 2 - paddleHeight / 2;
                width = paddleWidth;
                height = paddleHeight;
            } else if (side === 'D') {
                // Paddle D : haut (horizontal) - même taille que B
                x = canvasWidth / 2 - paddleHeight / 2;
                y = paddleMargin;
                width = paddleHeight; // 110 pixels de largeur (même que B)
                height = paddleWidth; // 10 pixels de hauteur (même que B)
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
        paddleSpeed:    7,
        ballX:          canvasWidth / 2,
        ballY:          canvasHeight / 2,
        ballRadius:     20,
        ballSpeedX:     5,
        ballSpeedY:     5,
        win:            4,
        running:        false,
    };
}
