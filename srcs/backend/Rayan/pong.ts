// Pong logic backend (TypeScript, sans DOM)
// Ce module gère l'état du jeu et les mises à jour, sans aucune dépendance au DOM ou au navigateur.

import { GameState, createInitialGameState } from './gameState.js';

export class PongGame {
    public state: GameState;
    private interval: ReturnType<typeof setInterval> | null = null;
    private ballStartTime: number = 0;
    private ballDelayMs: number = 3000; // 3 secondes
    private isFirstLaunch: boolean = true; // Track si c'est le premier lancement

    constructor(numPlayers: number = 2) {
        this.state = createInitialGameState(numPlayers);
    }

    start() 
    {
        if (this.interval) return;
        this.state.running = true;
        this.ballStartTime = Date.now(); // Enregistre le moment où le jeu commence
        this.interval = setInterval(() => this.update(), 1000 / 60); // 60 FPS
    }

    stop() 
    {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.state.running = false;
    }

    movePaddle(player: 'left' | 'right' | 'A' | 'B' | 'C' | 'D', direction: 'up' | 'down') 
    {
        console.log('[BACKEND] movePaddle called:', player, direction, 'paddles.length=', this.state.paddles?.length);
        const speed = this.state.paddleSpeed;
        // Mode 1v1 : paddles[0] = A (gauche), paddles[1] = C (droite)
        if (this.state.paddles && this.state.paddles.length === 2) {
            if (player === 'left' || player === 'A') {
                // Paddle A est à l'index 0
                if (direction === 'up') this.state.paddles[0].y = Math.max(0, this.state.paddles[0].y - speed);
                else this.state.paddles[0].y = Math.min(this.state.canvasHeight - this.state.paddles[0].height, this.state.paddles[0].y + speed);
            } else if (player === 'right' || player === 'C') {
                // Paddle C est à l'index 1
                if (direction === 'up') this.state.paddles[1].y = Math.max(0, this.state.paddles[1].y - speed);
                else this.state.paddles[1].y = Math.min(this.state.canvasHeight - this.state.paddles[1].height, this.state.paddles[1].y + speed);
            }
        }
        // Mode 1v1v1v1 : paddles[0]=A, paddles[1]=B, paddles[2]=C, paddles[3]=D
        else if (this.state.paddles && this.state.paddles.length === 4) {
            let idx = -1;
            if (player === 'A') idx = 0;
            else if (player === 'B') idx = 1;
            else if (player === 'C') idx = 2;
            else if (player === 'D') idx = 3;
            
            console.log(`[BACKEND] Mode 4 joueurs - player=${player}, idx=${idx}, paddles count=${this.state.paddles.length}`);
            
            if (idx !== -1) 
            {
                // Paddle A et C : verticaux (y bouge)
                if (player === 'A' || player === 'C') 
                {
                    const oldY = this.state.paddles[idx].y;
                    if (direction === 'up') this.state.paddles[idx].y = Math.max(0, this.state.paddles[idx].y - speed);
                    else this.state.paddles[idx].y = Math.min(this.state.canvasHeight - this.state.paddles[idx].height, this.state.paddles[idx].y + speed);
                    console.log(`[BACKEND] Paddle ${player} (vertical) moved from y=${oldY} to y=${this.state.paddles[idx].y} (direction=${direction})`);
                }
                // Paddle B et D : horizontaux (x bouge)
                else if (player === 'B' || player === 'D') 
                {
                    const minX = 0;
                    const maxX = this.state.canvasWidth - this.state.paddles[idx].width;
                    if (direction === 'up') this.state.paddles[idx].x = Math.max(minX, this.state.paddles[idx].x - speed); // left
                    else this.state.paddles[idx].x = Math.min(maxX, this.state.paddles[idx].x + speed); // right
                }
            } else
                console.log(`[BACKEND] ERREUR: Paddle ${player} non trouvé en mode 4 joueurs !`);
        }
    }

