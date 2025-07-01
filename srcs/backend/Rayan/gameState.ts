export interface GameState{
    canvasHeight:   number;
    canvasWidth:    number;

    paddleHeight:   number;
    paddleWidth:    number;
    paddleMargin:   number;
    leftPaddleY:    number;
    rightPaddleY:   number;
    paddleSpeed:    number;

    ballX:          number;
    ballY:          number;
    ballRadius:     number;
    ballSpeedX:     number;
    ballSpeedY:     number;

    leftScore:      number;
    rightScore:     number;
    win:            number;
    running:        boolean;
}

export function createInitialGameState(): GameState {
    const canvasHeight  = 650;
    const canvasWidth   = 850;
    const paddleHeight  = 110;

    return {
        canvasHeight:   canvasHeight,
        canvasWidth:    canvasWidth,
        paddleHeight:   paddleHeight,
        paddleWidth:    10,
        paddleMargin:   10,
        leftPaddleY:    canvasHeight / 2 - paddleHeight / 2,
        rightPaddleY:   canvasHeight / 2 - paddleHeight / 2,
        paddleSpeed:    7,
        ballX:          canvasWidth / 2,
        ballY:          canvasHeight / 2,
        ballRadius:     20,
        ballSpeedX:     5,
        ballSpeedY:     5,
        leftScore:      0,
        rightScore:     0,
        win:            3,
        running:        false,
    };
}
