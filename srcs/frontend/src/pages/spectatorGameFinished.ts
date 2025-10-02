// spectatorGameFinished.ts

import { spectatorGameFinishedHTML } from '../components/spectatorGameFinished.html.js';

export async function spectatorGameFinishedPage(data?: any): Promise<void> {
    console.log('🔥 spectatorGameFinishedPage called with:', data);
    
    // Set page content
    const appDiv = document.getElementById('app');
    if (appDiv) {
        appDiv.innerHTML = spectatorGameFinishedHTML(data);
    }
    
    // Setup event listeners
    setupSpectatorGameFinishedEventListeners();
}

function setupSpectatorGameFinishedEventListeners(): void {
    console.log('🔥 Setting up spectator game finished event listeners');
    
    // Main Menu button
    const mainMenuBtn = document.getElementById('spectator-main-menu-btn') as HTMLButtonElement;
    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', async () => {
            console.log('🔥 Spectator main menu clicked');
             // Clean up any game-related state
            if ((window as any).leaveCurrentRoomAsync) {
                await (window as any).leaveCurrentRoomAsync();
            }
            
            // Refresh friend list to update game statuses
            if ((window as any).refreshFriendList) {
                await (window as any).refreshFriendList();
            }

            // Navigate to main menu
            const { load } = await import('./utils.js');
            await load('mainMenu');
        });
    }
}

// Make the page available globally
(window as any).spectatorGameFinishedPage = spectatorGameFinishedPage;