    update() {
        // Vérifier si le délai de 3 secondes est écoulé avant de faire bouger la balle
        const currentTime = Date.now();
        const timeElapsed = currentTime - this.ballStartTime;
        const ballShouldMove = timeElapsed >= this.ballDelayMs;
        
        // Mettre à jour le compte à rebours pour l'affichage SEULEMENT au premier lancement
        if (this.isFirstLaunch && !ballShouldMove && timeElapsed >= 0) {
            const remainingTime = Math.max(0, this.ballDelayMs - timeElapsed);
            this.state.ballCountdown = Math.ceil(remainingTime / 1000);
        } else {
            this.state.ballCountdown = 0;
            if (ballShouldMove && this.isFirstLaunch) {
                this.isFirstLaunch = false; // Après le premier lancement, plus de countdown
            }
        }
        
        // Déplacement de la balle seulement après le délai (pour le premier lancement uniquement)
        if (this.isFirstLaunch && !ballShouldMove) {
            return; // Attendre le countdown uniquement au premier lancement
        } else if (!this.isFirstLaunch || ballShouldMove) {
            this.state.ballX += this.state.ballSpeedX;
            this.state.ballY += this.state.ballSpeedY;
        }

        // Les collisions et buts ne se déclenchent que si la balle bouge
        if (this.isFirstLaunch && !ballShouldMove)
            return; // Sortir de la fonction si la balle ne doit pas encore bouger

        // Mode 1v1v1v1 (carré, 4 paddles)
        if (this.state.paddles && this.state.paddles.length === 4) {
            const { canvasWidth, canvasHeight, ballRadius } = this.state;
            const paddles = this.state.paddles;

            // --- Collisions avec les paddles (logique améliorée pour bords et coins) ---
            
            // Fonction helper pour détecter collision précise avec un paddle rectangulaire
            const checkPaddleCollision = (paddle: any, paddleIndex: number) => {
                const ballCenterX = this.state.ballX;
                const ballCenterY = this.state.ballY;
                const ballLeft = ballCenterX - ballRadius;
                const ballRight = ballCenterX + ballRadius;
                const ballTop = ballCenterY - ballRadius;
                const ballBottom = ballCenterY + ballRadius;
                
                const paddleLeft = paddle.x;
                const paddleRight = paddle.x + paddle.width;
                const paddleTop = paddle.y;
                const paddleBottom = paddle.y + paddle.height;
                
                // Vérifier si la balle intersecte avec le rectangle du paddle
                const intersects = ballRight > paddleLeft && 
                                 ballLeft < paddleRight && 
                                 ballBottom > paddleTop && 
                                 ballTop < paddleBottom;
                
                if (!intersects) return false;
                
                // Calculer la distance du centre de la balle aux bords du paddle
                const distToLeft = Math.abs(ballCenterX - paddleLeft);
                const distToRight = Math.abs(ballCenterX - paddleRight);
                const distToTop = Math.abs(ballCenterY - paddleTop);
                const distToBottom = Math.abs(ballCenterY - paddleBottom);
                
                // Déterminer quelle face est la plus proche du centre de la balle
                const minDistX = Math.min(distToLeft, distToRight);
                const minDistY = Math.min(distToTop, distToBottom);
                
                // Seuil de tolérance pour éviter les rebonds fantômes aux coins
                const tolerance = ballRadius * 0.1;
                
                // Collision principalement horizontale (faces gauche/droite)
                if (minDistX < minDistY - tolerance) {
                    if (paddleIndex === 0 && ballCenterX > paddleLeft) { // Paddle A (gauche) - collision face droite
                        if (this.state.ballSpeedX < 0) { // Balle va vers la gauche
                            this.state.ballSpeedX = Math.abs(this.state.ballSpeedX);
                            this.state.ballX = paddleRight + ballRadius;
                        }
                    } else if (paddleIndex === 2 && ballCenterX < paddleRight) { // Paddle C (droite) - collision face gauche
                        if (this.state.ballSpeedX > 0) { // Balle va vers la droite
                            this.state.ballSpeedX = -Math.abs(this.state.ballSpeedX);
                            this.state.ballX = paddleLeft - ballRadius;
                        }
                    }
                }
                // Collision principalement verticale (faces haut/bas)
                else if (minDistY < minDistX - tolerance) {
                    if (paddleIndex === 1 && ballCenterY < paddleBottom) { // Paddle B (bas) - collision face haut
                        if (this.state.ballSpeedY > 0) { // Balle va vers le bas
                            this.state.ballSpeedY = -Math.abs(this.state.ballSpeedY);
                            this.state.ballY = paddleTop - ballRadius;
                        }
                    } else if (paddleIndex === 3 && ballCenterY > paddleTop) { // Paddle D (haut) - collision face bas
                        if (this.state.ballSpeedY < 0) { // Balle va vers le haut
                            this.state.ballSpeedY = Math.abs(this.state.ballSpeedY);
                            this.state.ballY = paddleBottom + ballRadius;
                        }
                    }
                }
                // Collision aux coins - rebond selon la direction de la balle
                else {
                    // Pour les coins, on regarde la direction de la balle pour décider du rebond
                    if (paddleIndex === 0 && this.state.ballSpeedX < 0) { // Paddle A, balle vers gauche
                        this.state.ballSpeedX = Math.abs(this.state.ballSpeedX);
                        this.state.ballX = paddleRight + ballRadius;
                    } else if (paddleIndex === 2 && this.state.ballSpeedX > 0) { // Paddle C, balle vers droite
                        this.state.ballSpeedX = -Math.abs(this.state.ballSpeedX);
                        this.state.ballX = paddleLeft - ballRadius;
                    } else if (paddleIndex === 1 && this.state.ballSpeedY > 0) { // Paddle B, balle vers bas
                        this.state.ballSpeedY = -Math.abs(this.state.ballSpeedY);
                        this.state.ballY = paddleTop - ballRadius;
                    } else if (paddleIndex === 3 && this.state.ballSpeedY < 0) { // Paddle D, balle vers haut
                        this.state.ballSpeedY = Math.abs(this.state.ballSpeedY);
                        this.state.ballY = paddleBottom + ballRadius;
                    }
                }
                
                return true;
            };
            
            // Vérifier les collisions pour chaque paddle
            for (let i = 0; i < paddles.length; i++) {
                checkPaddleCollision(paddles[i], i);
            }

            // --- Buts (attribution des points) ---
            // Si la balle sort complètement par le côté A (gauche) - joueur A éliminé
            if (this.state.ballX + ballRadius < 0) {
                paddles[1].score++; // B gagne
                paddles[2].score++; // C gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort complètement par le côté C (droite) - joueur C éliminé
            if (this.state.ballX - ballRadius > canvasWidth) {
                paddles[0].score++; // A gagne
                paddles[1].score++; // B gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort complètement par le bas - joueur B éliminé
            if (this.state.ballY - ballRadius > canvasHeight) {
                paddles[0].score++; // A gagne
                paddles[2].score++; // C gagne
                paddles[3].score++; // D gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }
            // Si la balle sort complètement par le haut - joueur D éliminé
            if (this.state.ballY + ballRadius < 0) {
                paddles[0].score++; // A gagne
                paddles[1].score++; // B gagne
                paddles[2].score++; // C gagne
                console.log(`[BACKEND] But 1v1v1v1 ! Scores - A: ${paddles[0].score}, B: ${paddles[1].score}, C: ${paddles[2].score}, D: ${paddles[3].score}`);
                this.resetBall();
            }

            // Fin de partie si un joueur atteint le score cible
            for (const p of paddles) {
                if (p.score >= this.state.win) {
                    this.stop();
                }
            }
            return;
        }

        // Mode 1v1 (2 paddles)
        if (this.state.paddles && this.state.paddles.length === 2) {
            const { canvasWidth, canvasHeight, paddleHeight, paddleWidth, paddleMargin, ballRadius } = this.state;
            const paddles = this.state.paddles;
            
            // Collisions haut/bas avec les bords du terrain
            if (this.state.ballY - ballRadius <= 0) {
                this.state.ballSpeedY = Math.abs(this.state.ballSpeedY);
                this.state.ballY = ballRadius;
            }
            if (this.state.ballY + ballRadius >= canvasHeight) {
                this.state.ballSpeedY = -Math.abs(this.state.ballSpeedY);
                this.state.ballY = canvasHeight - ballRadius;
            }
            
            // Fonction helper pour collision précise avec les paddles verticaux
            const checkPaddleCollision1v1 = (paddle: any, isLeftPaddle: boolean) => {
                const ballCenterX = this.state.ballX;
                const ballCenterY = this.state.ballY;
                const ballLeft = ballCenterX - ballRadius;
                const ballRight = ballCenterX + ballRadius;
                const ballTop = ballCenterY - ballRadius;
                const ballBottom = ballCenterY + ballRadius;
                
                const paddleLeft = paddle.x;
                const paddleRight = paddle.x + paddle.width;
                const paddleTop = paddle.y;
                const paddleBottom = paddle.y + paddle.height;
                
                // Vérifier si la balle intersecte avec le rectangle du paddle
                const intersects = ballRight > paddleLeft && 
                                 ballLeft < paddleRight && 
                                 ballBottom > paddleTop && 
                                 ballTop < paddleBottom;
                
                if (!intersects) return false;
                
                // Vérifier la direction de la balle pour éviter les rebonds fantômes
                if (isLeftPaddle && this.state.ballSpeedX > 0) return false; // Balle s'éloigne du paddle gauche
                if (!isLeftPaddle && this.state.ballSpeedX < 0) return false; // Balle s'éloigne du paddle droit
                
                // Pour les paddles verticaux, on rebondit toujours sur l'axe X
                if (isLeftPaddle) { // Paddle gauche
                    this.state.ballSpeedX = Math.abs(this.state.ballSpeedX);
                    this.state.ballX = paddleRight + ballRadius;
                } else { // Paddle droit
                    this.state.ballSpeedX = -Math.abs(this.state.ballSpeedX);
                    this.state.ballX = paddleLeft - ballRadius;
                }
                
                return true;
            };
            
            // Vérifier collision avec paddle gauche (index 0)
            checkPaddleCollision1v1(paddles[0], true);
            
            // Vérifier collision avec paddle droit (index 1)
            checkPaddleCollision1v1(paddles[1], false);
            // But à gauche - balle sort complètement
            if (this.state.ballX + ballRadius < 0) {
                paddles[1].score++;
                this.resetBall();
            }
            // But à droite - balle sort complètement
            if (this.state.ballX - ballRadius > canvasWidth) {
                paddles[0].score++;
                this.resetBall();
            }
            // Arrêt de la partie si un joueur atteint le score de victoire
            if (paddles[0].score >= this.state.win || paddles[1].score >= this.state.win) {
                this.stop();
            }
            return;
        }
    }

    resetBall() {
        this.state.ballX = this.state.canvasWidth / 2;
        this.state.ballY = this.state.canvasHeight / 2;
        
        // Vitesse équilibrée pour une trajectoire linéaire (speedX = speedY)
        const baseSpeed = 3; // Vitesse uniforme pour X et Y
        
        // Direction aléatoire pour X et Y (trajectoire diagonale équilibrée)
        this.state.ballSpeedX = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
        this.state.ballSpeedY = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
        
        // Reset timer only on first launch, not on subsequent ball resets
        if (this.isFirstLaunch) {
            this.ballStartTime = Date.now();
        } else {
            // For subsequent resets, ensure countdown is disabled
            this.state.ballCountdown = 0;
        }
    }
}

// Pour usage backend :
// - Instancier PongGame pour chaque partie/room
// - Appeler movePaddle('left'|'right', 'up'|'down') sur réception d'un message
// - Appeler start() pour lancer la partie
// - À chaque tick, envoyer this.state aux clients via WebSocket
