import { setStarsHoverColor, getColorRgb } from '../background/background.js';
import { load } from '../navigation/utils.js';

/**
 * Initialize event handlers for the Game Config page (mode selection)
 */
export function initGameConfigManagers(): void {
    // Game mode selectors
    const vsAiBtn = document.getElementById('vs-ai');
    const vsPlayerBtn = document.getElementById('vs-player');
    
    // VS AI handler - navigate to AI difficulty page
    if (vsAiBtn && !(vsAiBtn as any)._listenerSet) {
        (vsAiBtn as any)._listenerSet = true;
        vsAiBtn.addEventListener('click', () => {
            load('aiConfig');
        });
    }
    
    // VS Player handler - start local 2 player game directly
    if (vsPlayerBtn && !(vsPlayerBtn as any)._listenerSet) {
        (vsPlayerBtn as any)._listenerSet = true;
        vsPlayerBtn.addEventListener('click', async () => {
            // Disable AI mode
            window.aiMode = false;
            window.lastGameType = 'local2p';
            
            try {
                // Join room in local mode
                await window.joinOrCreateRoom(2, true);
            } catch (error) {
                console.error('Error starting local game:', error);
                alert('Error starting game. Please try again.');
            }
        });
    }
}

/**
 * Initialize event handlers for the AI Config page (difficulty selection)
 */
export function initAIConfigManagers(): void {
    // Difficulty selectors
    const easyBtn = document.getElementById('ai-easy');
    const mediumBtn = document.getElementById('ai-medium');
    const hardBtn = document.getElementById('ai-hard');
    
    /**
     * Start an AI game with given difficulty
     */
    async function startAIGame(difficulty: 'easy' | 'medium' | 'hard') {
        // Enable AI mode and set difficulty
        window.aiMode = true;
        window.aiDifficulty = difficulty;
        window.lastGameType = 'soloAI';
        
        try {
            // Join room in local mode with AI
            await window.joinOrCreateRoom(2, true);
            // Navigation to game page will be handled by roomJoined handler
        } catch (error) {
            console.error('Error starting AI game:', error);
            alert('Error starting game. Please try again.');
        }
    }
    
    // Event listeners for difficulty buttons - start game directly
    if (easyBtn && !(easyBtn as any)._listenerSet) {
        (easyBtn as any)._listenerSet = true;
        easyBtn.addEventListener('click', () => startAIGame('easy'));
        
        easyBtn.addEventListener('mouseenter', () => {
            setStarsHoverColor(getColorRgb('easy'));
        });
        easyBtn.addEventListener('mouseleave', () => {
            setStarsHoverColor(null);
        });
    }
    
    if (mediumBtn && !(mediumBtn as any)._listenerSet) {
        (mediumBtn as any)._listenerSet = true;
        mediumBtn.addEventListener('click', () => startAIGame('medium'));
        
        mediumBtn.addEventListener('mouseenter', () => {
            setStarsHoverColor(getColorRgb('medium'));
        });
        mediumBtn.addEventListener('mouseleave', () => {
            setStarsHoverColor(null);
        });
    }
    
    if (hardBtn && !(hardBtn as any)._listenerSet) {
        (hardBtn as any)._listenerSet = true;
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
        initGameConfigManagers: () => void;
        initAIConfigManagers: () => void;
    }
}

// Make functions globally accessible
window.initGameConfigManagers = initGameConfigManagers;
window.initAIConfigManagers = initAIConfigManagers;
