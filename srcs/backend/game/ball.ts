// Ball logic (reset, acceleration, collisions)

import { GameState } from './gameState.js';

// Calculates bounce angle based on impact zone on paddle
export function calculateBounceAngleFromZone(ballY: number, paddleTop: number, paddleHeight: number): number 
{
    const zoneCount = 16;
    const minAngle = -40;
    const maxAngle = 40;
    const angles = Array.from({length: zoneCount}, (_, i) =>
        minAngle + ((maxAngle - minAngle) * i) / (zoneCount - 1)
    );
    
    const impactRatio = (ballY - paddleTop) / paddleHeight;
    const zoneIndex = Math.max(0, Math.min(angles.length - 1, Math.floor(impactRatio * angles.length)));
    const angleInRadians = angles[zoneIndex] * Math.PI / 180; 
    
    return angleInRadians;
}

export interface BallState 
{
    accelerationCount: number;
    pointScored: boolean;
    lastContact: number;
}

// Resets ball to center with initial speed and direction
export function resetBall(state: GameState, ballState: BallState, isFirstLaunch: boolean): void {
    state.ballX = state.canvasWidth / 2;
    state.ballY = state.canvasHeight / 2;
    
    ballState.accelerationCount = 0;

    ballState.pointScored = false;
    
    ballState.lastContact = -1;
    
    const baseSpeed = 6.5;
    
    const numPlayers = state.paddles?.length || 2;
    
    if (numPlayers === 4) 
    {
        const randomAngle = Math.random() * 2 * Math.PI;
        state.ballSpeedX = baseSpeed * Math.cos(randomAngle);
        state.ballSpeedY = baseSpeed * Math.sin(randomAngle);
    } 
    else 
    {
        const angle = Math.random() * Math.PI / 2 - Math.PI / 4;
        const direction = Math.random() < 0.5 ? 1 : -1;
        state.ballSpeedX = Math.cos(angle) * baseSpeed * direction;
        state.ballSpeedY = Math.sin(angle) * baseSpeed;
    }
    
    if (!isFirstLaunch)
        state.ballCountdown = 0;
} 

// Accelerate ball by 15% per hit; capped to keep gameplay stable
export function accelerateBall(state: GameState, ballState: BallState): void {
    const accelerationFactor = 1.15;
    const maxSpeed = 25;
    
    const currentSpeedBefore = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
    
    if (currentSpeedBefore < maxSpeed) 
    {
        state.ballSpeedX *= accelerationFactor;
        state.ballSpeedY *= accelerationFactor;
        
        ballState.accelerationCount++;
    }
}

