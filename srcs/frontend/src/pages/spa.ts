import { show, load , hideAllPages, hide } from '../navigation/utils.js';
import { spectateFreind } from '../friends/friendList.html.js';
import { checkSessionOnce } from '../auth/auth.js'; // <- import moved function
import { cleanupGameState } from '../game/gameCleanup.js';
import { initSettingsHandlers } from '../settings/settings.js';
import { setStarsHoverColor } from '../background/background.js';
import { initSessionBroadcast } from '../navigation/sessionBroadcast.js'; // Import session broadcast
import { installAllSecurityGuards } from '../navigation/securityGuard.js'; // Import all security guards
import { preventBackNavigationAfterLogout, setupPopStateHandler, initNavigationOnLoad, getPageFromURL, replaceHistoryState } from '../navigation/navigation.js';
import '../config/config.js'; // Import to load AI Config handlers
import '../landing/landing.js'; // Import to load Landing handlers
import '../friends/friends.js'; // Import to load Friends handlers (AddFriends page)
// import { waitForSocketConnection } from '../game/socketLoading.js';

// Global interface is defined in global.d.ts

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
    if (window._navigationListenerSet) {
        return;
    }
    window._navigationListenerSet = true;
    
    // Global click debounce to prevent double-clicks
    let lastClickTime = 0;
    const CLICK_DEBOUNCE_MS = 300; // 300ms debounce
    
    // Vérifier si les listeners SPA ne sont pas déjà ajoutés
    if (!(document as any)._spaClickListenerSet) {
        (document as any)._spaClickListenerSet = true;
        
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
            
            // Nettoyage des variables de tournoi
            window.currentTournamentId = null;
            window.currentMatchId = null;
            
            // Wait for proper room cleanup before proceeding
            if (window.socket && window.leaveCurrentRoomAsync) {
                try {
                    await window.leaveCurrentRoomAsync();
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
        // Handler pour retour au tournoi après un match
        if (target.id === 'backToTournamentBtn') {
            const tournamentId = window.currentTournamentId;
            // Nettoyage des variables de tournoi match
            window.currentMatchId = null;
            
            // Cleanup game state
            cleanupGameState();
            
            if (tournamentId) {
                await load(`tournaments/${tournamentId}`);
            } else {
                // Fallback si pas de tournamentId
                await load('tournaments');
            }
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
            window.lastGameType = 'local2p'; // Sauvegarder le type de jeu pour restart
            await window.joinOrCreateRoom(2, true);
            // Ne pas appeler load('game') ici ! Le handler roomJoined s'en occupe
        }
        if (target.id === 'local4p')
        {
            // Même principe pour le jeu 4 joueurs
            window.lastGameType = 'local4p'; // Sauvegarder le type de jeu pour restart
            await window.joinOrCreateRoom(4, true);
            // Ne pas appeler load('game4') ici !
        }
        if (target.id === 'soloAi')
            await load('gameConfig'); // Rediriger vers la page de configuration du jeu (choix mode)
        if (target.id === 'localGameBtn')
        {
            // Relancer le même type de jeu qui vient de se terminer
            const lastGameType = window.lastGameType;
            if (lastGameType === 'soloAI') {
                // Relancer un jeu vs IA
                window.aiMode = true;
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
            // Si le clic vient du context menu, ignorer (sera géré par le listener du context menu)
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu && contextMenu.contains(target)) {
                return;
            }
            
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
            window.selectedProfileUser = selectedUser;
            await load('profile');
        }
        
        // Gestionnaire de clic sur les matchs dans le profil
        if (target.classList.contains('match-item') && !target.classList.contains('no-click')) {
            const matchIndex = target.getAttribute('data-match-index');
            if (matchIndex !== null) {
                const { getCachedMatches } = await import('../profile/profile.html.js');
                const matches = getCachedMatches();
                const match = matches[parseInt(matchIndex)];
                if (match) {
                    // Stocker les données du match pour la page de stats
                    window.selectedMatchData = match;
                    await load('gameStats');
                }
            }
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

            sessionStorage.clear();
            
            // When logout, prevent back navigation to protected pages
            preventBackNavigationAfterLogout();
            await load('signIn');
        }

        // MULTIPLAYER
        if (target.id === 'ranked1v1Btn') {
            // Sauvegarder le type de jeu pour restart
            window.lastGameType = 'ranked1v1';
            // Réinitialiser le mode tournoi
            window.isTournamentMode = false;
            
            // Ensure any previous room is cleaned up first
            if (window.socket && window.leaveCurrentRoomAsync) {
                try {
                    await window.leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Pre-cleanup failed, proceeding anyway:', error);
                }
            }
            
            try {
                await window.joinOrCreateRoom(2);
            } catch (error) {
                // Show error to user
                if (window.socket) {
                    window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
        }
        if (target.id === 'multiplayer4pBtn') {
            // Sauvegarder le type de jeu pour restart
            window.lastGameType = 'multiplayer4p';
            // Réinitialiser le mode tournoi
            window.isTournamentMode = false;
            
            // Ensure any previous room is cleaned up first
            if (window.socket && window.leaveCurrentRoomAsync) {
                try {
                    await window.leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Pre-cleanup failed, proceeding anyway:', error);
                }
            }
            
            try {
                await window.joinOrCreateRoom(4);
            } catch (error) {
                // Show error to user
                if (window.socket) {
                    window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
        }
        if (target.id === 'cancelSearchBtn')
        {
            if (window.socket && window.leaveCurrentRoomAsync) {
                try {
                    await window.leaveCurrentRoomAsync();
                } catch (error) {
                    console.warn('Room cleanup failed, proceeding anyway:', error);
                }
            } else if (window.socket) {
                window.socket.emit('leaveAllRooms');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            await load('mainMenu');
        }

        // Bouton "4 Player Tournaments" - rejoindre/créer une room de tournoi
        if (target.id === 'tournamentCreateBtn')
        {
            window.isTournamentMode = true;
            window.lastGameType = 'tournament';
            try {
                await window.joinOrCreateRoom(4, false); // 4 joueurs, mode online (pas local)
            } catch (error) {
            }
        }
        });
    }
    
    // Ajoute un gestionnaire pour le clic droit (contextmenu)
    if (!(document as any)._spaContextMenuListenerSet) {
        (document as any)._spaContextMenuListenerSet = true;
        
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
                    window.selectedContextUser = { username, userId: parseInt(userId), isInGame };
                }

                // Régénérer le menu contextuel avec ou sans le bouton Spectate
                window.contextMenuIsInGame = isInGame;
                show('contextMenu');
                
                // Positionner le menu contextuel
                const menu = document.getElementById('contextMenu');
                if (menu) {
                    menu.style.left = `${e.clientX}px`;
                    menu.style.top = `${e.clientY}px`;
                }

            }
        });
    }
    
    if (!(document as any)._spaMenuClickListenerSet) {
        (document as any)._spaMenuClickListenerSet = true;
        
        document.addEventListener('click', async (e) => {
            const menu = document.getElementById('contextMenu');
            if (!menu) return;
        
            // Si le menu n'est pas affiché, rien à faire
            if (!menu.innerHTML.trim()) return;
        
            const target = e.target as HTMLElement;
            
            // Gérer les clics sur les boutons du menu contextuel
            if (menu.contains(target))
            {
                if (target.id === 'profileBtn')
                {
                    // Gérer l'affichage du profil depuis le context menu
                    const selectedUser = window.selectedContextUser;
                    if (selectedUser && selectedUser.username)
                    {
                        const userProfile = await fetchUserByUsername(selectedUser.username);
                        window.selectedProfileUser = userProfile;
                        await load('profile');
                    }
                    hide('contextMenu');
                    return;
                }
                if (target.id === 'removeFriendBtn')
                {
                    // Gérer la suppression d'ami
                    const selectedUser = window.selectedContextUser;
                    if (selectedUser && selectedUser.userId) {
                        removeFriend(selectedUser.userId, selectedUser.username);
                    }
                    hide('contextMenu');
                    return;
                }
                if (target.id === 'spectateBtn')
                {
                    // Gérer le spectate
                    const selectedUser = window.selectedContextUser;
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
                // Pour les tournois, la logique est gérée dans websocket.ts
                // Ici on gère juste le fallback pour les jeux normaux
                if (data.isTournament) {
                    // Tournoi: matchs 1v1 utilisent game, phase initiale reste en matchmaking
                    if (data.maxPlayers === 2) {
                        await load('game');
                    }
                    // Si maxPlayers === 4, on reste en matchmaking (géré par websocket.ts)
                } else if (data.maxPlayers === 4) {
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
    // SECURITY: Install ALL security guards FIRST to intercept all requests
    installAllSecurityGuards();
    
    // CRITICAL: Initialize session broadcast BEFORE anything else and WAIT
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