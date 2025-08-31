// ball.ts - Logique de gestion de la balle (reset, accélération, collisions)

import { GameState, createInitialGameState } from './gameState.js';

export interface BallState {
    accelerationCount: number;
    pointScored: boolean;
    lastContact: number;
}

export function resetBall(state: GameState, ballState: BallState, isFirstLaunch: boolean): void {
    state.ballX = state.canvasWidth / 2;
    state.ballY = state.canvasHeight / 2;
    
    // Remettre le compteur d'accélération à zéro
    ballState.accelerationCount = 0;
    
    // Remettre le flag de point marqué à false pour le prochain point
    ballState.pointScored = false;
    
    // Remettre le dernier contact à -1 pour un nouveau point propre
    ballState.lastContact = -1;
    
    // Utiliser directement les valeurs initiales du gameState pour la cohérence
    const initialState = createInitialGameState(state.paddles?.length || 2);
    const baseSpeedX = Math.abs(initialState.ballSpeedX); // 3 depuis gameState.ts
    const baseSpeedY = Math.abs(initialState.ballSpeedY); // 3 depuis gameState.ts
    
    // Direction aléatoire pour X et Y (trajectoire diagonale équilibrée)
    state.ballSpeedX = baseSpeedX * (Math.random() > 0.5 ? 1 : -1);
    state.ballSpeedY = baseSpeedY * (Math.random() > 0.5 ? 1 : -1);
    
    // Log pour confirmer le reset de vitesse
    const resetSpeed = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
    console.log(`🔄 REMISE EN JEU - Vitesse reset à: ${resetSpeed.toFixed(2)} (baseX: ${baseSpeedX}, baseY: ${baseSpeedY}) - Compteur accélération: ${ballState.accelerationCount}`);
    
    // For subsequent resets, ensure countdown is disabled
    if (!isFirstLaunch) {
        state.ballCountdown = 0;
    }
}

export function accelerateBall(state: GameState, ballState: BallState): void {
    const accelerationFactor = 1.15; // Augmentation de 15% de la vitesse (plus visible)
    const maxSpeed = 10; // Vitesse maximale réduite pour garder le jeu jouable
    
    // Calculer la vitesse actuelle AVANT accélération
    const currentSpeedBefore = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
    
    // Appliquer l'accélération seulement si on n'a pas atteint la vitesse maximale
    if (currentSpeedBefore < maxSpeed) {
        // Sauvegarder les vitesses avant modification
        const oldSpeedX = state.ballSpeedX;
        const oldSpeedY = state.ballSpeedY;
        
        // Appliquer l'accélération
        state.ballSpeedX *= accelerationFactor;
        state.ballSpeedY *= accelerationFactor;
        
        // Incrémenter le compteur d'accélération
        ballState.accelerationCount++;
        
        // Calculer la vitesse APRÈS accélération
        const currentSpeedAfter = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
        
        // Log détaillé pour vérifier l'accélération
        console.log(`🚀 ACCÉLÉRATION PADDLE #${ballState.accelerationCount}:`, {
            vitesse_avant: currentSpeedBefore.toFixed(2),
            vitesse_après: currentSpeedAfter.toFixed(2),
            gain: `+${((currentSpeedAfter - currentSpeedBefore) / currentSpeedBefore * 100).toFixed(1)}%`,
            ballSpeedX_avant: oldSpeedX.toFixed(2),
            ballSpeedX_après: state.ballSpeedX.toFixed(2),
            ballSpeedY_avant: oldSpeedY.toFixed(2),
            ballSpeedY_après: state.ballSpeedY.toFixed(2),
            facteur: accelerationFactor,
            vitesse_max: maxSpeed,
            total_accelerations: ballState.accelerationCount
        });
    } else {
        // Log quand la vitesse maximale est atteinte
        console.log(`⚠️ VITESSE MAXIMALE ATTEINTE:`, {
            vitesse_actuelle: currentSpeedBefore.toFixed(2),
            vitesse_max: maxSpeed,
            message: "Pas d'accélération supplémentaire",
            total_accelerations: ballState.accelerationCount
        });
    }
}

