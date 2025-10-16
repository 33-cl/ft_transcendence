// ai.ts - Intelligence Artificielle pour le mode 1 joueur
// Contrôle le paddle gauche (côté A) avec un comportement réaliste et équilibré

import { GameState, AIDifficulty, AIConfig } from './gameState.js';

/**
 * Configuration des niveaux de difficulté de l'IA
 * Détermine le comportement et la performance de l'IA selon le niveau choisi
 */
const DIFFICULTY_SETTINGS = {
    easy: {
        reactionTime: 700,    // Réaction lente (700ms)
        errorMargin: 15,      // Beaucoup d'erreurs (±15 pixels)
        moveSpeed: 0.05       // Mouvement lent
    },
    medium: {
        reactionTime: 500,    // Réaction moyenne (500ms)
        errorMargin: 10,      // Erreurs modérées (±10 pixels)
        moveSpeed: 0.08       // Mouvement normal
    },
    hard: {
        reactionTime: 300,    // Réaction rapide (300ms)
        errorMargin: 5,       // Peu d'erreurs (±5 pixels)
        moveSpeed: 0.12       // Mouvement rapide
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
        paddleSpeed: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12 // Valeurs par défaut selon la difficulté
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
 * Déplace le paddle IA de manière fluide vers sa cible (appelé chaque frame)
 * Utilise une interpolation linéaire (lerp) pour des mouvements naturels
 * @param state État actuel du jeu
 */
export function movePaddleWithLerp(state: GameState): void {
    if (!state.aiConfig || !state.aiConfig.enabled) return;
    const ai = state.aiConfig;
    const now = Date.now();

    // Si le paddle doit bouger mais que le délai de réaction n'a pas commencé, on l'initialise
    if (ai.isMoving && ai.reactionStartTime === 0) {
        ai.reactionStartTime = now;
        return; // On attend le délai avant de bouger
    }
    // Si le délai de réaction n'est pas écoulé, on ne bouge pas
    if (ai.isMoving && now - ai.reactionStartTime < ai.reactionTime) {
        const reste = ai.reactionTime - (now - ai.reactionStartTime);
        return;
    }
    // Si on n'est pas censé bouger, on reset le délai
    if (!ai.isMoving) {
        ai.reactionStartTime = 0;
    }

    const settings = DIFFICULTY_SETTINGS[ai.difficulty];
    const difference = ai.targetY - ai.currentY;
    ai.currentY += difference * settings.moveSpeed;
    
    if (state.paddles && state.paddles.length >= 1) {
        const paddleLeft = state.paddles[0];
        
        // Appliquer les limites du canvas pour empêcher le paddle de sortir
        const minY = 0;
        const maxY = state.canvasHeight - paddleLeft.height;
        ai.currentY = Math.max(minY, Math.min(maxY, ai.currentY));
        
        paddleLeft.y = ai.currentY;
        ai.currentY = paddleLeft.y;
    }
}