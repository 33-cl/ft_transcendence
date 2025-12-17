import { landingHTML, signInHTML, signUpHTML, twoFactorHTML, leaderboardHTML ,friendListHTML, addFriendsHTML, initLoadingIcons, mainMenuHTML, goToMainHTML, profileCardHTML, gameHTML, game4HTML, spectateHTML, spectate4HTML, matchmakingHTML, gameFinishedHTML, tournamentSemifinalFinishedHTML, tournamentFinalFinishedHTML, profileHTML, profileDashboardHTML, profileWinRateHistoryHTML, contextMenuHTML, settingsHTML, gameConfigHTML, aiConfigHTML, spectatorGameFinishedHTML, tournamentsHTML, rulesHTML, initializeFriendListEventListeners, initializeAddFriendsButton, startFriendListRealtimeUpdates, stopFriendListRealtimeUpdates, gameStatsHTML } from '../components/index.html.js';
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
    spectate: {id: 'spectate', html: spectateHTML},
    spectate4: {id: 'spectate4', html: spectate4HTML},
    signIn: {id: 'signIn', html: signInHTML},
    signUp: {id: 'signUp', html: signUpHTML},
    twoFactor: {id: 'twoFactor', html: twoFactorHTML},
    gameFinished: {id: 'gameFinished', html: gameFinishedHTML},
    tournamentSemifinalFinished: {id: 'tournamentSemifinalFinished', html: tournamentSemifinalFinishedHTML},
    tournamentFinalFinished: {id: 'tournamentFinalFinished', html: tournamentFinalFinishedHTML},
    spectatorGameFinished: {id: 'spectatorGameFinished', html: spectatorGameFinishedHTML},
    profile: {id: 'profile', html: profileHTML},
    profileDashboard: {id: 'profileDashboard', html: profileDashboardHTML},
    profileWinRateHistory: {id: 'profileWinRateHistory', html: profileWinRateHistoryHTML},
    gameStats: {id: 'gameStats', html: gameStatsHTML as any},
    contextMenu: {id: 'contextMenu', html: contextMenuHTML},
    settings: {id: 'settings', html: settingsHTML},
    gameConfig: {id: 'gameConfig', html: gameConfigHTML},
    aiConfig: {id: 'aiConfig', html: aiConfigHTML},
    tournaments: {id: 'tournaments', html: tournamentsHTML},
    rules: {id: 'rules', html: rulesHTML},
};