// 4-player collision: precise circle-rectangle checks.
// Uses lastContact to prevent multiple bounces on the same paddle.
// Paddles indices: 0=A(left), 1=B(down), 2=C(right), 3=D(up)
export function checkBallCollisions4Players(state: GameState, ballState: BallState): void {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4) 
        return;

    const checkCircleRectangleCollision = (paddle: any, paddleIndex: number) =>
    {
        const ballCenterX = state.ballX;
        const ballCenterY = state.ballY;

        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        const closestX = Math.max(paddleLeft, Math.min(ballCenterX, paddleRight));
        const closestY = Math.max(paddleTop, Math.min(ballCenterY, paddleBottom));
        
        const deltaX = ballCenterX - closestX;
        const deltaY = ballCenterY - closestY;
        const distanceSq = deltaX * deltaX + deltaY * deltaY;
        
        if (distanceSq > ballRadius * ballRadius)
            return false;
        
        if (ballState.lastContact === paddleIndex) 
            return false;
        
        const isInsideHorizontally = ballCenterX >= paddleLeft && ballCenterX <= paddleRight;
        const isInsideVertically = ballCenterY >= paddleTop && ballCenterY <= paddleBottom;
        
        const currentSpeed = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
        
        if (isInsideVertically && !isInsideHorizontally) 
        {
            if (paddleIndex === 0) 
            {
                const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);

                state.ballSpeedX = Math.abs(currentSpeed * Math.cos(bounceAngle));
                state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                state.ballX = paddleRight + ballRadius;
                accelerateBall(state, ballState);
                ballState.lastContact = 0;
    
                return true;
            } 
            else if (paddleIndex === 2) 
            {
                const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);

                state.ballSpeedX = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                state.ballX = paddleLeft - ballRadius;
                accelerateBall(state, ballState);
                ballState.lastContact = 2;

                return true;
            }
        }
        
        if (isInsideHorizontally && !isInsideVertically) 
        {
            if (paddleIndex === 1) 
            {
                const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);

                state.ballSpeedX = currentSpeed * Math.sin(bounceAngle);
                state.ballSpeedY = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                state.ballY = paddleTop - ballRadius;
                accelerateBall(state, ballState);
                ballState.lastContact = 1;

                return true;
            } 
            else if (paddleIndex === 3) 
            {
                const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);

                state.ballSpeedX = currentSpeed * Math.sin(bounceAngle);
                state.ballSpeedY = Math.abs(currentSpeed * Math.cos(bounceAngle));
                state.ballY = paddleBottom + ballRadius;
                accelerateBall(state, ballState);
                ballState.lastContact = 3;

                return true;
            }
        }
        if (!isInsideHorizontally && !isInsideVertically)
        {
            const deltaXEdge = Math.min(Math.abs(ballCenterX - paddleLeft), Math.abs(ballCenterX - paddleRight));
            const deltaYEdge = Math.min(Math.abs(ballCenterY - paddleTop), Math.abs(ballCenterY - paddleBottom));
            
            if (deltaXEdge < deltaYEdge) 
            {
                if (paddleIndex === 0) 
                {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);

                    state.ballSpeedX = Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                    state.ballX = paddleRight + ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 0;

                    return true;
                } 
                else if (paddleIndex === 2) 
                {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);

                    state.ballSpeedX = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                    state.ballX = paddleLeft - ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 2;

                    return true;
                }
            } 
            else 
            {
                if (paddleIndex === 1) 
                {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);

                    state.ballSpeedX = currentSpeed * Math.sin(bounceAngle);
                    state.ballSpeedY = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballY = paddleTop - ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 1;

                    return true;
                }
                else if (paddleIndex === 3) 
                {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);

                    state.ballSpeedX = currentSpeed * Math.sin(bounceAngle);
                    state.ballSpeedY = Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballY = paddleBottom + ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 3;

                    return true;
                }
            }
        }
        
        return false;
    };
    
    for (let i = 0; i < paddles.length; i++) 
    {
        if (checkCircleRectangleCollision(paddles[i], i)) 
            break;
    }
}

// 1v1 collision: precise circle-rectangle checks.
// Avoid bounce if ball is moving away from paddle.
export function checkBallCollisions2Players(state: GameState, ballState: BallState): void 
{
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2) 
        return;
    
    if (state.ballY - ballRadius <= 0) 
    {
        state.ballSpeedY = -state.ballSpeedY;
        state.ballY = ballRadius;
    }
    if (state.ballY + ballRadius >= canvasHeight) 
    {
        state.ballSpeedY = -state.ballSpeedY;
        state.ballY = canvasHeight - ballRadius;
    }
    
    const checkCircleCollision1v1 = (paddle: any, isLeftPaddle: boolean) => 
    {
        const ballCenterX = state.ballX;
        const ballCenterY = state.ballY;
        
        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        const closestX = Math.max(paddleLeft, Math.min(ballCenterX, paddleRight));
        const closestY = Math.max(paddleTop, Math.min(ballCenterY, paddleBottom));
        
        const deltaX = ballCenterX - closestX;
        const deltaY = ballCenterY - closestY;
        const distanceSq = deltaX * deltaX + deltaY * deltaY;
        
        if (distanceSq > ballRadius * ballRadius) 
            return false;
        
        if (isLeftPaddle && state.ballSpeedX > 0) 
            return false;
        if (!isLeftPaddle && state.ballSpeedX < 0) 
            return false;

        const currentSpeed = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
        
        const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
        
        const direction = isLeftPaddle ? 1 : -1;
        
        state.ballSpeedX = currentSpeed * Math.cos(bounceAngle) * direction;
        state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
        
        if (isLeftPaddle) 
            state.ballX = paddleRight + ballRadius;
        else 
            state.ballX = paddleLeft - ballRadius;
        
        accelerateBall(state, ballState);
        
        return true;
    };
    
    checkCircleCollision1v1(paddles[0], true);
    checkCircleCollision1v1(paddles[1], false);
}

// Reset when ball is fully outside play area (visual effect)
export function shouldResetBall(state: GameState): boolean 
{
    const { canvasWidth, canvasHeight, ballRadius } = state;
    
    return (state.ballX + ballRadius < 0 || 
            state.ballX - ballRadius > canvasWidth ||
            state.ballY + ballRadius < 0 || 
            state.ballY - ballRadius > canvasHeight);
}
