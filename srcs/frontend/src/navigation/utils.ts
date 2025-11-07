import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, addFriendsHTML, initLoadingIcons, mainMenuHTML, goToMainHTML, profileCardHTML, gameHTML, game4HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML, settingsHTML, aiConfigHTML, spectatorGameFinishedHTML, tournamentsHTML, initializeFriendListEventListeners, initializeAddFriendsButton, startFriendListRealtimeUpdates, stopFriendListRealtimeUpdates } from '../components/index.html.js';
import { animateDots, switchTips } from '../game/matchmaking.html.js';
import { initSessionBroadcast, isSessionBlocked } from './sessionBroadcast.js';
import { guardFunction } from './securityGuard.js';
import { pushHistoryState } from './navigation.js';

const components = {
    landing: {id: 'landing', html: landingHTML},
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
    goToMain: {id: 'goToMain', html: goToMainHTML},
    profileCard: {id: 'profileCard', html: profileCardHTML},
    leaderboard: {id: 'leaderboard', html: leaderboardHTML},
    friendList: {id: 'friendList', html: friendListHTML},
    addFriends: {id: 'addFriends', html: addFriendsHTML},
    matchmaking: {id: 'matchmaking', html: matchmakingHTML},
    game: {id: 'game', html: gameHTML},
    game4: {id: 'game4', html: game4HTML},
    signIn: {id: 'signIn', html: signInHTML},
    signUp: {id: 'signUp', html: signUpHTML},
    gameFinished: {id: 'gameFinished', html: gameFinishedHTML},
    spectatorGameFinished: {id: 'spectatorGameFinished', html: spectatorGameFinishedHTML},
    profile: {id: 'profile', html: profileHTML},
    contextMenu: {id: 'contextMenu', html: contextMenuHTML},
    settings: {id: 'settings', html: settingsHTML},
    aiConfig: {id: 'aiConfig', html: aiConfigHTML},
    tournaments: {id: 'tournaments', html: tournamentsHTML},
};