export function checkBallCollisions4Players(state: GameState, ballState: BallState): void {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 4) return;

    // Fonction helper pour détecter collision cercle-rectangle précise
    const checkCircleRectangleCollision = (paddle: any, paddleIndex: number) => {
        const ballCenterX = state.ballX;
        const ballCenterY = state.ballY;

        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        // Trouver le point le plus proche du paddle par rapport au centre de la balle
        const closestX = Math.max(paddleLeft, Math.min(ballCenterX, paddleRight));
        const closestY = Math.max(paddleTop, Math.min(ballCenterY, paddleBottom));
        
        // Calculer la distance entre le centre de la balle et le point le plus proche
        const distanceX = ballCenterX - closestX;
        const distanceY = ballCenterY - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;
        
        // Collision si la distance est inférieure ou égale au rayon de la balle
        if (distanceSquared > ballRadius * ballRadius) {
            return false; // Pas de collision
        }
        
        // Déterminer quelle face du paddle est touchée en fonction de la position relative
        const isInsideHorizontally = ballCenterX >= paddleLeft && ballCenterX <= paddleRight;
        const isInsideVertically = ballCenterY >= paddleTop && ballCenterY <= paddleBottom;
        
        // Collision avec les faces verticales (gauche/droite) du paddle
        if (isInsideVertically && !isInsideHorizontally) {
            if (paddleIndex === 0 && state.ballSpeedX < 0) { // Paddle A (gauche), balle vers gauche
                state.ballSpeedX = -state.ballSpeedX; // Inverser composante horizontale
                state.ballX = paddleRight + ballRadius; // Repositionner à droite du paddle
                accelerateBall(state, ballState); // Accélération après contact
                ballState.lastContact = 0;
                return true;
            } else if (paddleIndex === 2 && state.ballSpeedX > 0) { // Paddle C (droite), balle vers droite
                state.ballSpeedX = -state.ballSpeedX; // Inverser composante horizontale
                state.ballX = paddleLeft - ballRadius; // Repositionner à gauche du paddle
                accelerateBall(state, ballState); // Accélération après contact
                ballState.lastContact = 2;
                return true;
            }
        }
        
        // Collision avec les faces horizontales (haut/bas) du paddle
        if (isInsideHorizontally && !isInsideVertically) {
            if (paddleIndex === 1 && state.ballSpeedY > 0) { // Paddle B (bas), balle vers bas
                state.ballSpeedY = -state.ballSpeedY; // Inverser composante verticale
                state.ballY = paddleTop - ballRadius; // Repositionner au-dessus du paddle
                accelerateBall(state, ballState); // Accélération après contact
                ballState.lastContact = 1;
                return true;
            } else if (paddleIndex === 3 && state.ballSpeedY < 0) { // Paddle D (haut), balle vers haut
                state.ballSpeedY = -state.ballSpeedY; // Inverser composante verticale
                state.ballY = paddleBottom + ballRadius; // Repositionner en-dessous du paddle
                accelerateBall(state, ballState); // Accélération après contact
                ballState.lastContact = 3;
                return true;
            }
        }
        
        // Collision aux coins du paddle - déterminer la face dominante
        if (!isInsideHorizontally && !isInsideVertically) {
            // Calculer quelle direction dominerait pour le rebond
            const horizontalDistance = Math.min(Math.abs(ballCenterX - paddleLeft), Math.abs(ballCenterX - paddleRight));
            const verticalDistance = Math.min(Math.abs(ballCenterY - paddleTop), Math.abs(ballCenterY - paddleBottom));
            
            // Rebond selon la direction avec la plus petite distance (face la plus proche)
            if (horizontalDistance < verticalDistance) {
                // Collision principalement sur une face verticale
                if (paddleIndex === 0 && state.ballSpeedX < 0) {
                    state.ballSpeedX = -state.ballSpeedX;
                    state.ballX = paddleRight + ballRadius;
                    accelerateBall(state, ballState); // Accélération après contact
                    ballState.lastContact = 0;
                    return true;
                } else if (paddleIndex === 2 && state.ballSpeedX > 0) {
                    state.ballSpeedX = -state.ballSpeedX;
                    state.ballX = paddleLeft - ballRadius;
                    accelerateBall(state, ballState); // Accélération après contact
                    ballState.lastContact = 2;
                    return true;
                }
            } else {
                // Collision principalement sur une face horizontale
                if (paddleIndex === 1 && state.ballSpeedY > 0) {
                    state.ballSpeedY = -state.ballSpeedY;
                    state.ballY = paddleTop - ballRadius;
                    accelerateBall(state, ballState); // Accélération après contact
                    ballState.lastContact = 1;
                    return true;
                } else if (paddleIndex === 3 && state.ballSpeedY < 0) {
                    state.ballSpeedY = -state.ballSpeedY;
                    state.ballY = paddleBottom + ballRadius;
                    accelerateBall(state, ballState); // Accélération après contact
                    ballState.lastContact = 3;
                    return true;
                }
            }
        }
        
        return false;
    };
    
    // Vérifier les collisions pour chaque paddle dans l'ordre
    for (let i = 0; i < paddles.length; i++) {
        if (checkCircleRectangleCollision(paddles[i], i)) {
            break; // Arrêter après la première collision détectée
        }
    }
}

