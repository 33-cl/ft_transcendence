import { show, load , hideAllPages, hide } from '../navigation/utils.js';
import { spectateFreind } from '../friends/friendList.html.js';
import { checkSessionOnce } from '../auth/auth.js';
import { cleanupGameState } from '../game/gameCleanup.js';
import { initSettingsHandlers } from '../settings/settings.js';
import { setStarsHoverColor } from '../background/background.js';
import { initSessionBroadcast } from '../navigation/sessionBroadcast.js';
import { installAllSecurityGuards } from '../navigation/securityGuard.js';
import { preventBackNavigationAfterLogout, setupPopStateHandler, initNavigationOnLoad, getPageFromURL, replaceHistoryState } from '../navigation/navigation.js';
import '../config/config.js';
import '../landing/landing.js';
import '../friends/friends.js';

// Searches for a user by username across both users list and leaderboard
async function fetchUserByUsername(username: string)
{
    try
    {
        const response = await fetch(`/users`,
        {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok)
            throw new Error('Failed to fetch users');
        
        const data = await response.json();
        const users = data.users || [];
        
        const user = users.find((u: any) => u.username === username);
        
        // Fallback to leaderboard if user not found in main users list
        if (!user)
        {
            const leaderboardResponse = await fetch('/users/leaderboard',
            {
                method: 'GET',
                credentials: 'include'
            });
            
            if (leaderboardResponse.ok)
            {
                const leaderboardData = await leaderboardResponse.json();
                const leaderboard = leaderboardData.leaderboard || [];
                return leaderboard.find((u: any) => u.username === username);
            }
        }
        
        return user;
    }
    catch (error)
    {
        return null;
    }
}

// Removes a friend connection and refreshes the friend list UI
async function removeFriend(userId: number, _username: string)
{
    try
    {
        const response = await fetch(`/users/${userId}/friend`,
        {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove friend');
        }

        const friendListContainer = document.getElementById('friendList');
        if (friendListContainer)
        {
            const { friendListHTML, initializeAddFriendsButton, initLoadingIcons } = await import('../components/index.html.js');
            friendListContainer.innerHTML = await friendListHTML();
            initializeAddFriendsButton();
            initLoadingIcons();
        }
    }
    catch (error)
    {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert('Error removing friend: ' + errorMessage);
    }
}

// Sets up all UI event handlers and click listeners for SPA navigation
function initializeComponents(): void
{
    initSettingsHandlers();
    
    // Prevent duplicate listener registration across hot reloads
    if (window._navigationListenerSet)
        return;
    
    window._navigationListenerSet = true;
    
    // Debounce mechanism to prevent accidental double-clicks from triggering duplicate navigations
    let lastClickTime = 0;
    const CLICK_DEBOUNCE_MS = 300;
    
    // Main click handler for SPA navigation - handles all left-click routing
    if (!(document as any)._spaClickListenerSet)
    {
        (document as any)._spaClickListenerSet = true;
        
        document.addEventListener('click', async (e) =>
        {
            const now = Date.now();
            if (now - lastClickTime < CLICK_DEBOUNCE_MS)
            {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            lastClickTime = now;
            
            const target = e.target as HTMLElement;
            if (!target)
                return;
        
            // Walk up the DOM tree to detect if clicked element is a profile or settings button
            let currentElement: HTMLElement | null = target;
            let isProfileBtn = false;
            let isSettingsBtn = false;
            
            while (currentElement && !isProfileBtn && !isSettingsBtn)
            {
                if (currentElement.id === 'profileBtn')
                    isProfileBtn = true;
                else if (currentElement.id === 'settingsBtn')
                    isSettingsBtn = true;
                else
                    currentElement = currentElement.parentElement;
            }
            
            // Main menu navigation with complete game state cleanup to prevent paddle rendering bugs on subsequent games
            if (target.id === 'mainMenuBtn' || target.id === 'bacVk2main' || target.id === 'goToMain')
            {
                cleanupGameState();
                setStarsHoverColor(null);
                
                window.currentTournamentId = null;
                window.currentMatchId = null;
                window.isTournamentMode = false;
                
                // Ensure proper asynchronous room cleanup before proceeding to prevent state leaks
                if (window.socket && window.leaveCurrentRoomAsync)
                {
                    try
                    {
                        await window.leaveCurrentRoomAsync();
                    }
                    catch (error)
                    {
                        console.warn('Room cleanup failed, proceeding anyway:', error);
                    }
                }
                else if (window.socket)
                {
                    window.socket.emit('leaveAllRooms');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                await load('mainMenu');
            }
            
                   // Back to tournament (feature removed) — go back to main menu
                   if (target.id === 'backToTournamentBtn')
                   {
                       window.currentMatchId = null;
                       window.isTournamentMode = false;
                       cleanupGameState();
                       await load('mainMenu');
                   }
            
            if (target.id === 'profileCard')
            {
                window.selectedProfileUser = window.currentUser;
                await load('profile');
            }
            
            if (target.id === 'settingsBtn' || isSettingsBtn)
                await load('settings');
            
            // Detect clicks on any rules info button across different game modes
            let infoButton: HTMLElement | null = target;
            while (infoButton && !['localRulesInfoBtn', 'multiplayerRulesInfoBtn', 'tournamentsRulesInfoBtn'].includes(infoButton.id || ''))
                infoButton = infoButton.parentElement;
            
            if (infoButton && (infoButton.id === 'localRulesInfoBtn' || infoButton.id === 'multiplayerRulesInfoBtn' || infoButton.id === 'tournamentsRulesInfoBtn'))
            {
                if (infoButton.id === 'localRulesInfoBtn')
                    (window as any).rulesContext = 'local';
                else if (infoButton.id === 'multiplayerRulesInfoBtn')
                    (window as any).rulesContext = 'multiplayer';
                else
                    (window as any).rulesContext = 'tournament';

                await load('rules');
            }
            
            // Local 2-player game - let roomJoined handler manage page display to avoid double loading
            if (target.id === 'local2p')
            {
                window.lastGameType = 'local2p';
                await window.joinOrCreateRoom(2, true);
            }
            
            // Local 4-player game - same pattern as 2-player to prevent paddle bugs
            if (target.id === 'local4p')
            {
                window.lastGameType = 'local4p';
                await window.joinOrCreateRoom(4, true);
            }
            
            // AI game configuration entry point
            if (target.id === 'soloAi')
                await load('gameConfig');
            
            // Restart button logic - replays the same game type that just finished
            if (target.id === 'localGameBtn')
            {
                const lastGameType = window.lastGameType;
                if (lastGameType === 'soloAI')
                {
                    window.aiMode = true;
                    await window.joinOrCreateRoom(2, true);
                }
                else if (lastGameType === 'local4p')
                    await window.joinOrCreateRoom(4, true);
                else if (lastGameType === 'ranked1v1')
                {
                    await load('matchmaking');
                    try
                    {
                        await window.joinOrCreateRoom(2);
                    }
                    catch (error)
                    {
                        if (window.socket)
                            window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                    }
                }
                else if (lastGameType === 'multiplayer4p')
                {
                    await load('matchmaking');
                    try
                    {
                        await window.joinOrCreateRoom(4);
                    }
                    catch (error)
                    {
                        if (window.socket)
                            window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                    }
                }
                else
                    await window.joinOrCreateRoom(2, true);
            }
            
            if (target.id === 'signInBtn')
                await load('signIn');
            
            if (target.id === 'signUpBtn')        
                await load('signUp');
            
            // Profile navigation with user data extraction from either leaderboard or friend list
            if (target.id === 'profileBtn' || isProfileBtn)
            {
                // Ignore clicks from context menu as they have their own handler
                const contextMenu = document.getElementById('contextMenu');
                if (contextMenu && contextMenu.contains(target))
                    return;
                
                // Extract user information from either leaderboard data attributes or friend list elements
                let selectedUser = null;
                if (currentElement && currentElement.dataset && currentElement.dataset.username)
                {
                    const username = currentElement.dataset.username;
                    selectedUser = await fetchUserByUsername(username);
                }
                else if (target.closest('.friend'))
                {
                    const friendElement = target.closest('.friend');
                    const nameElement = friendElement?.querySelector('.friend-name');
                    if (nameElement)
                    {
                        const username = nameElement.textContent?.trim();
                        if (username)
                            selectedUser = await fetchUserByUsername(username);
                    }
                }
                
                window.selectedProfileUser = selectedUser;
                await load('profile');
            }
            
            // Match history navigation - loads detailed stats for a specific match
            if (target.classList.contains('match-item') && !target.classList.contains('no-click'))
            {
                const matchIndex = target.getAttribute('data-match-index');
                if (matchIndex !== null)
                {
                    const { getCachedMatches } = await import('../profile/profile.html.js');
                    const matches = getCachedMatches();
                    const match = matches[parseInt(matchIndex)];
                    if (match)
                    {
                        window.selectedMatchData = match;
                        try
                        {
                            sessionStorage.setItem('gameStatsMatchId', String(match.id));
                        }
                        catch (e)
                        {
                        }
                        await load('gameStats');
                    }
                }
            }
            
            // Logout with complete cleanup of session data and cache
            if (target.id === 'logOutBtn')
            {
                if (typeof window.logout === 'function')
                    await window.logout();
                else
                {
                    try
                    {
                        await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
                    }
                    catch (e)
                    {
                    }
                    window.currentUser = null;
                }
                
                // Clear browser cache for this application to ensure clean logout
                if ('caches' in window)
                {
                    try
                    {
                        const cacheNames = await caches.keys();
                        await Promise.all(
                            cacheNames.map(cacheName => caches.delete(cacheName))
                        );
                    }
                    catch (e)
                    {
                        console.warn('Failed to clear cache:', e);
                    }
                }

                sessionStorage.clear();
                
                preventBackNavigationAfterLogout();
                await load('signIn');
            }

            // Ranked 1v1 multiplayer matchmaking
            if (target.id === 'ranked1v1Btn')
            {
                window.lastGameType = 'ranked1v1';
                window.isTournamentMode = false;
                
                // Clean up any lingering room state before joining new game
                if (window.socket && window.leaveCurrentRoomAsync)
                {
                    try
                    {
                        await window.leaveCurrentRoomAsync();
                    }
                    catch (error)
                    {
                        console.warn('Pre-cleanup failed, proceeding anyway:', error);
                    }
                }
                
                try
                {
                    await window.joinOrCreateRoom(2);
                }
                catch (error)
                {
                    if (window.socket)
                        window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
            
            // 4-player multiplayer matchmaking
            if (target.id === 'multiplayer4pBtn')
            {
                window.lastGameType = 'multiplayer4p';
                window.isTournamentMode = false;
                
                if (window.socket && window.leaveCurrentRoomAsync)
                {
                    try
                    {
                        await window.leaveCurrentRoomAsync();
                    }
                    catch (error)
                    {
                        console.warn('Pre-cleanup failed, proceeding anyway:', error);
                    }
                }
                
                try
                {
                    await window.joinOrCreateRoom(4);
                }
                catch (error)
                {
                    if (window.socket)
                        window.socket.emit('error', { error: 'Failed to join game. Please try again.' });
                }
            }
            
            // Cancel matchmaking search and return to main menu
            if (target.id === 'cancelSearchBtn')
            {
                // Cleanup matchmaking intervals to prevent memory leaks
                if (window.cleanupMatchmakingIntervals) {
                    window.cleanupMatchmakingIntervals();
                }
                
                if (window.socket && window.leaveCurrentRoomAsync)
                {
                    try
                    {
                        await window.leaveCurrentRoomAsync();
                    }
                    catch (error)
                    {
                        console.warn('Room cleanup failed, proceeding anyway:', error);
                    }
                }
                else if (window.socket)
                {
                    window.socket.emit('leaveAllRooms');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                await load('mainMenu');
            }

            // Tournament mode initialization
            if (target.id === 'tournamentCreateBtn')
            {
                window.isTournamentMode = true;
                window.lastGameType = 'tournament';
                try
                {
                    await window.joinOrCreateRoom(4, false);
                }
                catch (error)
                {
                }
            }
        });
    }
    
    // Right-click context menu handler for friend list actions
    if (!(document as any)._spaContextMenuListenerSet)
    {
        (document as any)._spaContextMenuListenerSet = true;
        
        document.addEventListener('contextmenu', (e) =>
        {
            e.preventDefault();
            
            const target = e.target as HTMLElement;
            if (!target)
                return;
            
            // Walk up DOM to find if we right-clicked a profile button
            let currentElement: HTMLElement | null = target;
            let isProfileBtn = false;
            
            while (currentElement && !isProfileBtn)
            {
                if (currentElement.id === 'profileBtn')
                    isProfileBtn = true;
                else
                    currentElement = currentElement.parentElement;
            }
            
            if (isProfileBtn)
            {
                // Disable context menu for leaderboard profiles as they have limited actions
                const leaderboardContainer = document.getElementById('leaderboard');
                if (leaderboardContainer && leaderboardContainer.contains(currentElement))
                    return;
                
                // Extract user data from element attributes for context menu actions
                const username = currentElement?.getAttribute('data-username');
                const userId = currentElement?.getAttribute('data-user-id');
                const isInGame = currentElement?.getAttribute('data-is-in-game') === 'true';
                const canSpectate = currentElement?.getAttribute('data-can-spectate') === 'true';
                
                if (username && userId)
                    window.selectedContextUser = { username, userId: parseInt(userId), isInGame };

                window.contextMenuIsInGame = canSpectate;
                show('contextMenu');
                
                // Position context menu at cursor location
                const menu = document.getElementById('contextMenu');
                if (menu)
                {
                    menu.style.left = `${e.clientX}px`;
                    menu.style.top = `${e.clientY}px`;
                }
            }
        });
    }
    
    // Context menu action handler - processes profile, remove friend, and spectate actions
    if (!(document as any)._spaMenuClickListenerSet)
    {
        (document as any)._spaMenuClickListenerSet = true;
        
        document.addEventListener('click', async (e) =>
        {
            const menu = document.getElementById('contextMenu');
            if (!menu)
                return;
        
            if (!menu.innerHTML.trim())
                return;
        
            const target = e.target as HTMLElement;
            
            if (menu.contains(target))
            {
                if (target.id === 'profileBtn')
                {
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
                    const selectedUser = window.selectedContextUser;
                    if (selectedUser && selectedUser.userId)
                        removeFriend(selectedUser.userId, selectedUser.username);
                    
                    hide('contextMenu');
                    return;
                }
                
                if (target.id === 'spectateBtn')
                {
                    const selectedUser = window.selectedContextUser;
                    if (selectedUser && selectedUser.username)
                        spectateFreind(selectedUser.username);
                    
                    hide('contextMenu');
                    return;
                }
                return;
            }
        
            hide('contextMenu');
        });
    }
}

// Socket event handler for room joining - displays appropriate waiting or game screen
function setupRoomJoinedHandler()
{
    if (!window.socket)
        return;
    
    if (window._roomJoinedHandlerSet)
        return;
    
    window._roomJoinedHandlerSet = true;
    window.socket.on('roomJoined', async (data: any) =>
    {
        // Local games bypass matchmaking and go straight to game screen
        if (window.isLocalGame)
        {
            // Cleanup matchmaking intervals if any
            if (window.cleanupMatchmakingIntervals) {
                window.cleanupMatchmakingIntervals();
            }
            if (data.maxPlayers === 4)
                await load('game4');
            else
                await load('game');
            return;
        }
        
        // Display matchmaking screen until room is full
        if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
        {
            if (data.players < data.maxPlayers)
                await load('matchmaking');
            else
            {
                // Cleanup matchmaking intervals when game starts
                if (window.cleanupMatchmakingIntervals) {
                    window.cleanupMatchmakingIntervals();
                }
                
                // Tournament logic is handled in websocket.ts, this is fallback for regular games
                if (data.isTournament)
                {
                    if (data.maxPlayers === 2)
                        await load('game');
                }
                else if (data.maxPlayers === 4)
                    await load('game4');
                else
                    await load('game');
            }
        }
    });
}

setupPopStateHandler();

// Main initialization sequence - sets up security, session management, and determines initial page
initNavigationOnLoad(async () =>
{
    // Security guards must be installed first to intercept all network requests
    installAllSecurityGuards();
    
    // Initialize session broadcast to coordinate authentication across browser tabs
    await initSessionBroadcast();
    
    await checkSessionOnce();
    
    // Determine target page from URL or use default based on authentication state
    let targetPage = getPageFromURL();
    
    // First-time visitors see landing page if not authenticated and no specific page requested
    const isFirstVisit = !sessionStorage.getItem('hasVisited') && 
                         (targetPage === 'signIn' || targetPage === '') && 
                         !window.currentUser;
    
    if (isFirstVisit)
    {
        sessionStorage.setItem('hasVisited', 'true');
        replaceHistoryState('landing');
        await load('landing', undefined, false);
        initializeComponents();
        setupRoomJoinedHandler();
        return;
    }
    
    // Unauthenticated users are redirected to sign in except for allowed public pages
    if (!window.currentUser || !window.currentUser.username)
    {
        // Allow unauthenticated users to access sign-in, sign-up, landing, and two-factor pages directly
        if (targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'twoFactor' && targetPage !== 'landing' && targetPage !== 'notFound')
            targetPage = 'signIn';
        
        if (targetPage === 'landing')
            targetPage = 'signIn';
    }
    else
    {
        // Authenticated users cannot access auth pages or landing page
        if (targetPage === 'signIn' || targetPage === 'signUp' || targetPage === 'landing')
            targetPage = 'mainMenu';
        
        // Game pages are not accessible via direct URL to prevent state inconsistencies
        const gamePages = ['game', 'game4', 'matchmaking', 'gameFinished', 'spectatorGameFinished', 'spectate', 'spectate4'];
        if (gamePages.includes(targetPage))
            targetPage = 'mainMenu';
    }
    
    // Replace history state instead of pushing to avoid back button issues
    replaceHistoryState(targetPage);
    load(targetPage, undefined, false);
    initializeComponents();
    setupRoomJoinedHandler();
});

export { show, hideAllPages, hide };