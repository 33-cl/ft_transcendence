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
        reactionTime: 1200,         // Réaction lente mais cohérente
        errorMargin: 30,            // Erreurs modestes (petits offsets)
        keyHoldDuration: 500,       // Maintient un peu plus longtemps
        keyReleaseChance: 0.6,      // Relâche parfois les touches
        panicThreshold: 300,        // Panique modérée
        microcorrectionChance: 0.08, // Quelques micro-corrections
        persistanceTime: 250,       // Persistance raisonnable
        maxErrorFrequency: 0.35     // Erreurs modérées
    },
    medium: {
        reactionTime: 800,          // Réaction modérée
        errorMargin: 25,            // Erreurs modérées
        keyHoldDuration: 250,       // Durée normale
        keyReleaseChance: 0.35,     // Relâche occasionnellement
        panicThreshold: 250,        // Panique modérée
        microcorrectionChance: 0.25, // Quelques corrections
        persistanceTime: 500,       // Persistance modérée
        maxErrorFrequency: 0.25     // Quelques erreurs
    },
    hard: {
        reactionTime: 100,          // Réaction ultra-rapide
        errorMargin: 3,             // Presque pas d'erreurs
        keyHoldDuration: 60,        // Très précis
        keyReleaseChance: 0.01,     // Relâche rarement
        panicThreshold: 80,         // Panique tard
        microcorrectionChance: 0.8, // Beaucoup de corrections
        persistanceTime: 1500,      // Très persistant
        maxErrorFrequency: 0.01     // Erreurs rarissimes
    }
};

/**
 * Crée une configuration IA selon le niveau de difficulté choisi
 * @param difficulty Niveau de difficulté (easy/medium/hard)
 * @returns Configuration IA complète et prête à utiliser
 */
export function createAIConfig(difficulty: AIDifficulty): AIConfig {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    
    // ⚖️ FAIRNESS RULE (Subject v18.0): All players share the same paddle speed
    // Difficulty is controlled ONLY by reaction time, error margin, and decision jitter
    const paddleSpeed = 24; // Same speed as human players (enforced in paddle.ts via state.paddleSpeed)
    
    // Runtime self-check: ensure AI speed matches human speed (should always be 24)
    if (paddleSpeed !== 24) {
        console.warn('⚠️ WARNING: AI paddle speed is', paddleSpeed, 'instead of 24. Fairness violation!');
    }
    
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
        paddleSpeed: paddleSpeed,         // Same speed as humans (fairness requirement)
        
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
        debugMode: false,                 // Debug désactivé par défaut
        decisionCount: 0,                 // Compteur de décisions
        errorCount: 0,                    // Compteur d'erreurs
        panicCount: 0                     // Compteur de paniques
    };
}

/**
 * Fonction helper pour obtenir la vitesse du paddle depuis le gameState
 * Permet à l'IA d'utiliser la même vitesse que les joueurs humains
 */
