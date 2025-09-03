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

