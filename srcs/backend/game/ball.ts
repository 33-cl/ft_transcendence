// ball.ts - Logique de gestion de la balle (reset, accélération, collisions)

import { GameState } from './gameState.js';

/**
 * Calcule l'angle de rebond en fonction de la zone d'impact sur le paddle (mode 1v1)
 * Le paddle est divisé en 8 zones égales avec des angles prédéfinis
 * @param ballY Position Y de la balle au moment du contact
 * @param paddleTop Position Y du haut du paddle
 * @param paddleHeight Hauteur totale du paddle
 * @returns Angle de rebond en radians
 */
export function calculateBounceAngleFromZone(ballY: number, paddleTop: number, paddleHeight: number): number {
    // Angles prédéfinis pour chaque zone (en degrés)
    // Zones 3 et 4 = 0° pour un centre élargi
    const zoneCount = 16;
    const minAngle = -40;
    const maxAngle = 40;
    const angles = Array.from({length: zoneCount}, (_, i) =>
        minAngle + ((maxAngle - minAngle) * i) / (zoneCount - 1)
    );
    
    // Calculer la position relative de l'impact sur le paddle [0, 1]
    const impactRatio = (ballY - paddleTop) / paddleHeight;
    
    // Déterminer la zone, avec protection contre les débordements
    const zoneIndex = Math.max(0, Math.min(angles.length - 1, Math.floor(impactRatio * angles.length)));
    
    // Convertir l'angle en radians
    const angleInRadians = angles[zoneIndex] * Math.PI / 180;
    
    return angleInRadians;
}

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
    
    // Vitesse de base pour les resets (la vitesse initiale dans createInitialGameState est 0 pour le countdown)
    const baseSpeed = 6.5;
    
    const numPlayers = state.paddles?.length || 2;
    
    if (numPlayers === 4) {
        // Mode 4 joueurs : angle complètement aléatoire (0 à 360°)
        const randomAngle = Math.random() * 2 * Math.PI;
        state.ballSpeedX = baseSpeed * Math.cos(randomAngle);
        state.ballSpeedY = baseSpeed * Math.sin(randomAngle);
    } else {
        // Mode 2 joueurs : direction aléatoire pour X et Y (trajectoire diagonale équilibrée)
        const angle = Math.random() * Math.PI / 2 - Math.PI / 4; // -45° à +45°
        const direction = Math.random() < 0.5 ? 1 : -1;
        state.ballSpeedX = Math.cos(angle) * baseSpeed * direction;
        state.ballSpeedY = Math.sin(angle) * baseSpeed;
    }
    
    // For subsequent resets, ensure countdown is disabled
    if (!isFirstLaunch) {
        state.ballCountdown = 0;
    }
}

