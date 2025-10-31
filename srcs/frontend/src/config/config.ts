import { setStarsHoverColor, getColorRgb } from '../utils/background.js';

/**
 * Initialize event handlers for the AI config page
 */
export function initAIConfigManagers(): void {
    // Game mode selectors
    const vsAiBtn = document.getElementById('vs-ai');
    const vsPlayerBtn = document.getElementById('vs-player');
    
    // Sections
    const gameModeSection = document.querySelector('.game-mode-section') as HTMLElement;
    const difficultySection = document.getElementById('difficulty-section');
    const mainActions = document.getElementById('main-actions');
    
    // Difficulty selectors
    const easyBtn = document.getElementById('ai-easy');
    const mediumBtn = document.getElementById('ai-medium');
    const hardBtn = document.getElementById('ai-hard');
    
    // Game mode handlers
    if (vsAiBtn) {
        vsAiBtn.addEventListener('click', () => {
            // Hide game mode options and show difficulty options
            gameModeSection.classList.add('hidden');
            if (difficultySection) difficultySection.classList.remove('hidden');
            if (mainActions) mainActions.classList.add('hidden');
        });
    }
    
    if (vsPlayerBtn) {
        vsPlayerBtn.addEventListener('click', async () => {
            // Disable AI mode
            (window as any).aiMode = false;
            (window as any).lastGameType = 'local2P';
            
            try {
                // Join room in local mode
                await (window as any).joinOrCreateRoom(2, true);
            } catch (error) {
                console.error('Error starting local game:', error);
                alert('Error starting game. Please try again.');
            }
        });
    }
    
    /**
     * Start an AI game with given difficulty
     */
    async function startAIGame(difficulty: 'easy' | 'medium' | 'hard') {
        // Enable AI mode and set difficulty
        (window as any).aiMode = true;
        (window as any).aiDifficulty = difficulty;
        (window as any).lastGameType = 'soloAI';
        
        // Save in localStorage for consistency
        localStorage.setItem('aiDifficulty', difficulty);
        
        try {
            // Join room in local mode with AI
            await (window as any).joinOrCreateRoom(2, true);
            // Navigation to game page will be handled by roomJoined handler
        } catch (error) {
            console.error('Error starting AI game:', error);
            alert('Error starting game. Please try again.');
        }
    }
    
    // Event listeners for difficulty buttons - start game directly
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

// Export function to be globally accessible
declare global {
    interface Window {
        initAIConfigManagers: () => void;
    }
}

// Make function globally accessible
(window as any).initAIConfigManagers = initAIConfigManagers;
