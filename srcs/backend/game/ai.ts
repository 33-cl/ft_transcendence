// ai.ts - Intelligence Artificielle pour le mode 1 joueur
// Contrôle le paddle gauche (côté A) avec un comportement réaliste et équilibré
// Simule des inputs clavier comme un joueur humain

import { GameState, AIDifficulty, AIConfig } from './gameState.js';
import { movePaddle } from './paddle.js';

/**
 * Configuration des niveaux de difficulté de l'IA
 * Détermine le comportement et la performance de l'IA selon le niveau choisi
 */
const DIFFICULTY_SETTINGS = {
    easy: {
        reactionTime: 800,         // Réaction lente mais cohérente
        errorMargin: 30,            // Erreurs modestes (petits offsets)
        keyHoldDuration: 200,       // Maintient un peu plus longtemps
        keyReleaseChance: 0.2,      // Relâche parfois les touches
        panicThreshold: 200,        // Panique modérée
        microcorrectionChance: 0.08, // Quelques micro-corrections
        persistanceTime: 500,      // Persistance longue (recalcule rarement)
        maxErrorFrequency: 0.20     // Erreurs modérées
    },
    medium: {
        reactionTime: 500,          // Réaction modérée
        errorMargin: 10,            // Erreurs modérées
        keyHoldDuration: 100,       // Durée normale
        keyReleaseChance: 0.1,     // Relâche occasionnellement
        panicThreshold: 100,        // Panique modérée
        microcorrectionChance: 0.25, // Quelques corrections
        persistanceTime: 250,       // Persistance modérée
        maxErrorFrequency: 0.10     // Quelques erreurs
    },
    hard: {
        reactionTime: 100,          // Réaction ultra-rapide
        errorMargin: 1,             // Presque pas d'erreurs
        keyHoldDuration: 60,        // Très précis
        keyReleaseChance: 0.01,     // Relâche rarement
        panicThreshold: 50,         // Panique tard
        microcorrectionChance: 0.8, // Beaucoup de corrections
        persistanceTime: 100,       // Persistance courte (recalcule souvent)
        maxErrorFrequency: 0.01     // Erreurs rarissimes
    }
};

/**
 * Crée une configuration IA selon le niveau de difficulté choisi
 * @param difficulty Niveau de difficulté (easy/medium/hard)
 * @returns Configuration IA complète et prête à utiliser
 */
export function createAIConfig(difficulty: AIDifficulty, paddleSpeed: number): AIConfig {
    const settings = DIFFICULTY_SETTINGS[difficulty];

    // ⚖️ FAIRNESS RULE: Tous les joueurs partagent la même vitesse de paddle
    // La difficulté est contrôlée uniquement par le temps de réaction, la marge d'erreur et la variation de décision
    // La valeur effective doit provenir de state.paddleSpeed ; on la reçoit désormais en paramètre.
    
    return {
        enabled: true,
        difficulty: difficulty,
        reactionTime: settings.reactionTime,
        errorMargin: settings.errorMargin,
        lastUpdate: 0,                    // Pas encore de mise à jour
        targetY: 400,                     // Position centrale par défaut (milieu du canvas 800/2)
        currentY: 400,                    // Position actuelle (sera mise à jour)
        isMoving: false,                  // Pas en mouvement au début
        reactionStartTime: 0,             // Initialisé à 0 (aucun délai en cours)
        paddleSpeed: paddleSpeed,         // Même vitesse que les humains (exigence d'équité)
        
        // Simulation des touches clavier
        keyPressed: null,                 // Aucune touche pressée au début
        keyPressStartTime: 0,             // Pas de pression en cours
        keyHoldDuration: settings.keyHoldDuration,
        keyReleaseChance: settings.keyReleaseChance,
        
        // Nouveaux comportements humains
        panicMode: false,                 // Pas en panique au début
        lastDecisionTime: 0,              // Aucune décision prise encore
        microcorrectionTimer: 0,          // Timer des micro-corrections
        panicThreshold: settings.panicThreshold,
        microcorrectionChance: settings.microcorrectionChance,
        persistanceTime: settings.persistanceTime,
        maxErrorFrequency: settings.maxErrorFrequency,
        
        // Debug et statistiques
        debugMode: true,                 // Debug désactivé par défaut
        decisionCount: 0,                 // Compteur de décisions
        errorCount: 0,                    // Compteur d'erreurs
        panicCount: 0                     // Compteur de paniques
    };
}