export function checkBallCollisions2Players(state: GameState, ballState: BallState): void {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    const paddles = state.paddles;
    
    if (!paddles || paddles.length !== 2) return;
    
    // Collisions haut/bas avec les bords du terrain
    if (state.ballY - ballRadius <= 0) {
        state.ballSpeedY = -state.ballSpeedY;
        state.ballY = ballRadius;
    }
    if (state.ballY + ballRadius >= canvasHeight) {
        state.ballSpeedY = -state.ballSpeedY;
        state.ballY = canvasHeight - ballRadius;
    }
    
    // Fonction helper pour collision cercle-rectangle précise (mode 1v1)
    const checkCircleRectangleCollision1v1 = (paddle: any, isLeftPaddle: boolean) => {
        const ballCenterX = state.ballX;
        const ballCenterY = state.ballY;
        
        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        // Trouver le point le plus proche du paddle par rapport au centre de la balle
        const closestX = Math.max(paddleLeft, Math.min(ballCenterX, paddleRight));
        const closestY = Math.max(paddleTop, Math.min(ballCenterY, paddleBottom));
        
        // Calculer la distance entre le centre de la balle et le point le plus proche
        const distanceX = ballCenterX - closestX;
        const distanceY = ballCenterY - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;
        
        // Collision si la distance est inférieure ou égale au rayon de la balle
        if (distanceSquared > ballRadius * ballRadius) {
            return false; // Pas de collision
        }
        
        // Vérifier la direction de la balle pour éviter les rebonds multiples
        if (isLeftPaddle && state.ballSpeedX > 0) return false; // Balle s'éloigne du paddle gauche
        if (!isLeftPaddle && state.ballSpeedX < 0) return false; // Balle s'éloigne du paddle droit
        
        // Pour les paddles verticaux en mode 1v1, rebond toujours sur l'axe horizontal
        if (isLeftPaddle) { // Paddle gauche
            state.ballSpeedX = -state.ballSpeedX; // Inverser composante horizontale
            state.ballX = paddleRight + ballRadius; // Repositionner à droite du paddle
            accelerateBall(state, ballState); // Accélération après contact avec paddle
        } else { // Paddle droit
            state.ballSpeedX = -state.ballSpeedX; // Inverser composante horizontale
            state.ballX = paddleLeft - ballRadius; // Repositionner à gauche du paddle
            accelerateBall(state, ballState); // Accélération après contact avec paddle
        }
        
        return true;
    };
    
    // Vérifier collision avec paddle gauche (index 0)
    checkCircleRectangleCollision1v1(paddles[0], true);
    
    // Vérifier collision avec paddle droit (index 1)
    checkCircleRectangleCollision1v1(paddles[1], false);
}

export function shouldResetBall(state: GameState): boolean {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    
    // Reset seulement quand la balle sort COMPLÈTEMENT (pour l'effet visuel)
    return (state.ballX + ballRadius < 0 || 
            state.ballX - ballRadius > canvasWidth ||
            state.ballY + ballRadius < 0 || 
            state.ballY - ballRadius > canvasHeight);
}
