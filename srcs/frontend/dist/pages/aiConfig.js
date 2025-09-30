// import { load } from './utils.js'; // Non utilisé maintenant que goToMain gère la navigation
import { setStarsHoverColor, getColorRgb } from '../utils/background.js';
// Variables globales pour la configuration de l'IA (plus nécessaire car on lance directement)
// Fonction pour initialiser les gestionnaires d'événements de la page aiConfig
export function initAIConfigManagers() {
    // Sélecteurs de mode de jeu
    const vsAiBtn = document.getElementById('vs-ai');
    const vsPlayerBtn = document.getElementById('vs-player');
    // Sections
    const gameModeSection = document.querySelector('.game-mode-section');
    const difficultySection = document.getElementById('difficulty-section');
    const mainActions = document.getElementById('main-actions');
    // Sélecteurs de difficulté
    const easyBtn = document.getElementById('ai-easy');
    const mediumBtn = document.getElementById('ai-medium');
    const hardBtn = document.getElementById('ai-hard');
    // Gestion des modes de jeu
    if (vsAiBtn) {
        vsAiBtn.addEventListener('click', () => {
            // Cacher les options de mode de jeu et afficher les options de difficulté
            gameModeSection.style.display = 'none';
            if (difficultySection)
                difficultySection.style.display = 'block';
            if (mainActions)
                mainActions.style.display = 'none';
        });
    }
    if (vsPlayerBtn) {
        vsPlayerBtn.addEventListener('click', async () => {
            // Désactiver le mode IA
            window.aiMode = false;
            window.lastGameType = 'local2P';
            try {
                // Rejoindre une room en mode local
                await window.joinOrCreateRoom(2, true);
            }
            catch (error) {
                console.error('Erreur lors du démarrage du jeu local:', error);
                alert('Erreur lors du démarrage du jeu. Veuillez réessayer.');
            }
        });
    }
    // Fonction pour lancer un jeu IA avec une difficulté donnée
    async function startAIGame(difficulty) {
        // Activer le mode IA et s'assurer que la difficulté est bien définie
        window.aiMode = true;
        window.aiDifficulty = difficulty;
        window.lastGameType = 'soloAI'; // Sauvegarder le type de jeu pour restart
        // Sauvegarder aussi dans localStorage pour cohérence
        localStorage.setItem('aiDifficulty', difficulty);
        // Log de debug pour vérifier la transmission
        console.log(`🎮 Variables IA définies:`, {
            aiMode: window.aiMode,
            aiDifficulty: window.aiDifficulty,
            selectedDifficulty: difficulty
        });
        try {
            // Rejoindre une room en mode local avec IA
            await window.joinOrCreateRoom(2, true);
            // La navigation vers la page de jeu sera gérée par le handler roomJoined
        }
        catch (error) {
            console.error('Erreur lors du démarrage du jeu IA:', error);
            alert('Erreur lors du démarrage du jeu. Veuillez réessayer.');
        }
    }
    // Event listeners pour les boutons de difficulté - lancent directement le jeu
    if (easyBtn) {
        easyBtn.addEventListener('click', () => startAIGame('easy'));
        easyBtn.addEventListener('mouseenter', () => {
            setStarsHoverColor(getColorRgb('easy'));
        });
        easyBtn.addEventListener('mouseleave', () => {
            setStarsHoverColor(null);
        });
    }
    if (mediumBtn) {
        mediumBtn.addEventListener('click', () => startAIGame('medium'));
        mediumBtn.addEventListener('mouseenter', () => {
            setStarsHoverColor(getColorRgb('medium'));
        });
        mediumBtn.addEventListener('mouseleave', () => {
            setStarsHoverColor(null);
        });
    }
    if (hardBtn) {
        hardBtn.addEventListener('click', () => startAIGame('hard'));
        hardBtn.addEventListener('mouseenter', () => {
            setStarsHoverColor(getColorRgb('hard'));
        });
        hardBtn.addEventListener('mouseleave', () => {
            setStarsHoverColor(null);
        });
    }
}
// Rendre la fonction accessible globalement
window.initAIConfigManagers = initAIConfigManagers;
//# sourceMappingURL=aiConfig.js.map