/**
 * Prédit où la balle va atterrir sur le côté gauche (paddle IA)
 * Utilise une prédiction linéaire simple sans tenir compte des rebonds de paddles
 * @param state État actuel du jeu
 * @returns Position Y prédite où la balle touchera le côté gauche
 */
export function predictBallLanding(state: GameState): number {
    // Si la balle va vers la droite, pas besoin de prédire
    if (state.ballSpeedX >= 0)
        return state.ballY; // Retourner position actuelle
    
    // Calculer le temps pour atteindre le paddle gauche (x = paddleMargin + paddleWidth)
    const paddleLeftEdge = state.paddleMargin + state.paddleWidth;
    const timeToReachPaddle = (state.ballX - paddleLeftEdge) / Math.abs(state.ballSpeedX);
    
    // Prédire la position Y
    let predictedY = state.ballY + (state.ballSpeedY * timeToReachPaddle);

    // Gérer les rebonds sur les bords haut/bas du terrain
    while (predictedY < 0 || predictedY > state.canvasHeight) {
        if (predictedY < 0)
            predictedY = Math.abs(predictedY); // Rebond sur le haut
        if (predictedY > state.canvasHeight)
            predictedY = state.canvasHeight - (predictedY - state.canvasHeight); // Rebond sur le bas
    }
    
    return predictedY;
}

/**
 * Met à jour la cible de l'IA (appelé maximum 1 fois par seconde)
 * Applique les délais de réaction et les erreurs selon la difficulté
 * Intègre les nouveaux comportements : panique, persistance, micro-corrections
 * @param state État actuel du jeu
 */
export function updateAITarget(state: GameState): void {
    if (!state.aiConfig) return;

    const currentTime = Date.now();
    const aiConfig = state.aiConfig;

    const updateInterval = aiConfig.difficulty === 'easy' ? 2200 :
        aiConfig.difficulty === 'medium' ? 1600 : 1000;
    if (currentTime - aiConfig.lastUpdate < updateInterval) return;

    const ballDistance = Math.abs(state.ballX - (state.paddleMargin + state.paddleWidth));
    const wasPanic = aiConfig.panicMode;
    aiConfig.panicMode = ballDistance <= aiConfig.panicThreshold && state.ballSpeedX < 0;
    if (aiConfig.panicMode && !wasPanic) {
        aiConfig.panicCount++;
    }

    let baseTargetY;
    let isNewDecision = false;
    if (aiConfig.lastDecisionTime > 0 && (currentTime - aiConfig.lastDecisionTime) < aiConfig.persistanceTime) {
        baseTargetY = aiConfig.targetY;
    } else {
        let predictedY = predictBallLanding(state);
        if (aiConfig.difficulty === 'easy') {
            const smallOffset = (Math.random() - 0.5) * aiConfig.errorMargin;
            predictedY += smallOffset;
            if (Math.random() < 0.05) {
                const bigMiss = (Math.random() - 0.5) * aiConfig.errorMargin * 5;
                predictedY += bigMiss;
            }
        }
        baseTargetY = predictedY;
        aiConfig.lastDecisionTime = currentTime;
        aiConfig.decisionCount++;
        isNewDecision = true;
    }
    let targetY = baseTargetY;
    const errorChance = aiConfig.panicMode ? aiConfig.maxErrorFrequency * 1.5 : aiConfig.maxErrorFrequency;
    if (Math.random() < errorChance) {
        const errorOffset = (Math.random() - 0.5) * aiConfig.errorMargin * 2;
        targetY += errorOffset;
        aiConfig.errorCount++;
    }
    if (Math.random() < aiConfig.microcorrectionChance) {
        const microError = (Math.random() - 0.5) * (aiConfig.errorMargin * 0.3);
        targetY += microError;
    }
    const paddleHeight = state.paddles[0]?.height || state.paddleHeight;
    const minY = paddleHeight / 2;
    const maxY = state.canvasHeight - paddleHeight / 2;
    targetY = Math.max(minY, Math.min(maxY, targetY));
    aiConfig.targetY = targetY;
    aiConfig.lastUpdate = currentTime;
    aiConfig.isMoving = Math.abs(targetY - aiConfig.currentY) > getAdaptiveThreshold(aiConfig);
}