async function show(pageName: keyof typeof components, data?: any)
{
    
    // 🚨 SECURITY: Don't load ANY content if session is blocked
    // Exception: allow gameStats and goToMain as they're read-only pages that should work on reload
    const blocked = isSessionBlocked();
    
    if (blocked && pageName !== 'signIn' && pageName !== 'signUp' && pageName !== 'gameStats' && pageName !== 'goToMain') {
        console.warn(`🚫 Component loading BLOCKED for '${pageName}': Session is active in another tab`);
        return; // Don't load any content
    }
    
    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        if (typeof component.html === 'function') {
            let htmlResult;
            
            // Cas spécial pour le profil - passer l'utilisateur sélectionné
            if (pageName === 'profile') {
                const selectedUser = window.selectedProfileUser;
                htmlResult = component.html(selectedUser);
                // Ne pas nettoyer tout de suite - on en a besoin pour profileDashboard
            }
            // Cas spécial pour le profileDashboard - passer l'utilisateur sélectionné
            else if (pageName === 'profileDashboard') {
                const selectedUser = window.selectedProfileUser;
                htmlResult = component.html(selectedUser);
                // Nettoyer après utilisation du dashboard
                window.selectedProfileUser = null;
            } 
            // Cas spécial pour gameStats - passer les données du match
            else if (pageName === 'gameStats') {
                const matchData = window.selectedMatchData;
                const userId = window.currentUser?.id || 0;
                htmlResult = component.html(matchData, userId);
            }
            // Cas spécial pour gameFinished - passer les données de fin de jeu
            else if (pageName === 'gameFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour spectatorGameFinished - passer les données de fin de jeu
            else if (pageName === 'spectatorGameFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour tournamentSemifinalFinished - passer les données de fin de demi-finale
            else if (pageName === 'tournamentSemifinalFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour tournamentFinalFinished - passer les données de fin de finale
            else if (pageName === 'tournamentFinalFinished') {
                htmlResult = component.html(data);
            }
            // Cas spécial pour contextMenu - passer isInGame
            else if (pageName === 'contextMenu') {
                const isInGame = window.contextMenuIsInGame || false;
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

let currentLoadId = 0;

// Pages considérées comme "en jeu" - quitter ces pages ne doit pas déclencher de forfait
const gamePages = ['game', 'game4', 'spectate', 'spectate4', 'matchmaking', 'gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];

// Variable pour tracker la page actuelle
let currentPage: string | null = null;

async function load(pageName: string, data?: any, updateHistory: boolean = true)
{   
    const myLoadId = ++currentLoadId;

    // 🚨 CRITICAL SECURITY CHECK: Block navigation if session is blocked by another tab
    // Exception: allow gameStats as it's a read-only page that should work on reload
    if (isSessionBlocked() && pageName !== 'signIn' && pageName !== 'signUp' && pageName !== 'gameStats') {
        console.warn('Navigation blocked: Session is active in another tab');
        return; // Don't allow navigation
    }
    
    // Nettoyer les event listeners de la page landing si on la quitte
    if (window.cleanupLandingHandlers) {
        window.cleanupLandingHandlers();
        window.cleanupLandingHandlers = null;
    }
    
    // 🎮 FORFEIT: Si on quitte une page de jeu pour aller ailleurs, déclencher le forfait
    const wasInGame = currentPage && gamePages.includes(currentPage);
    const goingToGame = gamePages.includes(pageName);
    
    if (wasInGame && !goingToGame) {
        // Marquer qu'on quitte le jeu volontairement - ignorer l'écran de fin
        window.isNavigatingAwayFromGame = true;
        
        // Quitter la room = forfait si partie en cours (géré côté backend)
        if (window.socket && window.leaveCurrentRoomAsync) {
            try {
                await window.leaveCurrentRoomAsync();
            } catch (error) {
                console.warn('Room cleanup on navigation failed:', error);
            }
        }
    } else if (goingToGame) {
        // Reset du flag uniquement si on va vers une page de jeu (nouveau jeu)
        window.isNavigatingAwayFromGame = false;
    }
    // Note: On ne reset PAS le flag si on va vers une page non-jeu,
    // car l'événement gameFinished/spectatorGameFinished pourrait encore arriver
    
    // Mettre à jour la page courante
    currentPage = pageName;
    
    hideAllPages();
    
    // Check if another load started
    if (myLoadId !== currentLoadId) {
        console.warn(`🚫 load('${pageName}') aborted: newer load started`);
        return;
    }

    // Arrêter les mises à jour WebSocket si on quitte le menu principal
    if (pageName !== 'mainMenu') {
        stopFriendListRealtimeUpdates();
    }
    
    if (pageName === 'landing')
        await show('landing');
    else if (pageName === 'mainMenu')
    {
         if (window.aiMode) {
            window.aiMode = false; //Retour au menu - reset du flag IA 🤖 
         } 
        // Refresh user stats BEFORE showing components to ensure displayed data is current
        if (window.currentUser && window.refreshUserStats) {
            window.refreshUserStats().then(async (_statsChanged: boolean) => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load

            // Show components after stats are refreshed
                await show('mainMenu');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                await show('friendList');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                // Attendre que l'HTML soit rendu avant d'initialiser
                setTimeout(async () => {
                    if (myLoadId !== currentLoadId) return; // Abort if newer load
                    initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                    initializeFriendListEventListeners(); // Initialiser les event listeners
                    startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                    initLoadingIcons(); // Initialiser les icônes de chargement
                    
                    // Update friend requests badge on display
                    const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                await show('profileCard');
            }).catch(async (error: any) => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                console.warn('Failed to refresh user stats before main menu:', error);
                // Still show components even if refresh fails
                await show('mainMenu');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                await show('friendList');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                // Wait for HTML to be rendered before initialization
                setTimeout(async () => {
                    if (myLoadId !== currentLoadId) return; // Abort if newer load
                    initializeAddFriendsButton(); // Initialiser le bouton Add Friends
                    initializeFriendListEventListeners();
                    startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                    
                    // Update friend requests badge on display
                    const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                    await updateFriendRequestsBadge();
                }, 100);
                await show('leaderboard');
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                await show('profileCard');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('mainMenu');
            if (myLoadId !== currentLoadId) return; // Abort if newer load
            await show('friendList');
            if (myLoadId !== currentLoadId) return; // Abort if newer load
            // Wait for HTML to be rendered before initialization
            setTimeout(async () => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                initializeAddFriendsButton(); // Initialize Add Friends button
                initializeFriendListEventListeners(); // Initialize event listeners
                startFriendListRealtimeUpdates(); // Enable real-time updates via WebSocket
                initLoadingIcons(); // Initialize loading icons
                
                // Update friend requests badge on display
                const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
            await show('leaderboard');
            if (myLoadId !== currentLoadId) return; // Abort if newer load
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
    else if (pageName === 'twoFactor')
    {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('twoFactor');
        // Initialize cross-tab session listener
        initSessionBroadcast();
    }
    else if (pageName === 'game') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('game');
    }
    else if (pageName === 'game4') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('game4');
    }
    else if (pageName === 'spectate') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('spectate');
    }
    else if (pageName === 'spectate4') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('spectate4');
    }
    else if (pageName === 'matchmaking')
    {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        await show('matchmaking');
        if (myLoadId === currentLoadId) {
            animateDots();
            switchTips();
        }
    }
    else if (pageName === 'profile')
    {
        // Capturer l'utilisateur sélectionné AVANT les show() car profileDashboard le reset à null
        const targetUser = window.selectedProfileUser || window.currentUser;
        
        // Refresh user stats BEFORE showing profile to ensure displayed data is current
        if (window.currentUser && window.refreshUserStats) {
            window.refreshUserStats().then(async (_statsChanged: boolean) => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load
      
                // Show components after stats are refreshed
                await show('profile');
                await show('profileDashboard');
                await show('profileWinRateHistory');
                await show('goToMain');
                
                // Initialiser les graphiques après l'affichage du profil
                setTimeout(async () => {
                    if (myLoadId !== currentLoadId) return; // Abort if newer load
                    const { initializeStatsChart, initializeWinRateHistoryChart } = await import('../profile/profile.js');
                    const wins = targetUser?.wins || 0;
                    const losses = targetUser?.losses || 0;
                    initializeStatsChart(wins, losses);
                    if (targetUser?.id) {
                        await initializeWinRateHistoryChart(targetUser.id);
                    }
                }, 100);
            }).catch(async (error: any) => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                console.warn('Failed to refresh user stats before profile:', error);
                // Still show components even if refresh fails
                await show('profile');
                await show('profileDashboard');
                await show('profileWinRateHistory');
                await show('goToMain');
                
                // Initialiser les graphiques même si le refresh a échoué
                setTimeout(async () => {
                    if (myLoadId !== currentLoadId) return; // Abort if newer load
                    const { initializeStatsChart, initializeWinRateHistoryChart } = await import('../profile/profile.js');
                    const wins = targetUser?.wins || 0;
                    const losses = targetUser?.losses || 0;
                    initializeStatsChart(wins, losses);
                    if (targetUser?.id) {
                        await initializeWinRateHistoryChart(targetUser.id);
                    }
                }, 100);
            });
        } else {
            // No user or refresh function available, show components directly
            await show('profile');
            await show('profileDashboard');
            await show('profileWinRateHistory');
            await show('goToMain');
            
            // Initialiser les graphiques
            setTimeout(async () => {
                if (myLoadId !== currentLoadId) return; // Abort if newer load
                const { initializeStatsChart, initializeWinRateHistoryChart } = await import('../profile/profile.js');
                const wins = targetUser?.wins || 0;
                const losses = targetUser?.losses || 0;
                initializeStatsChart(wins, losses);
                if (targetUser?.id) {
                    await initializeWinRateHistoryChart(targetUser.id);
                }
            }, 100);
        }
    }
    else if (pageName === 'gameStats') {
        stopFriendListRealtimeUpdates();
        // Restore selected match after reload if needed.
        // Important: on hard reload, `cachedMatches` is empty, so we also fetch the match by id.
        if (!(window as any).selectedMatchData) {
            const urlParts = window.location.pathname.split('/').filter(Boolean);
            const urlHead = (urlParts[0] || '').toLowerCase();
            const urlMatchId = (urlHead === 'gamestats' || urlParts[0] === 'gameStats')
                ? (urlParts[1] ? Number(urlParts[1]) : undefined)
                : undefined;
            const storedMatchIdRaw = sessionStorage.getItem('gameStatsMatchId');
            const storedMatchId = storedMatchIdRaw ? Number(storedMatchIdRaw) : undefined;
            const matchIdToRestore = urlMatchId || storedMatchId;

            if (matchIdToRestore) {
                // 1) try in-memory cache (works when coming from profile without reload)
                try {
                    const { getCachedMatches } = await import('../profile/profile.html.js');
                    const matches = getCachedMatches?.() || [];
                    const found = matches.find((m: any) => m?.id === matchIdToRestore);
                    if (found) {
                        (window as any).selectedMatchData = found;
                    }
                } catch (e) {
                    // ignore
                }

                // 2) fetch fallback (works on reload even if cache is empty)
                if (!(window as any).selectedMatchData) {
                    try {
                        const res = await fetch(`/matches/${matchIdToRestore}`, {
                            method: 'GET',
                            credentials: 'include',
                        });
                        if (res.ok) {
                            const data = await res.json();
                            // Accept either {match: {...}} or direct match payload
                            const match = (data && (data.match || data)) || null;
                            if (match) {
                                (window as any).selectedMatchData = match;
                            }
                        }
                    } catch (e) {
                        // keep empty state; gameStatsHTML will show a message
                    }
                }
            }
        }
        await show('gameStats');
        await show('goToMain');
        
        // Initialiser les graphiques après l'affichage
        setTimeout(async () => {
            if (myLoadId !== currentLoadId) return;
            const { initializeGameStatsCharts } = await import('../profile/gamestats.js');
            const matchData = window.selectedMatchData;
            if (matchData) {
                initializeGameStatsCharts(matchData);
            }
        }, 100);
    }
    else if (pageName === 'gameConfig') 
    {
        await show('gameConfig');
        await show('goToMain');
        setTimeout(() => {
            if (myLoadId !== currentLoadId) return; // Abort if newer load
            if (window.initGameConfigManagers) window.initGameConfigManagers();
        }, 100);
    }
    else if (pageName === 'aiConfig') 
    {
        await show('aiConfig');
        await show('goToMain');
        setTimeout(() => {
            if (myLoadId !== currentLoadId) return; // Abort if newer load
            if (window.initAIConfigManagers) window.initAIConfigManagers();
        }, 100);
    }
    else if (pageName === 'rules')
    {
        stopFriendListRealtimeUpdates();
        await show('rules');
        await show('goToMain');
    }
    else if (pageName === 'tournaments') {
        stopFriendListRealtimeUpdates(); // Arrêter les mises à jour WebSocket
        console.log('📺 Showing tournaments component...');
        await show('tournaments');
        await show('goToMain');
        // Initialize tournaments functionality after component is rendered
        setTimeout(async () => {
            if (myLoadId !== currentLoadId) return; // Abort if newer load
            console.log('🚀 Loading tournaments functionality...');
            const tournamentsPage = await import('../tournament/tournaments.js');
            await tournamentsPage.initTournaments();
        }, 100);
    }
    else if (pageName === 'gameFinished')
        await show('gameFinished', data);
    else if (pageName === 'spectatorGameFinished')
        await show('spectatorGameFinished', data);
    else if (pageName === 'tournamentSemifinalFinished')
        await show('tournamentSemifinalFinished', data);
    else if (pageName === 'tournamentFinalFinished')
        await show('tournamentFinalFinished', data);
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

    if (updateHistory && myLoadId === currentLoadId)
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
window.load = guardFunction(load, 'load'); 