async function show(pageName: keyof typeof components, data?: any)
{
    console.log(`📄 show('${pageName}') called`);
    
    // 🚨 SECURITY: Don't load ANY content if session is blocked
    const blocked = isSessionBlocked();
    console.log(`   isSessionBlocked() returned: ${blocked}`);
    
    if (blocked && pageName !== 'signIn' && pageName !== 'signUp') {
        console.warn(`🚫 Component loading BLOCKED for '${pageName}': Session is active in another tab`);
        return; // Don't load any content
    }
    
    console.log(`✅ Loading component '${pageName}'`);
    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        if (typeof component.html === 'function') {
            let htmlResult;
            
            // Cas spécial pour le profil - passer l'utilisateur sélectionné
            if (pageName === 'profile') {
                const selectedUser = (window as any).selectedProfileUser;
                htmlResult = component.html(selectedUser);
                // Nettoyer après utilisation
                (window as any).selectedProfileUser = null;
            } 
            // Cas spécial pour gameFinished - passer les données de fin de jeu
            else if (pageName === 'gameFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour spectatorGameFinished - passer les données de fin de jeu
            else if (pageName === 'spectatorGameFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour contextMenu - passer isInGame
            else if (pageName === 'contextMenu') {
                const isInGame = (window as any).contextMenuIsInGame || false;
                htmlResult = component.html(isInGame);
            }
            else {
                htmlResult = component.html();
            }
            
            if (htmlResult instanceof Promise) {
                element.innerHTML = await htmlResult;
            } else {
                element.innerHTML = htmlResult;
            }
        } else {
            element.innerHTML = component.html;
        }
    }

    // Notifies each element is ready
    setTimeout(() =>
    {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

async function load(pageName: string, data?: any, updateHistory: boolean = true)
{   
    // 🚨 CRITICAL SECURITY CHECK: Block navigation if session is blocked by another tab
    if (isSessionBlocked() && pageName !== 'signIn' && pageName !== 'signUp') {
        console.warn('Navigation blocked: Session is active in another tab');
        return; // Don't allow navigation
    }
    
    // Nettoyer les event listeners de la page landing si on la quitte
    if ((window as any).cleanupLandingHandlers) {
        (window as any).cleanupLandingHandlers();
        (window as any).cleanupLandingHandlers = null;
    }
    
    hideAllPages();
    
    // Arrêter les mises à jour WebSocket si on quitte le menu principal
    if (pageName !== 'mainMenu') {
        stopFriendListRealtimeUpdates();
    }
    
    if (pageName === 'landing')
        await show('landing');
    else if (pageName === 'mainMenu')
    {
         if ((window as any).aiMode) {
            (window as any).aiMode = false; //Retour au menu - reset du flag IA 🤖 
         } 
        // Refresh user stats BEFORE showing components to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then(async (_statsChanged: boolean) => {

            // Show components after stats are refreshed
                await show('mainMenu');
                await show('friendList');
                // Attendre que l'HTML soit rendu avant d'initialiser
                setTimeout(async () => {
                    initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                    initializeFriendListEventListeners(); // Initialiser les event listeners
                    startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                    initLoadingIcons(); // Initialiser les icônes de chargement
                    
                    // Update friend requests badge on display
                    const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                await show('profileCard');
            }).catch(async (error: any) => {
                console.warn('Failed to refresh user stats before main menu:', error);
                // Still show components even if refresh fails
                await show('mainMenu');
                await show('friendList');
                // Wait for HTML to be rendered before initialization
                setTimeout(async () => {
                    initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                    initializeFriendListEventListeners();
                    startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                    
                    // Update friend requests badge on display
                    const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                await show('profileCard');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('mainMenu');
            await show('friendList');
            // Wait for HTML to be rendered before initialization
            setTimeout(async () => {
                initializeAddFriendsButton(); // Initialize Add Friends button
                initializeFriendListEventListeners(); // Initialize event listeners
                startFriendListRealtimeUpdates(); // Enable real-time updates via WebSocket
                initLoadingIcons(); // Initialize loading icons
                
                // Update friend requests badge on display
                const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
            await show('leaderboard');
            await show('profileCard');
        }
    }

    else if (pageName === 'settings') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('settings');
    }
    else if (pageName === 'signIn')
    {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('signIn');
        // Initialize cross-tab session listener (will auto-block if another tab has a session)
        initSessionBroadcast();
        // show('goToMain');
    }
    else if (pageName === 'signUp')
    {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('signUp');
        // Initialize cross-tab session listener (will auto-block if another tab has a session)
        initSessionBroadcast();
        // show('goToMain');
    }
    else if (pageName === 'game') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('game');
    }
    else if (pageName === 'game4') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('game4');
    }
    else if (pageName === 'matchmaking')
    {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('matchmaking');
        animateDots();
        switchTips();
    }
    else if (pageName === 'profile')
    {
        // Refresh user stats BEFORE showing profile to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then(async (_statsChanged: boolean) => {
      
                // Show components after stats are refreshed
                await show('profile');
                await show('goToMain');
            }).catch(async (error: any) => {
                console.warn('Failed to refresh user stats before profile:', error);
                // Still show components even if refresh fails
                await show('profile');
                await show('goToMain');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('profile');
            await show('goToMain');
        }
    }
    else if (pageName === 'aiConfig') 
    {
        await show('aiConfig');
        await show('goToMain');
        setTimeout(() => {
            if ((window as any).initAIConfigManagers) (window as any).initAIConfigManagers();
        }, 100);
    }
    else if (pageName === 'tournaments') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        console.log('📺 Showing tournaments component...');
        await show('tournaments');
        await show('goToMain');
        // Initialize tournaments functionality after component is rendered
        setTimeout(async () => {
            console.log('🚀 Loading tournaments functionality...');
            const tournamentsPage = await import('../tournament/tournaments.js');
            await tournamentsPage.initTournaments();
        }, 100);
    }
    else if (pageName === 'gameFinished')
        await show('gameFinished', data);
    else if (pageName === 'spectatorGameFinished')
        await show('spectatorGameFinished', data);
    else if (pageName.startsWith('tournaments/')) {
        // Handle tournament detail pages: /tournaments/:id
        const tournamentId = pageName.split('/')[1];
        if (tournamentId) {
            const tournamentDetail = await import('../tournament/tournamentDetail.js');
            await tournamentDetail.default(tournamentId);
        } else {
            console.warn('Tournament ID missing in URL');
        }
    }
    else
        console.warn(`Page ${pageName} not found`);

    if (updateHistory)
        pushHistoryState(pageName);
}

function hide(pageName: keyof typeof components)
{
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) element.innerHTML = '';
}

function hideAllPages(): void
{
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

export { show, load, hideAllPages, hide };
// Exposer load globalement pour les autres modules avec protection
(window as any).load = guardFunction(load, 'load'); 