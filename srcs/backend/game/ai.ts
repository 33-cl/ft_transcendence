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
        reactionTime: 700,          // Réaction lente (700ms)
        errorMargin: 15,            // Beaucoup d'erreurs (±15 pixels)
        keyHoldDuration: 200,       // Durée minimale de maintien d'une touche (ms)
        keyReleaseChance: 0.3       // 30% de chance de relâcher la touche prématurément
    },
    medium: {
        reactionTime: 500,          // Réaction moyenne (500ms)
        errorMargin: 10,            // Erreurs modérées (±10 pixels)
        keyHoldDuration: 150,       // Durée minimale de maintien d'une touche (ms)
        keyReleaseChance: 0.15      // 15% de chance de relâcher la touche prématurément
    },
    hard: {
        reactionTime: 300,          // Réaction rapide (300ms)
        errorMargin: 5,             // Peu d'erreurs (±5 pixels)
        keyHoldDuration: 100,       // Durée minimale de maintien d'une touche (ms)
        keyReleaseChance: 0.05      // 5% de chance de relâcher la touche prématurément
    }
};

/**
 * Crée une configuration IA selon le niveau de difficulté choisi
 * @param difficulty Niveau de difficulté (easy/medium/hard)
 * @returns Configuration IA complète et prête à utiliser
 */
export function createAIConfig(difficulty: AIDifficulty): AIConfig {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    
    return {
        enabled: true,
        difficulty: difficulty,
        reactionTime: settings.reactionTime,
        errorMargin: settings.errorMargin,
        lastUpdate: 0,                    // Pas encore de mise à jour
        targetY: 325,                     // Position centrale par défaut (milieu du canvas 650/2)
        currentY: 325,                    // Position actuelle (sera mise à jour)
        isMoving: false,                  // Pas en mouvement au début
        reactionStartTime: 0,             // Initialisé à 0 (aucun délai en cours)
        paddleSpeed: 20,                  // Même vitesse que les joueurs humains (state.paddleSpeed)
        
        // Simulation des touches clavier
        keyPressed: null,                 // Aucune touche pressée au début
        keyPressStartTime: 0,             // Pas de pression en cours
        keyHoldDuration: settings.keyHoldDuration,
        keyReleaseChance: settings.keyReleaseChance
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
 * @param state État actuel du jeu
 */
export function updateAITarget(state: GameState): void {
    if (!state.aiConfig) return;
    
    const now = Date.now();
    
    // Vérifier si c'est le moment de mettre à jour (1 fois par seconde max)
    if (now - state.aiConfig.lastUpdate < 1000) return;
    
    // Prédire où la balle va atterrir
    const predictedY = predictBallLanding(state);
    
    // Appliquer une erreur aléatoire (10% de chances de se tromper significativement)
    let targetY = predictedY;
    if (Math.random() < 0.1) {
        // Erreur importante : décalage aléatoire
        const errorOffset = (Math.random() - 0.5) * state.aiConfig.errorMargin * 2;
        targetY += errorOffset;
    }
    
    // S'assurer que la cible reste dans les limites du canvas
    const paddleHeight = state.paddles[0]?.height || state.paddleHeight;
    const minY = paddleHeight / 2; // Centre du paddle au minimum
    const maxY = state.canvasHeight - paddleHeight / 2; // Centre du paddle au maximum
    targetY = Math.max(minY, Math.min(maxY, targetY));
    
    // Mettre à jour la configuration IA
    state.aiConfig.targetY = targetY;
    state.aiConfig.lastUpdate = now;
    state.aiConfig.isMoving = Math.abs(targetY - state.aiConfig.currentY) > 5; // Seuil de mouvement
    
    // Log de debug pour visualiser les décisions de l'IA
}

/**
 * Simule les inputs clavier de l'IA (appelé chaque frame)
 * L'IA appelle movePaddle() exactement comme un joueur humain
 * @param state État actuel du jeu
 */
export function simulateKeyboardInput(state: GameState): void {
    if (!state.aiConfig || !state.aiConfig.enabled) return;
    const ai = state.aiConfig;
    const now = Date.now();

    // Mettre à jour la position actuelle basée sur le paddle réel
    if (state.paddles && state.paddles.length >= 1) {
        ai.currentY = state.paddles[0].y;
    }

    // Si le paddle doit bouger mais que le délai de réaction n'a pas commencé, on l'initialise
    if (ai.isMoving && ai.reactionStartTime === 0) {
        ai.reactionStartTime = now;
        return; // On attend le délai avant de bouger
    }
    
    // Si le délai de réaction n'est pas écoulé, on ne bouge pas
    if (ai.isMoving && now - ai.reactionStartTime < ai.reactionTime) {
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
    const threshold = 5; // Seuil de précision (pixels)

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
        
        // Vérifier si on doit relâcher prématurément (simulation d'erreur humaine)
        if (keyHeldDuration >= ai.keyHoldDuration && Math.random() < ai.keyReleaseChance) {
            ai.keyPressed = null;
            ai.keyPressStartTime = 0;
        } else {
            // Continuer à maintenir la touche
            movePaddle(state, 'A', requiredDirection);
        }
    } else {
        // Mauvaise direction : relâcher et changer
        ai.keyPressed = requiredDirection;
        ai.keyPressStartTime = now;
        movePaddle(state, 'A', requiredDirection);
    }
}