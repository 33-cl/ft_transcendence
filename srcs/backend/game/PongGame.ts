// PongGame.ts - Classe principale du jeu Pong backend
// Ce module gère l'état du jeu et les mises à jour, sans aucune dépendance au DOM ou au navigateur.

import { GameState, createInitialGameState } from './gameState.js';
import { movePaddle } from './paddle.js';
import { resetBall, BallState, checkBallCollisions4Players, checkBallCollisions2Players, shouldResetBall } from './ball.js';
import { checkScoring4Players, checkScoring2Players, checkGameEnd4Players, checkGameEnd2Players, GameEndInfo } from './score.js';
import { updateAITarget, simulateKeyboardInput, createAIConfig } from './ai.js';

export class PongGame {
    public state: GameState;
    private interval: ReturnType<typeof setInterval> | null = null;
    private ballStartTime: number = 0;
    private ballDelayMs: number = 3000; // 3 secondes
    private isFirstLaunch: boolean = true; // Track si c'est le premier lancement
    private onGameEnd?: (winner: { side: string; score: number }, loser: { side: string; score: number }) => void;
    private ballState: BallState = {
        accelerationCount: 0,
        pointScored: false,
        lastContact: -1
    };
    
    constructor(numPlayers: number = 2, onGameEnd?: (winner: { side: string; score: number }, loser: { side: string; score: number }) => void) {
        this.state = createInitialGameState(numPlayers);
        this.onGameEnd = onGameEnd;
        // Ne pas appeler resetBall() ici pour éviter de recréer un état initial
        // L'état initial de gameState.ts est déjà correct
        this.ballState.accelerationCount = 0;
    }

    start() {
        if (this.state.running) return;
        this.state.running = true;
        
        // Initialisation des timers pour la boucle à pas fixe
        const now = Date.now();
        this.ballStartTime = now; // Enregistre le moment où le jeu commence
    }

    stop() {
        // Plus de clearInterval car plus de boucle autonome
        this.interval = null;
        this.state.running = false;
    }

    /**
     * Méthode publique appelée par handleGameTick pour avancer d'un tick
     * La boucle externe (setInterval) gère le timing à 120Hz.
     * Cette méthode fait exactement 1 update par appel.
     */
    tick(): void {
        if (!this.state.running) return;
        
        // Mettre à jour le timestamp pour le client
        this.state.timestamp = Date.now();
        
        // Exécuter exactement 1 update physique (dt = 1/120 seconde)
        // Normalisation: update() utilise dt * 60 pour normaliser à 60FPS
        // Donc pour 120Hz: dt = 1/120, moveFactor = (1/120) * 60 = 0.5
        // Cela donne un mouvement 2x plus lent par tick, mais 2x plus de ticks = même vitesse
        this.update(1 / 120);
    }

    movePaddle(player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP', direction: 'up' | 'down') {
        movePaddle(this.state, player, direction);
    }