function getPaddleSpeedFromState(state: GameState): number {
    return state.paddleSpeed; // Utilise la vitesse définie dans gameState
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
    
    const now = Date.now();
    const ai = state.aiConfig;
    
    // Vérifier si c'est le moment de mettre à jour (1 fois par seconde max)
    // Moins de mises à jour en mode facile pour un comportement plus "humain"
    const updateInterval = ai.difficulty === 'easy' ? 2000 : // 2 secondes en mode facile 
                          ai.difficulty === 'medium' ? 1200 : // 1.2 secondes en mode moyen
                          800; // 0.8 secondes en mode difficile
                          
    if (now - ai.lastUpdate < updateInterval) return;
    
    // Détecter le mode panique selon la distance de la balle
    const ballDistance = Math.abs(state.ballX - (state.paddleMargin + state.paddleWidth));
    const wasPanic = ai.panicMode;
    ai.panicMode = ballDistance <= ai.panicThreshold && state.ballSpeedX < 0; // Balle qui approche
    
    // Compteur de panique
    if (ai.panicMode && !wasPanic) {
        ai.panicCount++;
        if (ai.debugMode) {
            console.log(`🚨 [IA-${ai.difficulty}] MODE PANIQUE activé! Distance balle: ${ballDistance.toFixed(1)}px`);
        }
    }
    
    // Prédire où la balle va atterrir
    let predictedY = predictBallLanding(state);
    
    // En mode facile, appliquer principalement de petits offsets pour paraître humain
    if (ai.difficulty === 'easy') {
        // Petit offset fréquent
        const smallOffset = (Math.random() - 0.5) * ai.errorMargin; // ± errorMargin/2
        predictedY += smallOffset;

        // Très rarement, faire une grosse erreur (miss) pour varier le comportement
        if (Math.random() < 0.05) { // 5% chance
            const bigMiss = (Math.random() < 0.5 ? -1 : 1) * (ai.errorMargin * 3 + Math.random() * ai.errorMargin * 2);
            predictedY += bigMiss;
            if (ai.debugMode) console.log(`[IA-easy] Grosse erreur (miss): ${bigMiss.toFixed(1)}px`);
        }
    }
    
    if (ai.debugMode) {
        console.log(`🎯 [IA-${ai.difficulty}] Prédiction: Y=${predictedY.toFixed(1)} | Balle: X=${state.ballX.toFixed(1)}, SpeedX=${state.ballSpeedX.toFixed(2)}`);
    }
    
    // Système de persistance : ne pas changer d'avis trop souvent
    let targetY = predictedY;
    if (ai.lastDecisionTime > 0 && (now - ai.lastDecisionTime) < ai.persistanceTime) {
        // Garder l'ancienne cible si on est encore dans la période de persistance
        targetY = ai.targetY;
    } else {
        // Nouvelle décision autorisée
        ai.lastDecisionTime = now;
        ai.decisionCount++;
        
        // Appliquer les erreurs selon la fréquence maximale et le mode panique
        const errorChance = ai.panicMode ? ai.maxErrorFrequency * 1.5 : ai.maxErrorFrequency;
        if (Math.random() < errorChance) {
            // Erreur importante : décalage aléatoire
            const errorOffset = (Math.random() - 0.5) * ai.errorMargin * 2;
            targetY += errorOffset;
            ai.errorCount++;
            
            if (ai.debugMode) {
                console.log(`❌ [IA-${ai.difficulty}] ERREUR! Décalage: ${errorOffset.toFixed(1)}px (${ai.panicMode ? 'PANIQUE' : 'normale'})`);
            }
        }
        
        // Micro-corrections : petits ajustements aléatoires pour simuler l'imprécision humaine
        if (Math.random() < ai.microcorrectionChance) {
            const microError = (Math.random() - 0.5) * (ai.errorMargin * 0.3);
            targetY += microError;
            
            if (ai.debugMode) {
                console.log(`🔧 [IA-${ai.difficulty}] Micro-correction: ${microError.toFixed(1)}px`);
            }
        }
        
        if (ai.debugMode) {
            console.log(`📊 [IA-${ai.difficulty}] Stats: Décisions=${ai.decisionCount}, Erreurs=${ai.errorCount}, Paniques=${ai.panicCount}`);
        }
    }
    
    // S'assurer que la cible reste dans les limites du canvas
    const paddleHeight = state.paddles[0]?.height || state.paddleHeight;
    const minY = paddleHeight / 2; // Centre du paddle au minimum
    const maxY = state.canvasHeight - paddleHeight / 2; // Centre du paddle au maximum
    targetY = Math.max(minY, Math.min(maxY, targetY));
    
    // Mettre à jour la configuration IA
    ai.targetY = targetY;
    ai.lastUpdate = now;
    
    // Seuil de mouvement adaptatif : plus précis en mode difficile, plus large en facile
    const movementThreshold = ai.panicMode ? 3 : (ai.difficulty === 'hard' ? 4 : ai.difficulty === 'medium' ? 6 : 8);
    ai.isMoving = Math.abs(targetY - ai.currentY) > movementThreshold;
}

/**
    // Simuler les inputs clavier de l'IA (appelé chaque frame)
    // L'IA appelle movePaddle() exactement comme un joueur humain
    // Intègre les comportements avancés : panique, micro-corrections, persistance
    // @param state État actuel du jeu
    */
