import { landingHTML, signInHTML, signUpHTML, twoFactorHTML, leaderboardHTML, friendListHTML, addFriendsHTML, initLoadingIcons, mainMenuHTML, goToMainHTML, profileCardHTML, gameHTML, game4HTML, spectateHTML, spectate4HTML, matchmakingHTML, gameFinishedHTML, tournamentSemifinalFinishedHTML, tournamentFinalFinishedHTML, profileHTML, profileDashboardHTML, profileWinRateHistoryHTML, contextMenuHTML, settingsHTML, gameConfigHTML, aiConfigHTML, spectatorGameFinishedHTML, rulesHTML, initializeFriendListEventListeners, initializeAddFriendsButton, startFriendListRealtimeUpdates, stopFriendListRealtimeUpdates, gameStatsHTML, notFoundHTML } from '../components/index.html.js';
import { animateDots, switchTips } from '../game/matchmaking.html.js';
import { initSessionBroadcast, isSessionBlocked } from './sessionBroadcast.js';
import { guardFunction } from './securityGuard.js';
import { pushHistoryState } from './navigation.js';

// Dictionary mapping page names to their DOM IDs and HTML content generators.
const components =
{
    landing: { id: 'landing', html: landingHTML },
    mainMenu: { id: 'mainMenu', html: mainMenuHTML },
    background: { id: 'goToMain', html: goToMainHTML },
    goToMain: { id: 'goToMain', html: goToMainHTML },
    profileCard: { id: 'profileCard', html: profileCardHTML },
    leaderboard: { id: 'leaderboard', html: leaderboardHTML },
    friendList: { id: 'friendList', html: friendListHTML },
    addFriends: { id: 'addFriends', html: addFriendsHTML },
    matchmaking: { id: 'matchmaking', html: matchmakingHTML },
    game: { id: 'game', html: gameHTML },
    game4: { id: 'game4', html: game4HTML },
    spectate: { id: 'spectate', html: spectateHTML },
    spectate4: { id: 'spectate4', html: spectate4HTML },
    signIn: { id: 'signIn', html: signInHTML },
    signUp: { id: 'signUp', html: signUpHTML },
    twoFactor: { id: 'twoFactor', html: twoFactorHTML },
    gameFinished: { id: 'gameFinished', html: gameFinishedHTML },
    tournamentSemifinalFinished: { id: 'tournamentSemifinalFinished', html: tournamentSemifinalFinishedHTML },
    tournamentFinalFinished: { id: 'tournamentFinalFinished', html: tournamentFinalFinishedHTML },
    spectatorGameFinished: { id: 'spectatorGameFinished', html: spectatorGameFinishedHTML },
    profile: { id: 'profile', html: profileHTML },
    profileDashboard: { id: 'profileDashboard', html: profileDashboardHTML },
    profileWinRateHistory: { id: 'profileWinRateHistory', html: profileWinRateHistoryHTML },
    gameStats: { id: 'gameStats', html: gameStatsHTML as any },
    contextMenu: { id: 'contextMenu', html: contextMenuHTML },
    settings: { id: 'settings', html: settingsHTML },
    gameConfig: { id: 'gameConfig', html: gameConfigHTML },
    aiConfig: { id: 'aiConfig', html: aiConfigHTML },
    // Tournaments page removed — no mapping here
    rules: { id: 'rules', html: rulesHTML },
    notFound: { id: 'notFound', html: notFoundHTML },
};