    update(dt: number = 1/60) { // dt par défaut à 1/60 seconde pour rétrocompatibilité
        // Vérifier si le délai de 3 secondes est écoulé avant de faire bouger la balle
        const currentTime = Date.now();
        const timeElapsed = currentTime - this.ballStartTime;
        const ballShouldMove = timeElapsed >= this.ballDelayMs;
        
        // Mettre à jour le compte à rebours pour l'affichage SEULEMENT au premier lancement
        if (this.isFirstLaunch && !ballShouldMove && timeElapsed >= 0) {
            const remainingTime = Math.max(0, this.ballDelayMs - timeElapsed);
            this.state.ballCountdown = Math.ceil(remainingTime / 1000);
            // IMPORTANT: Pendant le countdown, forcer la balle au centre avec vitesse 0
            // pour éviter que le client extrapole et fasse bouger la balle
            this.state.ballX = this.state.canvasWidth / 2;
            this.state.ballY = this.state.canvasHeight / 2;
            this.state.ballSpeedX = 0;
            this.state.ballSpeedY = 0;
        } else {
            this.state.ballCountdown = 0;
            if (ballShouldMove && this.isFirstLaunch) {
                this.isFirstLaunch = false; // Après le premier lancement, plus de countdown
                // Donner une vitesse initiale à la balle maintenant
                const angle = Math.random() * Math.PI / 2 - Math.PI / 4; // -45° à +45°
                const direction = Math.random() < 0.5 ? 1 : -1;
                const speed = 6.5;
                this.state.ballSpeedX = Math.cos(angle) * speed * direction;
                this.state.ballSpeedY = Math.sin(angle) * speed;
            }
        }
        
        // Déplacement de la balle seulement après le délai (pour le premier lancement uniquement)
        if (this.isFirstLaunch && !ballShouldMove) {
            return; // Attendre le countdown uniquement au premier lancement
        } else if (!this.isFirstLaunch || ballShouldMove) {
            // Utiliser dt pour un mouvement indépendant du framerate (normaliser par rapport à 60FPS)
            const moveFactor = dt * 60; // normalisation par rapport à 60FPS
            this.state.ballX += this.state.ballSpeedX * moveFactor;
            this.state.ballY += this.state.ballSpeedY * moveFactor;
        }

        // Les collisions et buts ne se déclenchent que si la balle bouge
        if (this.isFirstLaunch && !ballShouldMove)
            return; // Sortir de la fonction si la balle ne doit pas encore bouger

        // Mode 1v1v1v1 (carré, 4 paddles)
        if (this.state.paddles && this.state.paddles.length === 4) {
            // Vérifier les collisions avec les paddles
            checkBallCollisions4Players(this.state, this.ballState);

            // Vérifier les buts (attribution des points)
            checkScoring4Players(this.state, this.ballState);
            
            // Reset de la balle quand elle sort complètement
            if (shouldResetBall(this.state)) {
                this.resetBall();
            }

            // Vérifier la fin de partie
            const gameEndInfo = checkGameEnd4Players(this.state);
            if (gameEndInfo) {
                this.stop();
                if (this.onGameEnd) {
                    this.onGameEnd(gameEndInfo.winner, gameEndInfo.loser);
                }
            }
            return;
        }

        // Mode 1v1 (2 paddles)
        if (this.state.paddles && this.state.paddles.length === 2) {
            // Mise à jour IA (si activée)
            if (this.state.aiConfig && this.state.aiConfig.enabled) {
                updateAITarget(this.state);         // 1x/seconde
                simulateKeyboardInput(this.state);  // Chaque frame - simule les touches
            }
            // Vérifier les collisions avec les paddles et les bords
            checkBallCollisions2Players(this.state, this.ballState);
            
            // Vérifier les buts (attribution des points)
            checkScoring2Players(this.state, this.ballState);
            
            // Reset de la balle quand elle sort complètement
            if (shouldResetBall(this.state)) {
                this.resetBall();
            }

            // Vérifier la fin de partie
            const gameEndInfo = checkGameEnd2Players(this.state);
            if (gameEndInfo) {
                this.stop();
                if (this.onGameEnd) {
                    this.onGameEnd(gameEndInfo.winner, gameEndInfo.loser);
                }
            }
            return;
        }
    }

    resetBall() {
        resetBall(this.state, this.ballState, this.isFirstLaunch);
        
        // Reset timer only on first launch, not on subsequent ball resets
        if (this.isFirstLaunch) {
            this.ballStartTime = Date.now();
        }
    }

    /**
     * Active l'IA pour le paddle gauche (côté A) en mode 1v1
     * @param difficulty Niveau de difficulté (easy/medium/hard)
     */
    enableAI(difficulty: 'easy' | 'medium' | 'hard') {
        if (this.state.paddles.length !== 2) {
            console.warn('IA disponible uniquement en mode 1v1 (2 paddles)');
            return;
        }
        
    this.state.aiConfig = createAIConfig(difficulty, this.state.paddleSpeed);
    }

    /**
     * Désactive l'IA (mode 2 joueurs humains)
     */
    disableAI() {
        this.state.aiConfig = undefined;
    }

    /**
     * Active le mode debug de l'IA pour visualiser ses décisions
     * Requis pour l'évaluation : expliquer comment l'IA fonctionne
     */
    enableAIDebug() {
        if (this.state.aiConfig)
            this.state.aiConfig.debugMode = true;
    }

    /**
     * Désactive le mode debug de l'IA
     */
    disableAIDebug() {
        if (this.state.aiConfig)
            this.state.aiConfig.debugMode = false;
    }

    /**
     * Récupère les statistiques de l'IA pour l'évaluation
     * @returns Objet contenant les statistiques de performance
     */
    getAIStats() {
        if (!this.state.aiConfig) {
            return null;
        }
        
        const ai = this.state.aiConfig;
        const errorRate = ai.decisionCount > 0 ? (ai.errorCount / ai.decisionCount * 100) : 0;
        
        return {
            difficulty: ai.difficulty,
            decisionCount: ai.decisionCount,
            errorCount: ai.errorCount,
            panicCount: ai.panicCount,
            errorRate: errorRate.toFixed(2) + '%',
            currentState: {
                panicMode: ai.panicMode,
                isMoving: ai.isMoving,
                keyPressed: ai.keyPressed,
                targetY: ai.targetY.toFixed(1),
                currentY: ai.currentY.toFixed(1)
            }
        };
    }
}

// Pour usage backend :
// - Instancier PongGame pour chaque partie/room
// - Appeler movePaddle('left'|'right', 'up'|'down') sur réception d'un message
// - Appeler start() pour lancer la partie
// - À chaque tick, envoyer this.state aux clients via WebSocket