function getAdaptiveThreshold(aiConfig: AIConfig): number {
    if (aiConfig.panicMode) return 3;
    if (aiConfig.difficulty === 'hard') return 4;
    if (aiConfig.difficulty === 'medium') return 6;
    return 8;
}

function getAdaptiveReactionTime(aiConfig: AIConfig): number {
    return aiConfig.panicMode ? aiConfig.reactionTime * 0.7 : aiConfig.reactionTime;
}

function getAdaptiveHoldDuration(aiConfig: AIConfig): number {
    return aiConfig.panicMode ? aiConfig.keyHoldDuration * 0.6 : aiConfig.keyHoldDuration;
}

/**
    // Simuler les inputs clavier de l'IA (appelé chaque frame)
    // L'IA appelle movePaddle() exactement comme un joueur humain
    // Intègre les comportements avancés : panique, micro-corrections, persistance
    // @param state État actuel du jeu
    */
export function simulateKeyboardInput(state: GameState): void {
    if (!state.aiConfig || !state.aiConfig.enabled) return;
    const aiConfig = state.aiConfig;
    const currentTime = Date.now();

    if (state.paddles && state.paddles.length >= 1) {
        aiConfig.currentY = state.paddles[0].y;
    }

    if (aiConfig.microcorrectionTimer > 0) {
        aiConfig.microcorrectionTimer = Math.max(0, aiConfig.microcorrectionTimer - 16);
    }

    if (aiConfig.isMoving && aiConfig.reactionStartTime === 0) {
        aiConfig.reactionStartTime = currentTime;
        return;
    }

    const adaptiveReactionTime = getAdaptiveReactionTime(aiConfig);
    if (aiConfig.isMoving && currentTime - aiConfig.reactionStartTime < adaptiveReactionTime) {
        return;
    }

    if (!aiConfig.isMoving) {
        aiConfig.reactionStartTime = 0;
        aiConfig.keyPressed = null;
        aiConfig.keyPressStartTime = 0;
        return;
    }

    const paddleCenter = aiConfig.currentY + (state.paddles[0]?.height || state.paddleHeight) / 2;
    const distanceToTarget = aiConfig.targetY - paddleCenter;

    const threshold = aiConfig.panicMode ? 2 : getAdaptiveThreshold(aiConfig);
    if (Math.abs(distanceToTarget) <= threshold) {
        aiConfig.keyPressed = null;
        aiConfig.keyPressStartTime = 0;
        return;
    }

    const requiredDirection: 'up' | 'down' = distanceToTarget < 0 ? 'up' : 'down';

    if (!aiConfig.keyPressed) {
        aiConfig.keyPressed = requiredDirection;
        aiConfig.keyPressStartTime = currentTime;
        movePaddle(state, 'LEFT', requiredDirection);
    } else if (aiConfig.keyPressed === requiredDirection) {
        const keyHeldDuration = currentTime - aiConfig.keyPressStartTime;
        const adaptiveHoldDuration = getAdaptiveHoldDuration(aiConfig);
        let adaptiveReleaseChance = aiConfig.keyReleaseChance;
        if (aiConfig.panicMode && aiConfig.difficulty !== 'hard') {
            adaptiveReleaseChance *= 1.5;
        }
        if (keyHeldDuration >= adaptiveHoldDuration && Math.random() < adaptiveReleaseChance) {
            aiConfig.keyPressed = null;
            aiConfig.keyPressStartTime = 0;
            if (Math.random() < aiConfig.microcorrectionChance) {
                aiConfig.microcorrectionTimer = 100 + Math.random() * 200;
            }
        } else {
            movePaddle(state, 'LEFT', requiredDirection);
        }
    } else {
        const directionChangeDelay = aiConfig.panicMode ? 50 : 150;
        if (currentTime - aiConfig.keyPressStartTime >= directionChangeDelay) {
            aiConfig.keyPressed = requiredDirection;
            aiConfig.keyPressStartTime = currentTime;
            movePaddle(state, 'LEFT', requiredDirection);
        }
    }
}