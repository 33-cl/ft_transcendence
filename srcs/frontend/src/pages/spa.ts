import { show, load , hideAllPages, hide } from './utils.js';
import { spectateFreind } from '../friends/friendList.html.js';
import { checkSessionOnce } from '../auth/auth.js'; // <- import moved function
import { cleanupGameState } from '../game/gameCleanup.js';
import { initSettingsHandlers } from './settings.js';
import { setStarsHoverColor } from '../utils/background.js';
import { initSessionBroadcast } from '../utils/sessionBroadcast.js'; // Import session broadcast
import { installFetchGuard } from '../utils/securityGuard.js'; // Import fetch guard
import { preventBackNavigationAfterLogout, setupPopStateHandler, initNavigationOnLoad, getPageFromURL, replaceHistoryState } from '../utils/navigation.js';
import '../config/config.js'; // Import to load AI Config handlers
import '../landing/landing.js'; // Import to load Landing handlers
import '../friends/friends.js'; // Import to load Friends handlers (AddFriends page)
// import { waitForSocketConnection } from './utils/socketLoading.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
        _roomJoinedHandlerSet?: boolean;
        // ... do not redeclare currentUser/logout here; defined in global.d.ts
    }
}

// Fonction pour récupérer les informations d'un utilisateur par son nom
async function fetchUserByUsername(username: string) {
    try {
        const response = await fetch(`/users`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        const users = data.users || [];
        
        // Rechercher l'utilisateur par nom
        const user = users.find((u: any) => u.username === username);
        
        // Si on ne trouve pas dans users, essayer le leaderboard
        if (!user) {
            const leaderboardResponse = await fetch('/users/leaderboard', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (leaderboardResponse.ok) {
                const leaderboardData = await leaderboardResponse.json();
                const leaderboard = leaderboardData.leaderboard || [];
                return leaderboard.find((u: any) => u.username === username);
            }
        }
        
        return user;
    } catch (error) {
        console.error('Error fetching user by username:', error);
        return null;
    }
}

// Fonction pour supprimer un ami
async function removeFriend(userId: number, _username: string) {
    try {
        const response = await fetch(`/users/${userId}/friend`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove friend');
        }

        
        // Recharger la liste d'amis
        const friendListContainer = document.getElementById('friendList');
        if (friendListContainer) {
            const { friendListHTML, initializeAddFriendsButton, initLoadingIcons } = await import('../components/index.html.js');
            friendListContainer.innerHTML = await friendListHTML();
            initializeAddFriendsButton(); // Initialiser le bouton Add Friends
            initLoadingIcons(); // Initialiser les icônes de chargement
        }

    } catch (error) {
        console.error('Error removing friend:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert('Error removing friend: ' + errorMessage);
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
            setStarsHoverColor(null);
            
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
        if (target.id === 'profileCard')
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
        if (target.id === 'soloAi')
            await load('aiConfig'); // Rediriger vers la page de configuration de l'IA avant de détecter le jeu
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
            } else if (lastGameType === 'multiplayer4p') {
                // Pour les jeux multiplayer 4 joueurs, aller au matchmaking
                await load('matchmaking');
                // Démarrer automatiquement la recherche d'un nouveau jeu
                try {
                    await window.joinOrCreateRoom(4);
                } catch (error) {
                    console.error('Error in joinOrCreateRoom(4):', error);
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
        if (target.id === 'profileBtn' || isProfileBtn) {
            // Récupérer les informations de l'utilisateur cliqué
            let selectedUser = null;
            if (currentElement && currentElement.dataset && currentElement.dataset.username) {
                // Utilisateur du leaderboard avec data-username
                const username = currentElement.dataset.username;
                selectedUser = await fetchUserByUsername(username);
            } else if (target.closest('.friend')) {
                // Utilisateur de la friend list - récupérer depuis le nom affiché
                const friendElement = target.closest('.friend');
                const nameElement = friendElement?.querySelector('.friend-name');
                if (nameElement) {
                    const username = nameElement.textContent?.trim();
                    if (username) {
                        selectedUser = await fetchUserByUsername(username);
                    }
                }
            }
            
            // Stocker l'utilisateur sélectionné globalement
            (window as any).selectedProfileUser = selectedUser;
            await load('profile');
        }
        if (target.id === 'logOutBtn') {
            // Use the global logout function which handles broadcast
            if (typeof window.logout === 'function') {
                await window.logout();
            } else {
                // Fallback if logout function not available
                try {
                    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
                } catch (e) {
                    console.error('Logout request failed:', e);
                }
                window.currentUser = null;
            }
            
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
            preventBackNavigationAfterLogout();
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
        if (target.id === 'multiplayer4pBtn') {
            // Sauvegarder le type de jeu pour restart
            (window as any).lastGameType = 'multiplayer4p';
            
            // Ensure any previous room is cleaned up first
            if (window.socket && (window as any).leaveCurrentRoomAsync) {
                try {
                    await (window as any).leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Pre-cleanup failed, proceeding anyway:', error);
                }
            }
            
            try {
                await window.joinOrCreateRoom(4);
            } catch (error) {
                console.error('Error in joinOrCreateRoom(4):', error);
                // Show error to user
                if (window.socket) {
                    window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
        }
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
            // Vérifier si l'élément profileBtn est dans le leaderboard
            const leaderboardContainer = document.getElementById('leaderboard');
            if (leaderboardContainer && leaderboardContainer.contains(currentElement)) {
                // Ne pas afficher le menu contextuel pour les éléments du leaderboard
                return;
            }
            
            // Stocker les informations de l'utilisateur sélectionné
            const username = currentElement?.getAttribute('data-username');
            const userId = currentElement?.getAttribute('data-user-id');
            const isInGame = currentElement?.getAttribute('data-is-in-game') === 'true';
            
            if (username && userId) {
                (window as any).selectedContextUser = { username, userId: parseInt(userId), isInGame };
            }

            // Régénérer le menu contextuel avec ou sans le bouton Spectate
            (window as any).contextMenuIsInGame = isInGame;
            show('contextMenu');
            
            // Positionner le menu contextuel
            const menu = document.getElementById('contextMenu');
            if (menu) {
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
    
        const target = e.target as HTMLElement;
        
        // Gérer les clics sur les boutons du menu contextuel
        if (menu.contains(target)) {
            if (target.id === 'removeFriendBtn') {
                // Gérer la suppression d'ami
                const selectedUser = (window as any).selectedContextUser;
                if (selectedUser && selectedUser.userId) {
                    removeFriend(selectedUser.userId, selectedUser.username);
                }
                hide('contextMenu');
                return;
            }
            if (target.id === 'spectateBtn') {
                // Gérer le spectate
                const selectedUser = (window as any).selectedContextUser;
                if (selectedUser && selectedUser.username) {
                    spectateFreind(selectedUser.username);
                }
                hide('contextMenu');
                return;
            }
            // Les autres boutons peuvent être gérés ici
            return;
        }
    
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


// Setup popstate handler for browser back/forward buttons
setupPopStateHandler();

// // top level statemetn ( s'execute des que le fichier est importe)
// // --> manipuler le dom quúne fois qu'il est pret
initNavigationOnLoad(async () => {
    // 🛡️ SECURITY: Install fetch guard FIRST to intercept all requests
    installFetchGuard();
    
    // 🚨 CRITICAL: Initialize session broadcast BEFORE anything else and WAIT
    await initSessionBroadcast();
    
    await checkSessionOnce();
    
    // Déterminer la page à charger : soit depuis l'URL, soit page par défaut selon authentification
    let targetPage = getPageFromURL();
    
    const isFirstVisit = !sessionStorage.getItem('hasVisited') && 
                         (targetPage === 'signIn' || targetPage === '') && 
                         !window.currentUser;
    
    if (isFirstVisit) {
        // Marquer que l'utilisateur a visité
        sessionStorage.setItem('hasVisited', 'true');
        // Afficher la landing page
        replaceHistoryState('landing');
        await load('landing', undefined, false);
        initializeComponents();
        setupRoomJoinedHandler();
        return;
    }
    
    if (!window.currentUser || !window.currentUser.username) {
        // Non connecté : forcer signIn ou signUp
        if (targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'landing') {
            targetPage = 'signIn';
        }
        // Empêcher l'accès à landing après la première visite
        if (targetPage === 'landing') {
            targetPage = 'signIn';
        }
    } else {
        // Connecté : empêcher l'accès aux pages d'authentification et landing
        if (targetPage === 'signIn' || targetPage === 'signUp' || targetPage === 'landing') {
            targetPage = 'mainMenu';
        }
        
        const gamePages = ['game', 'game4', 'matchmaking', 'gameFinished', 'spectatorGameFinished'];
        if (gamePages.includes(targetPage)) {
            targetPage = 'mainMenu';
        }
    }
    
    // Remplacer l'état initial dans l'historique au lieu de le pusher
    replaceHistoryState(targetPage);
    load(targetPage, undefined, false); // Ne pas pusher l'historique car on vient de le remplacer
    initializeComponents();
    setupRoomJoinedHandler();
});

export { show, hideAllPages, hide };