export function accelerateBall(state: GameState, ballState: BallState): void {
    const accelerationFactor = 1.15; // Augmentation de 15% de la vitesse (plus visible)
    const maxSpeed = 25; // Vitesse maximale réduite pour garder le jeu jouable
    
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
        const deltaX = ballCenterX - closestX;
        const deltaY = ballCenterY - closestY;
        const distanceSq = deltaX * deltaX + deltaY * deltaY;
        
        // Collision si la distance est inférieure ou égale au rayon de la balle
        if (distanceSq > ballRadius * ballRadius) {
            return false; // Pas de collision
        }
        
        // Anti-tunneling: Éviter les rebonds multiples sur le même paddle
        if (ballState.lastContact === paddleIndex) {
            return false;
        }
        
        // Déterminer quelle face du paddle est touchée en fonction de la position relative
        const isInsideHorizontally = ballCenterX >= paddleLeft && ballCenterX <= paddleRight;
        const isInsideVertically = ballCenterY >= paddleTop && ballCenterY <= paddleBottom;
        
        // Calculer la vitesse actuelle pour conservation d'énergie
        const currentSpeed = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
        
        // Collision avec les faces verticales (gauche/droite) du paddle - Paddles A (0) et C (2)
        if (isInsideVertically && !isInsideHorizontally) {
            if (paddleIndex === 0) { // Paddle A (gauche)
                // Rebond angulaire basé sur la zone d'impact verticale
                const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
                state.ballSpeedX = Math.abs(currentSpeed * Math.cos(bounceAngle)); // Force direction positive (vers droite)
                state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                state.ballX = paddleRight + ballRadius; // Repositionner à droite du paddle
                accelerateBall(state, ballState);
                ballState.lastContact = 0;
                return true;
            } else if (paddleIndex === 2) { // Paddle C (droite)
                // Rebond angulaire basé sur la zone d'impact verticale
                const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
                state.ballSpeedX = -Math.abs(currentSpeed * Math.cos(bounceAngle)); // Force direction négative (vers gauche)
                state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                state.ballX = paddleLeft - ballRadius; // Repositionner à gauche du paddle
                accelerateBall(state, ballState);
                ballState.lastContact = 2;
                return true;
            }
        }
        
        // Collision avec les faces horizontales (haut/bas) du paddle - Paddles B (1) et D (3)
        if (isInsideHorizontally && !isInsideVertically) {
            if (paddleIndex === 1) { // Paddle B (bas)
                // Rebond angulaire basé sur la zone d'impact horizontale
                const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);
                state.ballSpeedX = currentSpeed * Math.sin(bounceAngle); // Composante horizontale basée sur l'angle
                state.ballSpeedY = -Math.abs(currentSpeed * Math.cos(bounceAngle)); // Force direction négative (vers haut)
                state.ballY = paddleTop - ballRadius; // Repositionner au-dessus du paddle
                accelerateBall(state, ballState);
                ballState.lastContact = 1;
                return true;
            } else if (paddleIndex === 3) { // Paddle D (haut)
                // Rebond angulaire basé sur la zone d'impact horizontale
                const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);
                state.ballSpeedX = currentSpeed * Math.sin(bounceAngle); // Composante horizontale basée sur l'angle
                state.ballSpeedY = Math.abs(currentSpeed * Math.cos(bounceAngle)); // Force direction positive (vers bas)
                state.ballY = paddleBottom + ballRadius; // Repositionner en-dessous du paddle
                accelerateBall(state, ballState);
                ballState.lastContact = 3;
                return true;
            }
        }
        
        // Collision aux coins du paddle - déterminer la face dominante
        if (!isInsideHorizontally && !isInsideVertically) {
            // Calculer quelle direction dominerait pour le rebond
            const deltaXEdge = Math.min(Math.abs(ballCenterX - paddleLeft), Math.abs(ballCenterX - paddleRight));
            const deltaYEdge = Math.min(Math.abs(ballCenterY - paddleTop), Math.abs(ballCenterY - paddleBottom));
            
            // Rebond selon la direction avec la plus petite distance (face la plus proche)
            if (deltaXEdge < deltaYEdge) {
                // Collision principalement sur une face verticale (Paddles A et C)
                if (paddleIndex === 0) {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
                    state.ballSpeedX = Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                    state.ballX = paddleRight + ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 0;
                    return true;
                } else if (paddleIndex === 2) {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
                    state.ballSpeedX = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
                    state.ballX = paddleLeft - ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 2;
                    return true;
                }
            } else {
                // Collision principalement sur une face horizontale (Paddles B et D)
                if (paddleIndex === 1) {
                    const bounceAngle = calculateBounceAngleFromZone(ballCenterX, paddleLeft, paddle.width);
                    state.ballSpeedX = currentSpeed * Math.sin(bounceAngle);
                    state.ballSpeedY = -Math.abs(currentSpeed * Math.cos(bounceAngle));
                    state.ballY = paddleTop - ballRadius;
                    accelerateBall(state, ballState);
                    ballState.lastContact = 1;
                    return true;
                } else if (paddleIndex === 3) {
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
    const checkCircleCollision1v1 = (paddle: any, isLeftPaddle: boolean) => {
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
        const deltaX = ballCenterX - closestX;
        const deltaY = ballCenterY - closestY;
        const distanceSq = deltaX * deltaX + deltaY * deltaY;
        
        // Collision si la distance est inférieure ou égale au rayon de la balle
        if (distanceSq > ballRadius * ballRadius) {
            return false; // Pas de collision
        }
        
        // Vérifier la direction de la balle pour éviter les rebonds multiples
        if (isLeftPaddle && state.ballSpeedX > 0) return false; // Balle s'éloigne du paddle gauche
        if (!isLeftPaddle && state.ballSpeedX < 0) return false; // Balle s'éloigne du paddle droit
        
        // Rebond angulaire basé sur la zone d'impact (mode 1v1)
        // Calculer la vitesse actuelle pour conservation d'énergie
        const currentSpeed = Math.sqrt(state.ballSpeedX * state.ballSpeedX + state.ballSpeedY * state.ballSpeedY);
        
        // Calculer l'angle de rebond selon la zone d'impact
        const bounceAngle = calculateBounceAngleFromZone(ballCenterY, paddleTop, paddle.height);
        
        // Déterminer la direction horizontale (gauche = +1, droite = -1)
        const direction = isLeftPaddle ? 1 : -1;
        
        // Appliquer le nouveau vecteur vitesse avec conservation de la norme
        state.ballSpeedX = currentSpeed * Math.cos(bounceAngle) * direction;
        state.ballSpeedY = currentSpeed * Math.sin(bounceAngle);
        
        // Repositionner la balle pour éviter la pénétration
        if (isLeftPaddle) { // Paddle gauche
            state.ballX = paddleRight + ballRadius; // Repositionner à droite du paddle
        } else { // Paddle droit
            state.ballX = paddleLeft - ballRadius; // Repositionner à gauche du paddle
        }
        
        // Appliquer l'accélération après le rebond
        accelerateBall(state, ballState);
        
        return true;
    };
    
    // Vérifier collision avec paddle gauche (index 0)
    checkCircleCollision1v1(paddles[0], true);
    
    // Vérifier collision avec paddle droit (index 1)
    checkCircleCollision1v1(paddles[1], false);
}

export function shouldResetBall(state: GameState): boolean {
    const { canvasWidth, canvasHeight, ballRadius } = state;
    
    // Reset seulement quand la balle sort COMPLÈTEMENT (pour l'effet visuel)
    return (state.ballX + ballRadius < 0 || 
            state.ballX - ballRadius > canvasWidth ||
            state.ballY + ballRadius < 0 || 
            state.ballY - ballRadius > canvasHeight);
}
