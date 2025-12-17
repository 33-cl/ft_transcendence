import { setStarsHoverColor, getColorRgb } from '../background/background.js';
import { load } from '../navigation/utils.js';

// This function acts as the controller for the initial game mode selection screen
export function initGameConfigManagers(): void
{
    const vsAiBtn = document.getElementById('vs-ai');
    const vsPlayerBtn = document.getElementById('vs-player');

    // If the user selects the Single Player (VS AI) option, we route them to the difficulty selection view
    if (vsAiBtn && !(vsAiBtn as any)._listenerSet)
    {
        (vsAiBtn as any)._listenerSet = true;
        vsAiBtn.addEventListener('click', () =>
        {
            load('aiConfig');
        });
    }

    // If the user selects Local Multiplayer, we bypass difficulty settings and immediately initialize a local lobby
    if (vsPlayerBtn && !(vsPlayerBtn as any)._listenerSet)
    {
        (vsPlayerBtn as any)._listenerSet = true;
        vsPlayerBtn.addEventListener('click', async () =>
        {
            window.aiMode = false;
            window.lastGameType = 'local2p';

            try
            {
                // We attempt to create a room specifically configured for 2 local players
                await window.joinOrCreateRoom(2, true);
            }
            catch (error)
            {
                alert('Error starting game. Please try again.');
            }
        });
    }
}

// This function manages the user interactions on the AI difficulty selection screen
export function initAIConfigManagers(): void
{
    const easyBtn = document.getElementById('ai-easy');
    const mediumBtn = document.getElementById('ai-medium');
    const hardBtn = document.getElementById('ai-hard');

    // This helper encapsulates the logic required to configure and launch a solo game against the AI
    async function startAIGame(difficulty: 'easy' | 'medium' | 'hard')
    {
        window.aiMode = true;
        window.aiDifficulty = difficulty;
        window.lastGameType = 'soloAI';

        try
        {
            // We initialize the room in local mode, but the game loop will recognize the AI flag enabled above
            await window.joinOrCreateRoom(2, true);
        }
        catch (error)
        {
            alert('Error starting game. Please try again.');
        }
    }

    // We attach listeners to the Easy button to handle game start and visual hover feedback
    if (easyBtn && !(easyBtn as any)._listenerSet)
    {
        (easyBtn as any)._listenerSet = true;
        easyBtn.addEventListener('click', () => startAIGame('easy'));

        easyBtn.addEventListener('mouseenter', () =>
        {
            setStarsHoverColor(getColorRgb('easy'));
        });
        easyBtn.addEventListener('mouseleave', () =>
        {
            setStarsHoverColor(null);
        });
    }

    // Similar setup for the Medium difficulty button, applying its specific color theme (Orange)
    if (mediumBtn && !(mediumBtn as any)._listenerSet)
    {
        (mediumBtn as any)._listenerSet = true;
        mediumBtn.addEventListener('click', () => startAIGame('medium'));

        mediumBtn.addEventListener('mouseenter', () =>
        {
            setStarsHoverColor(getColorRgb('medium'));
        });
        mediumBtn.addEventListener('mouseleave', () =>
        {
            setStarsHoverColor(null);
        });
    }

    // Setup for the Hard difficulty button, applying the intense color theme (Red)
    if (hardBtn && !(hardBtn as any)._listenerSet)
    {
        (hardBtn as any)._listenerSet = true;
        hardBtn.addEventListener('click', () => startAIGame('hard'));

        hardBtn.addEventListener('mouseenter', () =>
        {
            setStarsHoverColor(getColorRgb('hard'));
        });
        hardBtn.addEventListener('mouseleave', () =>
        {
            setStarsHoverColor(null);
        });
    }
}

declare global
{
    interface Window
    {
        initGameConfigManagers: () => void;
        initAIConfigManagers: () => void;
    }
}

// We expose these functions globally so they can be triggered by the navigation router when loading views
window.initGameConfigManagers = initGameConfigManagers;
window.initAIConfigManagers = initAIConfigManagers;