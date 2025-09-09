import { show, load , hideAllPages, hide } from './utils.js';
import { checkSessionOnce } from './auth.js'; // <- import moved function
import { cleanupGameState } from '../game/gameCleanup.js';
import { initSettingsHandlers } from './settings.js';
// import { waitForSocketConnection } from './utils/socketLoading.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
        _roomJoinedHandlerSet?: boolean;
        // ... do not redeclare currentUser/logout here; defined in global.d.ts
    }
}


function initializeComponents(): void
{
    // Initialize settings handlers
    initSettingsHandlers();
    
    // Password masking removed - using simple validation on submit instead
    
    // Affiche la page d'accueil au chargement
    // show('signIn');

    // Vérifier si l'event listener click est déjà configuré pour éviter les doublons
    if ((window as any)._navigationListenerSet) {
        return;
    }
    (window as any)._navigationListenerSet = true;
    
    // Global click debounce to prevent double-clicks
    let lastClickTime = 0;
    const CLICK_DEBOUNCE_MS = 300; // 300ms debounce
    
    // Ajoute la navigation SPA pour le clic gauche
    document.addEventListener('click', async (e) => {
        const now = Date.now();
        if (now - lastClickTime < CLICK_DEBOUNCE_MS) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        lastClickTime = now;
        
        const target = e.target as HTMLElement;
        if (!target) return;
        
        // Vérifier si l'élément cliqué ou l'un de ses parents a l'ID profileBtn
        let currentElement: HTMLElement | null = target;
        let isProfileBtn = false;
        let isSettingsBtn = false;
        
        while (currentElement && !isProfileBtn && !isSettingsBtn) {
            if (currentElement.id === 'profileBtn') {
                isProfileBtn = true;
            }
            else if (currentElement.id === 'settingsBtn') {
                isSettingsBtn = true;
            } 
            else {
                currentElement = currentElement.parentElement;
            }
        }
        
        // NAVIGATION PRINCIPALE - avec nettoyage spécial pour retour au menu principal
        if (target.id === 'mainMenuBtn' || target.id === 'bacVk2main' || target.id === 'goToMain') {
            // Nettoyage complet avant de retourner au menu principal
            // Cela résout le bug des paddles qui ne s'affichent plus au 2ème jeu local
            cleanupGameState();
            
            // Wait for proper room cleanup before proceeding
            if (window.socket && (window as any).leaveCurrentRoomAsync) {
                try {
                    await (window as any).leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Room cleanup failed, proceeding anyway:', error);
                }
            } else if (window.socket) {
                window.socket.emit('leaveAllRooms');
                // Add a small delay to allow cleanup to process
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            await load('mainMenu');
        }
        if (target.id === 'goToProfile')
            await load('profile');
        if (target.id === 'settingsBtn' || isSettingsBtn)
        {
            await load('settings');
        }
        if (target.id === 'local2p')
        {
            // Pour les jeux locaux, on laisse le handler roomJoined gérer l'affichage
            // Cela évite un double chargement qui cause le bug des paddles
            (window as any).lastGameType = 'local2p'; // Sauvegarder le type de jeu pour restart
            await window.joinOrCreateRoom(2, true);
            // Ne pas appeler load('game') ici ! Le handler roomJoined s'en occupe
        }
        if (target.id === 'local4p')
        {
            // Même principe pour le jeu 4 joueurs
            (window as any).lastGameType = 'local4p'; // Sauvegarder le type de jeu pour restart
            await window.joinOrCreateRoom(4, true);
            // Ne pas appeler load('game4') ici !
        }
        if (target.id === 'soloAI')
        {
            // Mode Solo contre IA : création d'une partie locale 1v1 avec IA activée
            (window as any).lastGameType = 'soloAI'; // Sauvegarder le type de jeu pour restart
            (window as any).aiMode = true; // Flag pour indiquer que l'IA doit être activée
            await window.joinOrCreateRoom(2, true);
            // L'IA sera activée côté game après le roomJoined
        }
        if (target.id === 'localGameBtn')
        {
            // Relancer le même type de jeu qui vient de se terminer
            const lastGameType = (window as any).lastGameType;
            if (lastGameType === 'soloAI') {
                // Relancer un jeu vs IA
                (window as any).aiMode = true;
                await window.joinOrCreateRoom(2, true);
            } else if (lastGameType === 'local4p') {
                // Relancer un jeu local 4 joueurs
                await window.joinOrCreateRoom(4, true);
            } else if (lastGameType === 'ranked1v1') {
                // Pour les jeux multiplayer, aller au matchmaking au lieu de restart direct
                await load('matchmaking');
                // Démarrer automatiquement la recherche d'un nouveau jeu
                try {
                    await window.joinOrCreateRoom(2);
                } catch (error) {
                    console.error('Error in joinOrCreateRoom(2):', error);
                    if (window.socket) {
                        window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                    }
                }
            } else {
                // Par défaut, relancer un jeu local 2 joueurs
                await window.joinOrCreateRoom(2, true);
            }
        }
        if (target.id === 'signInBtn')
            await load('signIn');
        if (target.id === 'signUpBtn')        
            await load('signUp');
        if (target.id === 'profileBtn' || isProfileBtn)
            await load('profile');
        if (target.id === 'logOutBtn') {
            // Appeler le logout côté serveur
            try {
                await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
            } catch (e) {
                console.error('Logout request failed:', e);
            }
            
            // Vider le cache et réinitialiser l'état de l'application
            window.currentUser = null;

            // Vider le cache du navigateur pour cette application
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                } catch (e) {
                    console.warn('Failed to clear cache:', e);
                }
            }

            // Vider le localStorage et sessionStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // When logout, prevent back navigation to protected pages
            window.history.replaceState(null, '', '/signin');
            window.history.pushState(null, '', '/signin');
            window.addEventListener('popstate', function preventBack() {
                if (!window.currentUser) {
                    // Forcer le retour à signin
                    window.history.pushState(null, '', '/signin');
                    load('signIn');
                }
            });
            await load('signIn');
        }

        // MULTIPLAYER
        if (target.id === 'ranked1v1Btn') {
            // Sauvegarder le type de jeu pour restart
            (window as any).lastGameType = 'ranked1v1';
            
            // Ensure any previous room is cleaned up first
            if (window.socket && (window as any).leaveCurrentRoomAsync) {
                try {
                    await (window as any).leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Pre-cleanup failed, proceeding anyway:', error);
                }
            }
            
            try {
                await window.joinOrCreateRoom(2);
            } catch (error) {
                console.error('Error in joinOrCreateRoom(2):', error);
                // Show error to user
                if (window.socket) {
                    window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
        }
        if (target.id === 'customCreateBtn')
            await window.joinOrCreateRoom(4);
        if (target.id === 'customJoinBtn')
            await window.joinOrCreateRoom(4);
        if (target.id === 'cancelSearchBtn')
        {
            if (window.socket && (window as any).leaveCurrentRoomAsync) {
                try {
                    await (window as any).leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Room cleanup failed, proceeding anyway:', error);
                }
            } else if (window.socket) {
                window.socket.emit('leaveAllRooms');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            await load('mainMenu');
        }

        // TEST
        if (target.id === 'tournamentJoinBtn')
        {
            await load('matchmaking');
        }
    });
    
    // Ajoute un gestionnaire pour le clic droit (contextmenu)
    document.addEventListener('contextmenu', (e) => {
        // Empêcher le menu contextuel par défaut du navigateur
        e.preventDefault();
        
        const target = e.target as HTMLElement;
        if (!target) return;
        
        // Vérifier si l'élément cliqué ou l'un de ses parents a l'ID profileBtn
        let currentElement: HTMLElement | null = target;
        let isProfileBtn = false;
        
        while (currentElement && !isProfileBtn) {
            if (currentElement.id === 'profileBtn') {
                isProfileBtn = true;
            } else {
                currentElement = currentElement.parentElement;
            }
        }
        
        // Exemple: action spécifique pour le clic droit sur un profil
        if (isProfileBtn) {

            const menu = document.getElementById('contextMenu');
            if (menu)
            {
                show('contextMenu');

                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
            }

        }
    });
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('contextMenu');
        if (!menu) return;
    
        // Si le menu n'est pas affiché, rien à faire
        if (!menu.innerHTML.trim()) return;
    
        // Si le clic est à l'intérieur du menu, ne rien faire
        if (menu.contains(e.target as Node)) return;
    
        // Sinon, masquer le menu contextuel
        hide('contextMenu');
    });
}

