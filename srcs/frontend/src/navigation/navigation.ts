import { load } from './utils.js';
import { cleanupGameState } from '../game/gameCleanup.js';
import { setIsWaitingForTournamentFinal } from '../game/socketConnection.js';

// Update the browser's history stack with a new entry, handling dynamic URL parameters for specific views.
export function pushHistoryState(pageName: string): void
{
    // Define pages that should visually remain under the '/game' route in the URL bar.
    const gameFinishedPages = ['gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];

    if (pageName === 'gameStats')
    {
        const matchId = (window as any).selectedMatchData?.id;
        const urlPath = matchId ? `gameStats/${matchId}` : 'gameStats';
        window.history.pushState({ page: pageName, matchId }, '', `/${urlPath}`);
        return;
    }

    if (pageName === 'profile')
    {
        const username = (window as any).selectedProfileUser?.username || (window as any).currentUser?.username;
        const urlPath = username ? `profile/${username}` : 'profile';
        window.history.pushState({ page: pageName, username }, '', `/${urlPath}`);
        return;
    }

    const urlPath = gameFinishedPages.includes(pageName) ? 'game' : pageName;
    window.history.pushState({ page: pageName }, '', `/${urlPath}`);
}

// Modify the current history entry, preserving ID parameters from the URL if global state is lost (e.g., on refresh).
export function replaceHistoryState(pageName: string): void
{
    const gameFinishedPages = ['gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];

    if (pageName === 'gameStats')
    {
        // Attempt to retrieve the match ID from the global state first.
        let matchId = (window as any).selectedMatchData?.id;

        // If the global state is empty, parse the current URL to persist the match ID.
        if (!matchId)
        {
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts[0] && parts[0].toLowerCase() === 'gamestats' && parts[1])
            {
                const parsed = Number(parts[1]);
                if (!Number.isNaN(parsed))
                    matchId = parsed;
            }
        }

        const urlPath = matchId ? `gameStats/${matchId}` : 'gameStats';
        window.history.replaceState({ page: pageName, matchId }, '', `/${urlPath}`);
        return;
    }

    if (pageName === 'profile')
    {
        // Attempt to retrieve the username from the global state first.
        let username = (window as any).selectedProfileUser?.username;

        // Fallback: parse the URL to prevent overwriting a viewed profile with the current user's profile on reload.
        if (!username)
        {
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts[0] === 'profile' && parts[1])
                username = parts[1];
        }

        if (!username)
            username = (window as any).currentUser?.username;

        const urlPath = username ? `profile/${username}` : 'profile';
        window.history.replaceState({ page: pageName, username }, '', `/${urlPath}`);
        return;
    }

    const urlPath = gameFinishedPages.includes(pageName) ? 'game' : pageName;
    window.history.replaceState({ page: pageName }, '', `/${urlPath}`);
}

// Clear the navigation forward path to prevent users from returning to protected pages via the Back button after logging out.
export function preventBackNavigationAfterLogout(): void
{
    replaceHistoryState('signIn');
    pushHistoryState('signIn');
}