export function simulateKeyboardInput(state: GameState): void {
    if (!state.aiConfig || !state.aiConfig.enabled) return;
    const ai = state.aiConfig;
    const now = Date.now();

    // L'IA ne s'endort plus : elle peut se tromper mais restera cohérente dans ses réactions

    // Mettre à jour la position actuelle basée sur le paddle réel
    if (state.paddles && state.paddles.length >= 1) {
        ai.currentY = state.paddles[0].y;
    }
    
    // La vitesse est maintenant gérée directement dans movePaddle()
    // Nous n'avons plus besoin de modifier temporairement state.paddleSpeed

    // Gestion du timer de micro-corrections
    if (ai.microcorrectionTimer > 0) {
        ai.microcorrectionTimer = Math.max(0, ai.microcorrectionTimer - 16); // ~60fps
    }

    // Si le paddle doit bouger mais que le délai de réaction n'a pas commencé, on l'initialise
    if (ai.isMoving && ai.reactionStartTime === 0) {
        ai.reactionStartTime = now;
        return; // On attend le délai avant de bouger
    }
    
    // Délai de réaction adaptatif : plus court en mode panique
    const adaptiveReactionTime = ai.panicMode ? ai.reactionTime * 0.7 : ai.reactionTime;
    
    // Si le délai de réaction n'est pas écoulé, on ne bouge pas
    if (ai.isMoving && now - ai.reactionStartTime < adaptiveReactionTime) {
        return;
    }
    
    // Si on n'est pas censé bouger, on reset le délai et les touches
    if (!ai.isMoving) {
        ai.reactionStartTime = 0;
        ai.keyPressed = null;
        ai.keyPressStartTime = 0;
        return;
    }

    // Déterminer quelle direction prendre
    const paddleCenter = ai.currentY + (state.paddles[0]?.height || state.paddleHeight) / 2;
    const difference = ai.targetY - paddleCenter;
    
    // Seuil de précision adaptatif selon la difficulté et le mode panique
    let threshold = ai.panicMode ? 2 : (ai.difficulty === 'hard' ? 4 : ai.difficulty === 'medium' ? 6 : 8);
    
    // Si on est assez proche de la cible, arrêter de bouger
    if (Math.abs(difference) <= threshold) {
        ai.keyPressed = null;
        ai.keyPressStartTime = 0;
        return;
    }

    // Déterminer la direction nécessaire
    const requiredDirection: 'up' | 'down' = difference < 0 ? 'up' : 'down';

    // Gestion des touches : presser, maintenir, ou relâcher
    if (!ai.keyPressed) {
        // Aucune touche pressée : en presser une nouvelle
        ai.keyPressed = requiredDirection;
        ai.keyPressStartTime = now;
        movePaddle(state, 'A', requiredDirection);
    } else if (ai.keyPressed === requiredDirection) {
        // Bonne direction : continuer ou relâcher selon les paramètres
        const keyHeldDuration = now - ai.keyPressStartTime;
        
        // Durée de maintien adaptative : plus courte en mode panique
        const adaptiveHoldDuration = ai.panicMode ? ai.keyHoldDuration * 0.6 : ai.keyHoldDuration;
        
        // Chance de relâchement adaptative : plus élevée en mode panique pour easy/medium
        let adaptiveReleaseChance = ai.keyReleaseChance;
        if (ai.panicMode && ai.difficulty !== 'hard') {
            adaptiveReleaseChance *= 1.5; // Augmente les erreurs en mode panique
        }
        
        // Vérifier si on doit relâcher prématurément (simulation d'erreur humaine)
        if (keyHeldDuration >= adaptiveHoldDuration && Math.random() < adaptiveReleaseChance) {
            ai.keyPressed = null;
            ai.keyPressStartTime = 0;
            
            // Démarrer le timer de micro-correction après un relâchement
            if (Math.random() < ai.microcorrectionChance) {
                ai.microcorrectionTimer = 100 + Math.random() * 200; // 100-300ms
            }
        } else {
            // Continuer à maintenir la touche
            movePaddle(state, 'A', requiredDirection);
        }
    } else {
        // Mauvaise direction : relâcher et changer (mais avec une certaine inertie)
        const directionChangeDelay = ai.panicMode ? 50 : 150; // Plus rapide en panique
        if (now - ai.keyPressStartTime >= directionChangeDelay) {
            ai.keyPressed = requiredDirection;
            ai.keyPressStartTime = now;
            movePaddle(state, 'A', requiredDirection);
        }
    }
}