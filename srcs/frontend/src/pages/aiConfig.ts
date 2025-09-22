import { load } from './utils.js';

// Variables globales pour la configuration de l'IA
let selectedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';

// Fonction pour initialiser les gestionnaires d'événements de la page aiConfig
export function initAIConfigManagers(): void {
    // Sélecteurs de difficulté
    const easyBtn = document.getElementById('ai-easy');
    const mediumBtn = document.getElementById('ai-medium');
    const hardBtn = document.getElementById('ai-hard');
    
    // Boutons d'action
    const startBtn = document.getElementById('startAIGame');
    const backBtn = document.getElementById('backToMainMenu');
    
    // Gestion de la sélection de difficulté
    function selectDifficulty(difficulty: 'easy' | 'medium' | 'hard', button: HTMLElement) {
        // Supprimer la classe 'selected' de tous les boutons
        [easyBtn, mediumBtn, hardBtn].forEach(btn => {
            if (btn) btn.classList.remove('selected');
        });
        
        // Ajouter la classe 'selected' au bouton choisi
        button.classList.add('selected');
        selectedDifficulty = difficulty;
        
        console.log(`Difficulté sélectionnée: ${difficulty}`);
    }
    
    // Event listeners pour les boutons de difficulté
    if (easyBtn) {
        easyBtn.addEventListener('click', () => selectDifficulty('easy', easyBtn));
    }
    
    if (mediumBtn) {
        mediumBtn.addEventListener('click', () => selectDifficulty('medium', mediumBtn));
    }
    
    if (hardBtn) {
        hardBtn.addEventListener('click', () => selectDifficulty('hard', hardBtn));
    }
    
    // Event listener pour démarrer le jeu IA
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            console.log(`Démarrage du jeu IA avec difficulté: ${selectedDifficulty}`);
            
            // Activer le mode IA
            (window as any).aiMode = true;
            (window as any).aiDifficulty = selectedDifficulty;
            (window as any).lastGameType = 'soloAI'; // Sauvegarder le type de jeu pour restart
            
            try {
                // Rejoindre une room en mode local avec IA
                await (window as any).joinOrCreateRoom(2, true);
                // La navigation vers la page de jeu sera gérée par le handler roomJoined
            } catch (error) {
                console.error('Erreur lors du démarrage du jeu IA:', error);
                alert('Erreur lors du démarrage du jeu. Veuillez réessayer.');
            }
        });
    }
    
    // Event listener pour retourner au menu principal
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            await load('mainMenu');
        });
    }
}

// Exporter la fonction pour qu'elle soit accessible globalement
declare global {
    interface Window {
        initAIConfigManagers: () => void;
    }
}

// Rendre la fonction accessible globalement
(window as any).initAIConfigManagers = initAIConfigManagers;