// This function handles special data requirements for dynamic pages
async function show(pageName: keyof typeof components, data?: any)
{
    // Read-only pages are exempted to allow basic navigation.
    const blocked = isSessionBlocked();

    if (blocked &&
        pageName !== 'signIn' &&
        pageName !== 'signUp' &&
        pageName !== 'gameStats' &&
        pageName !== 'goToMain' &&
        pageName !== 'profile' &&
        pageName !== 'profileDashboard' &&
        pageName !== 'profileWinRateHistory')
    {
        return;
    }

    const component = components[pageName];
    const element = document.getElementById(component.id);

    if (element)
    {
        if (typeof component.html === 'function')
        {
            let htmlResult;

            // Route-specific logic to prepare data before rendering the HTML.
            if (pageName === 'profile')
            {
                const selectedUser = window.selectedProfileUser;
                htmlResult = component.html(selectedUser);
            }
            else if (pageName === 'profileDashboard')
            {
                const selectedUser = window.selectedProfileUser;
                htmlResult = component.html(selectedUser);
                // Clear the selection reference after use to avoid state pollution.
                window.selectedProfileUser = null;
            }
            else if (pageName === 'gameStats')
            {
                const matchData = window.selectedMatchData;
                const userId = window.currentUser?.id || 0;
                htmlResult = component.html(matchData, userId);
            }
            else if (pageName === 'gameFinished' ||
                pageName === 'spectatorGameFinished' ||
                pageName === 'tournamentSemifinalFinished' ||
                pageName === 'tournamentFinalFinished')
            {
                htmlResult = component.html(data);
            }
            else if (pageName === 'contextMenu')
            {
                const isInGame = window.contextMenuIsInGame || false;
                htmlResult = component.html(isInGame);
            }
            else
            {
                htmlResult = component.html();
            }

            // Handle both synchronous and asynchronous HTML generation.
            if (htmlResult instanceof Promise)
                element.innerHTML = await htmlResult;
            else
                element.innerHTML = htmlResult;
        }
        else
        {
            element.innerHTML = component.html;
        }
    }

    // Defer the event dispatch to ensure the DOM has updated.
    setTimeout(() =>
    {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

// Global state to manage race conditions during rapid navigation.
let currentLoadId = 0;

// List of pages that constitute an active gameplay session.
const gamePages = ['game', 'game4', 'spectate', 'spectate4', 'matchmaking', 'gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];

let currentPage: string | null = null;

// Main navigation router. Handles page transitions, security checks, and resource cleanup.
async function load(pageName: string, data?: any, updateHistory: boolean = true)
{
    const myLoadId = ++currentLoadId;

    // Security check: Abort navigation if the session is controlled by another tab.
    if (isSessionBlocked() &&
        pageName !== 'signIn' &&
        pageName !== 'signUp' &&
        pageName !== 'gameStats' &&
        pageName !== 'profile')
    {
        return;
    }

    // Cleanup specific listeners attached to the landing page.
    if (window.cleanupLandingHandlers)
    {
        window.cleanupLandingHandlers();
        window.cleanupLandingHandlers = null;
    }

    // Forfeit logic: Trigger a game leave if the user navigates away from an active match.
    const wasInGame = currentPage && gamePages.includes(currentPage);
    const goingToGame = gamePages.includes(pageName);

    if (wasInGame && !goingToGame)
    {
        if (window.cleanupTournamentListeners)
            window.cleanupTournamentListeners();

        // Always set this flag when leaving a game voluntarily
        // This prevents the leaving player from seeing the gameFinished overlay
        window.isNavigatingAwayFromGame = true;

        if (window.socket && window.leaveCurrentRoomAsync)
        {
            try
            {
                await window.leaveCurrentRoomAsync();
            }
            catch (error)
            {
                console.warn('Room cleanup on navigation failed:', error);
            }
        }
    }
    else if (goingToGame)
    {
        window.isNavigatingAwayFromGame = false;
    }

    currentPage = pageName;
    hideAllPages();

    // Abort if a newer navigation request was initiated during processing.
    if (myLoadId !== currentLoadId)
    {
        console.warn(`load('${pageName}') aborted: newer load started`);
        return;
    }

    // Disable real-time updates when leaving the main menu to save resources.
    if (pageName !== 'mainMenu')
        stopFriendListRealtimeUpdates();

    // Route-specific loading logic.
    if (pageName === 'landing')
    {
        await show('landing');
    }
    else if (pageName === 'mainMenu')
    {
        if (window.aiMode)
            window.aiMode = false;

        // Attempt to refresh user statistics before rendering the dashboard.
        const refreshStats = window.currentUser && window.refreshUserStats
            ? window.refreshUserStats()
            : Promise.resolve();

        refreshStats.finally(async () =>
        {
            if (myLoadId !== currentLoadId) return;

            await show('mainMenu');
            if (myLoadId !== currentLoadId) return;
            await show('friendList');
            if (myLoadId !== currentLoadId) return;

            // Initialize interactive elements after rendering.
            setTimeout(async () =>
            {
                if (myLoadId !== currentLoadId) return;

                initializeAddFriendsButton();
                initializeFriendListEventListeners();
                startFriendListRealtimeUpdates();
                initLoadingIcons();

                const { updateFriendRequestsBadge } = await import('../friends/friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);

            await show('leaderboard');
            if (myLoadId !== currentLoadId) return;
            await show('profileCard');
        }).catch((error: any) =>
        {
            console.warn('Failed to refresh user stats before main menu:', error);
        });
    }
    else if (pageName === 'settings')
    {
        await show('settings');
    }
    else if (pageName === 'signIn')
    {
        await show('signIn');
        initSessionBroadcast();
    }
    else if (pageName === 'signUp')
    {
        await show('signUp');
        initSessionBroadcast();
    }
    else if (pageName === 'twoFactor')
    {
        await show('twoFactor');
        initSessionBroadcast();
    }
    else if (pageName === 'game')
    {
        await show('game');
        if (window.isLocalGame)
            await show('goToMain');
    }
    else if (pageName === 'game4')
    {
        await show('game4');
        if (window.isLocalGame)
            await show('goToMain');
    }
    else if (pageName === 'spectate')
    {
        await show('spectate');
    }
    else if (pageName === 'spectate4')
    {
        await show('spectate4');
    }
    else if (pageName === 'matchmaking')
    {
        await show('matchmaking');
        if (myLoadId === currentLoadId)
        {
            animateDots();
            switchTips();
        }
    }
    else if (pageName === 'profile')
    {
        // Handle profile data restoration from URL or session storage on reload.
        if (!window.selectedProfileUser)
        {
            const urlParts = window.location.pathname.split('/').filter(Boolean);
            const urlUsername = (urlParts[0] === 'profile' && urlParts[1]) ? urlParts[1] : undefined;
            const storedUsername = sessionStorage.getItem('profileUsername') || undefined;
            const usernameToRestore = urlUsername || storedUsername;

            if (usernameToRestore)
            {
                if (window.currentUser && window.currentUser.username === usernameToRestore)
                {
                    window.selectedProfileUser = window.currentUser;
                }
                else
                {
                    try
                    {
                        const res = await fetch(`/users/by-username/${encodeURIComponent(usernameToRestore)}`, {
                            method: 'GET',
                            credentials: 'include',
                        });
                        if (res.ok)
                        {
                            const data = await res.json();
                            if (data?.user)
                                window.selectedProfileUser = data.user;
                        }
                    }
                    catch (e)
                    {
                    }
                }
            }
        }

        if (window.selectedProfileUser?.username)
            sessionStorage.setItem('profileUsername', window.selectedProfileUser.username);

        const targetUser = window.selectedProfileUser || window.currentUser;

        // Refresh stats and render profile components.
        const refreshStats = window.currentUser && window.refreshUserStats
            ? window.refreshUserStats()
            : Promise.resolve();

        refreshStats.finally(async () =>
        {
            if (myLoadId !== currentLoadId) return;

            await show('profile');
            await show('profileDashboard');
            await show('profileWinRateHistory');
            await show('goToMain');

            // Initialize charts after rendering.
            setTimeout(async () =>
            {
                if (myLoadId !== currentLoadId) return;

                const { initializeStatsChart, initializeWinRateHistoryChart } = await import('../profile/profile.js');
                const wins = targetUser?.wins || 0;
                const losses = targetUser?.losses || 0;

                initializeStatsChart(wins, losses);
                if (targetUser?.id)
                    await initializeWinRateHistoryChart(targetUser.id);
            }, 100);
        });
    }
    else if (pageName === 'gameStats')
    {
        // Attempt to restore match data from cache or fetch from API if missing.
        if (!(window as any).selectedMatchData)
        {
            const urlParts = window.location.pathname.split('/').filter(Boolean);
            const urlHead = (urlParts[0] || '').toLowerCase();
            const urlMatchId = (urlHead === 'gamestats' || urlParts[0] === 'gameStats')
                ? (urlParts[1] ? Number(urlParts[1]) : undefined)
                : undefined;
            const storedMatchIdRaw = sessionStorage.getItem('gameStatsMatchId');
            const storedMatchId = storedMatchIdRaw ? Number(storedMatchIdRaw) : undefined;
            const matchIdToRestore = urlMatchId || storedMatchId;

            if (matchIdToRestore)
            {
                try
                {
                    const { getCachedMatches } = await import('../profile/profile.html.js');
                    const matches = getCachedMatches?.() || [];
                    const found = matches.find((m: any) => m?.id === matchIdToRestore);
                    if (found)
                        (window as any).selectedMatchData = found;
                }
                catch (e) { /* Ignore cache errors */ }

                if (!(window as any).selectedMatchData)
                {
                    try
                    {
                        const res = await fetch(`/matches/${matchIdToRestore}`, {
                            method: 'GET',
                            credentials: 'include',
                        });
                        if (res.ok)
                        {
                            const data = await res.json();
                            const match = (data && (data.match || data)) || null;
                            if (match)
                                (window as any).selectedMatchData = match;
                        }
                    }
                    catch (e) { /* Ignore fetch errors */ }
                }
            }
        }

        await show('gameStats');
        await show('goToMain');

        setTimeout(async () =>
        {
            if (myLoadId !== currentLoadId) return;
            const { initializeGameStatsCharts } = await import('../profile/gamestats.js');
            const matchData = window.selectedMatchData;
            if (matchData)
                initializeGameStatsCharts(matchData);
        }, 100);
    }
    else if (pageName === 'gameConfig')
    {
        await show('gameConfig');
        await show('goToMain');
        setTimeout(() =>
        {
            if (myLoadId !== currentLoadId) return;
            if (window.initGameConfigManagers)
                window.initGameConfigManagers();
        }, 100);
    }
    else if (pageName === 'aiConfig')
    {
        await show('aiConfig');
        await show('goToMain');
        setTimeout(() =>
        {
            if (myLoadId !== currentLoadId) return;
            if (window.initAIConfigManagers)
                window.initAIConfigManagers();
        }, 100);
    }
    else if (pageName === 'rules')
    {
        await show('rules');
        await show('goToMain');
    }
    else if (pageName === 'background')
    {
        await show('background');
    }
    else if (pageName === 'tournaments')
    {
        // Tournaments listing page has been removed; redirect to main menu
        console.warn('Tournaments page removed; redirecting to main menu.');
        await load('mainMenu');
    }
    else if (pageName === 'gameFinished')
    {
        await show('gameFinished', data);
    }
    else if (pageName === 'spectatorGameFinished')
    {
        await show('spectatorGameFinished', data);
    }
    else if (pageName === 'tournamentSemifinalFinished')
    {
        await show('tournamentSemifinalFinished', data);
    }
    else if (pageName === 'tournamentFinalFinished')
    {
        await show('tournamentFinalFinished', data);
    }
    else if (pageName.startsWith('tournaments/'))
    {
        // Tournament detail pages removed — redirect to main menu
        console.warn('Tournament detail page removed; redirecting to main menu.');
        await load('mainMenu');
    }
    else
    {
        console.warn(`Page ${pageName} not found`);
        await show('notFound');
    }

    if (updateHistory && myLoadId === currentLoadId)
        pushHistoryState(pageName);
}

// Clear the content of a specific component from the DOM.
function hide(pageName: keyof typeof components)
{
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element)
        element.innerHTML = '';
}

// Clear all component containers to reset the view.
function hideAllPages(): void
{
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

export { show, load, hideAllPages, hide };

// Expose the load function globally, wrapped in a security guard to prevent unauthorized execution.
window.load = guardFunction(load, 'load');