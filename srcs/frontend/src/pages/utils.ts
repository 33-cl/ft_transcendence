import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, addFriendsHTML, initLoadingIcons, mainMenuHTML, goToMainHTML, goToProfileHTML, gameHTML, game4HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML, settingsHTML, aiConfigHTML, spectatorGameFinishedHTML, initializeFriendListEventListeners, initializeAddFriendsButton, startFriendListRealtimeUpdates, stopFriendListRealtimeUpdates } from '../components/index.html.js';
import { animateDots, switchTips } from '../components/matchmaking.html.js';
import { initSessionBroadcast, isSessionBlocked } from '../utils/sessionBroadcast.js';

const components = {
    landing: {id: 'landing', html: landingHTML},
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
    goToMain: {id: 'goToMain', html: goToMainHTML},
    goToProfile: {id: 'goToProfile', html: goToProfileHTML}, // stocke la fonction
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
                    
                    // 🎯 Mettre à jour le badge des demandes d'amis dès l'affichage
                    const { updateFriendRequestsBadge } = await import('../components/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                await show('goToProfile');
            }).catch(async (error: any) => {
                console.warn('Failed to refresh user stats before main menu:', error);
                // Still show components even if refresh fails
                await show('mainMenu');
                await show('friendList');
                // Attendre que l'HTML soit rendu avant d'initialiser
                setTimeout(async () => {
                    initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                    initializeFriendListEventListeners(); // Initialiser les event listeners
                    startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                    initLoadingIcons(); // Initialiser les icônes de chargement
                    
                    // 🎯 Mettre à jour le badge des demandes d'amis dès l'affichage
                    const { updateFriendRequestsBadge } = await import('../components/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                await show('goToProfile');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('mainMenu');
            await show('friendList');
            // Attendre que l'HTML soit rendu avant d'initialiser
            setTimeout(async () => {
                initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                initializeFriendListEventListeners(); // Initialiser les event listeners
                startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                initLoadingIcons(); // Initialiser les icônes de chargement
                
                // 🎯 Mettre à jour le badge des demandes d'amis dès l'affichage
                const { updateFriendRequestsBadge } = await import('../components/friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
            await show('leaderboard');
            await show('goToProfile');
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
    else if (pageName === 'gameFinished')
        await show('gameFinished', data);
    else if (pageName === 'spectatorGameFinished')
        await show('spectatorGameFinished', data);
    else
        console.warn(`Page ${pageName} not found`);

    if (updateHistory)
        window.history.pushState({ page: pageName }, '', `/${pageName}`);
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
// Exposer load globalement pour les autres modules
(window as any).load = load; 