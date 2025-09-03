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
        isMoving: false                   // Pas en mouvement au début
    };
}