// Handler global pour l'event roomJoined (affichage matchmaking/game)
// REMOVED: Navigation is now handled directly in websocket.ts to avoid duplicate handlers
function setupRoomJoinedHandler()
{
    if (!window.socket)
        return;
    if (window._roomJoinedHandlerSet)
        return;
    window._roomJoinedHandlerSet = true;
    window.socket.on('roomJoined', async (data: any) =>
    {
        // Si mode local, on affiche directement la page de jeu
        if (window.isLocalGame) {
            if (data.maxPlayers === 4) {
                await load('game4');
            } else {
                await load('game');
            }
            return;
        }
        // Toujours afficher l'écran d'attente tant que la room n'est pas pleine
        if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
        {
            if (data.players < data.maxPlayers)
                await load('matchmaking');
            else
            {
                if (data.maxPlayers === 4) {
                    await load('game4');
                } else {
                    await load('game');
                }
            }
        }
    });
}


window.addEventListener('popstate', async function(event) {
    let targetPage = event.state?.page || 'signIn';
    
    // Protection: si connecté et tentative d'accès aux pages d'auth → rediriger
    if (window.currentUser && (targetPage === 'signIn' || targetPage === 'signUp')) {
        targetPage = 'mainMenu';
    }
    
    await load(targetPage, false);
});

// // top level statemetn ( s'execute des que le fichier est importe)
// // --> manipuler le dom quúne fois qu'il est pret
if (document.readyState === 'loading')
{
    document.addEventListener('DOMContentLoaded', async () =>
    {
        await checkSessionOnce();
        if (!window.currentUser || !window.currentUser.username)
            load('signIn');
        else
            load('mainMenu');
        initializeComponents();
        setupRoomJoinedHandler();
    });
}
else
{
    (async () => {
        await checkSessionOnce();
        if (!window.currentUser || !window.currentUser.username)
            load('signIn');
        else
            load('mainMenu');
        initializeComponents();
        setupRoomJoinedHandler();
    })();
}

export { show, hideAllPages, hide };