// Initialize the event listener for the browser's Back/Forward buttons and enforce security redirects.
export function setupPopStateHandler(): void
{
    // Prevent attaching the event listener multiple times.
    if (window._popStateListenerSet)
        return;

    window._popStateListenerSet = true;

    window.addEventListener('popstate', async function (event)
    {
        // Determine the target page, falling back to URL parsing if the state object is empty.
        let targetPage = event.state?.page || getPageFromURL();

        // Redirect away from the landing page based on authentication status.
        if (targetPage === 'landing')
            targetPage = window.currentUser ? 'mainMenu' : 'signIn';

        // Redirect logged-in users away from authentication pages.
        if (window.currentUser && (targetPage === 'signIn' || targetPage === 'signUp'))
            targetPage = 'mainMenu';

        // Block navigation back to transient game states (like matchmaking or active gameplay) and redirect to the menu.
        const blockedPages = ['matchmaking', 'game', 'game4', 'spectate', 'spectate4', 'gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];
        
        if (blockedPages.includes(targetPage) || targetPage.startsWith('tournament'))
        {
            targetPage = 'mainMenu';
            replaceHistoryState(targetPage);
        }

        // If the user is navigating away from an active game via browser Back/Forward,
        // perform the same cleanup as clicking the MAIN MENU button: cleanup local state and signal the server to leave rooms.
        
        // Check if we are leaving a game page to go to main menu
        // Note: getPageFromURL() returns the current URL (which is already the target page after popstate)
        // So we rely on checking if we were in a game state before
        
        // Force cleanup if we are going to main menu
        if (targetPage === 'mainMenu') {
            // Always ignore game finished events when navigating back to main menu
            // This ensures "refresh-like" behavior where we just leave without seeing the result
            (window as any).isNavigatingAwayFromGame = true;
            
            // Safety: clear the flag after a short timeout to avoid leaving it stuck.
            setTimeout(() => {
                if ((window as any).isNavigatingAwayFromGame) (window as any).isNavigatingAwayFromGame = false;
            }, 3000);

            try {
                // Local cleanup (remove canvas, listeners, renderer state)
                if (typeof cleanupGameState === 'function') cleanupGameState();

                // Reset tournament tracking flags
                (window as any).currentTournamentId = null;
                (window as any).currentMatchId = null;
                (window as any).isTournamentMode = false; // Ensure tournament mode is disabled
                setIsWaitingForTournamentFinal(false); // Cancel pending tournament final

                // Attempt graceful leave: prefer leaveCurrentRoomAsync if available
                if ((window as any).socket && (window as any).leaveCurrentRoomAsync) {
                    try {
                        await (window as any).leaveCurrentRoomAsync();
                    } catch (err) {
                        // fallback to emit
                        (window as any).socket.emit('leaveAllRooms');
                        await new Promise(res => setTimeout(res, 500));
                    }
                }
                else if ((window as any).socket) {
                    (window as any).socket.emit('leaveAllRooms');
                    await new Promise(res => setTimeout(res, 500));
                }
            } catch (err) {}
        }

        // Enforce authentication: redirect unauthenticated users to sign-in, unless accessing public pages or the 404 page.
        if (!window.currentUser && targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'landing' && targetPage !== 'notFound')
        {
            pushHistoryState('signIn');
            await load('signIn', undefined, false);
            return;
        }

        await load(targetPage, undefined, false);
    });
}

// Execute a callback function once the DOM is fully loaded to ensure elements exist before manipulation.
export function initNavigationOnLoad(callback: () => void | Promise<void>): void
{
    if (document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', async () =>
        {
            await callback();
        });
    }
    else
    {
        (async () =>
        {
            await callback();
        })();
    }
}

// Check the document ready state to determine if synchronous execution is safe.
export function isDOMReady(): boolean
{
    return document.readyState !== 'loading';
}

// Parse the current URL path to identify the requested view, handling dynamic routes and 404s.
export function getPageFromURL(): string
{
    const path = window.location.pathname;
    const cleanPath = (path.startsWith('/') ? path.substring(1) : path) || 'signIn';

    // Tournament detail routes removed — do not special-case them here.

    // Handle game statistics URLs, normalizing case and format (e.g., /gamestats/123 -> /gameStats/123).
    const lowered = cleanPath.toLowerCase();
    if ((lowered.startsWith('gamestats/') || lowered.startsWith('gamestats/')) && cleanPath.split('/').length === 2)
    {
        const parts = cleanPath.split('/');
        const matchId = parts[1];
        window.history.replaceState(window.history.state, '', `/gameStats/${matchId}`);
        return 'gameStats';
    }
    if (cleanPath.startsWith('gameStats/') && cleanPath.split('/').length === 2)
        return 'gameStats';

    // Return 'profile' for dynamic profile routes.
    if (cleanPath.startsWith('profile/') && cleanPath.split('/').length === 2)
        return 'profile';

    // Extract the base route name and validate it against a whitelist of known pages.
    const candidate = cleanPath.split('/')[0] || 'signIn';
    const knownPages = new Set([
        'signIn', 'signUp', 'landing', 'mainMenu', 'leaderboard', 'friendList', 'addFriends', 'matchmaking',
    'game', 'game4', 'spectate', 'spectate4', 'twoFactor', 'gameFinished', 'tournamentSemifinalFinished',
    'tournamentFinalFinished', 'spectatorGameFinished', 'profileDashboard', 'profileWinRateHistory',
        'contextMenu', 'settings', 'gameConfig', 'aiConfig', 'rules', 'goToMain', 'background'
    ]);

    if (knownPages.has(candidate))
        return candidate;

    // If the path does not match any known route, return the 404 identifier.
    return 'notFound';
}