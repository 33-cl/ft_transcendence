import { initializeAddFriendSearch, initializeBackToFriendsButton, initializeFriendRequestListeners } from './addFriends.js';

// Add-friends related helpers are moved to ./addFriends.ts

let friendListSocketListenersActive = false;

// Initializes listeners for user actions within the friend list, such as clicking 'Spectate'
export function initializeFriendListEventListeners(): void
{
    const spectateButtons = document.querySelectorAll('.spectate-btn');
    spectateButtons.forEach(button =>
    {
        button.addEventListener('click', async (e) =>
        {
            e.stopPropagation();
            const username = (e.target as HTMLElement).dataset.username;
            if (username)
            {
                await spectateFreind(username);
            }
        });
    });
}

// Sets up the button that navigates the user to the 'Add Friends' search interface
export function initializeAddFriendsButton(): void
{
    const addFriendsBtn = document.getElementById('addFriendsBtn');
    if (addFriendsBtn && !(addFriendsBtn as any)._addFriendsListenerSet)
    {
        (addFriendsBtn as any)._addFriendsListenerSet = true;

        addFriendsBtn.addEventListener('click', async () =>
        {
            const { show, hide } = await import('../navigation/utils.js');

            hide('friendList');
            await show('addFriends');

            setTimeout(() =>
            {
                initializeAddFriendSearch();
                initializeBackToFriendsButton();
                initializeFriendRequestListeners();
            }, 100);
        });
    }
}

// Establishes WebSocket event listeners to keep the friend list synchronized with the server in real-time

export function startFriendListRealtimeUpdates(): void
{
    // We implement a check to ensure we don't attach duplicate listeners if they are already active
    if (!window.socket || friendListSocketListenersActive)
    {
        return;
    }

    // Listens for status changes (Online, Offline, In-Game) and updates the UI and Context Menu
    window.socket.on('friendStatusChanged', (data: { username: string; status: string; timestamp: number }) =>
    {
        updateFriendStatus(data.username, data.status);

        updateContextMenuForUser(data.username, data.status);
    });

    // Triggers a full list reload when the user adds a new friend
    window.socket.on('friendAdded', async (_data: { friend: { id: number; username: string }; timestamp: number }) =>
    {
        reloadFriendList();
        // Also refresh friend requests badge (in case of auto-accept from race condition fix)
        updateFriendRequestsBadge();
        // Refresh the friend requests list if the panel is open
        const { refreshFriendRequests } = await import('./addFriends.js');
        refreshFriendRequests();
    });

    // Triggers a full list reload when a friend is removed
    window.socket.on('friendRemoved', (_data: { friendId: number; timestamp: number }) =>
    {
        reloadFriendList();
    });

    // Updates specific profile elements (Name/Avatar) when a friend updates their profile
    window.socket.on('profileUpdated', async (data: { userId: number; username: string; avatar_url: string; timestamp: number }) =>
    {
        updateFriendProfile(data.userId, data.username, data.avatar_url);

        const leaderboardContainer = document.getElementById('leaderboard');
        if (leaderboardContainer)
        {
            const { leaderboardHTML } = await import('../leaderboard/leaderboard.html.js');
            leaderboardContainer.innerHTML = await leaderboardHTML();
        }
    });

    // Updates the notification badge when a new friend request is received
    window.socket.on('friendRequestReceived', (_data: { sender: { id: number; username: string }; timestamp: number }) =>
    {
        updateFriendRequestsBadge();
    });

    friendListSocketListenersActive = true;
    fetchInitialFriendStatuses();
}

// Performs an initial fetch of friend statuses to populate the list correctly on load
export async function fetchInitialFriendStatuses(): Promise<void>
{
    try
    {
        const response = await fetch('/users/friends-online', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok)
        {
            return;
        }

        const data = await response.json();
        const friendsStatus = data.friendsStatus || [];

        for (const friend of friendsStatus)
        {
            updateFriendStatus(friend.username, friend.status);
        }
    }
    catch (error)
    {
    }
}

// Detaches all WebSocket listeners to prevent memory leaks or unwanted updates when leaving the view
export function stopFriendListRealtimeUpdates(): void
{
    if (!window.socket || !friendListSocketListenersActive)
    {
        return;
    }

    window.socket.off('friendStatusChanged');
    window.socket.off('friendAdded');
    window.socket.off('friendRemoved');
    window.socket.off('profileUpdated');
    window.socket.off('friendRequestReceived');

    friendListSocketListenersActive = false;
}

// Updates the visual indicators (color and text) for a friend's online status
function updateFriendStatus(username: string, status: string): void
{
    const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
    if (!friendElement)
        return;

    const statusIndicator = friendElement.querySelector('.friend-status-indicator') as HTMLElement;
    if (!statusIndicator)
        return;

    let statusColor = '#666';
    let statusText = 'Offline';
    if (status === 'online')
    {
        statusColor = '#4CAF50';
        statusText = 'Online';
    }
    else if (status === 'in-game' || status === 'in-tournament')
    {
        statusColor = '#FF9800';
        statusText = status === 'in-tournament' ? 'In Tournament' : 'In Game';
    }

    statusIndicator.style.backgroundColor = statusColor;
    statusIndicator.title = statusText;
    friendElement.setAttribute('data-status', status);

    const isInGame = status === 'in-game' || status === 'in-tournament';
    friendElement.setAttribute('data-is-in-game', isInGame ? 'true' : 'false');

    // We specifically mark whether spectating is allowed (only in normal games, not tournaments)
    friendElement.setAttribute('data-can-spectate', status === 'in-game' ? 'true' : 'false');
}

// Dynamically modifies the open context menu to show or hide the 'Spectate' button based on the target's status
function updateContextMenuForUser(username: string, status: string): void
{
    const selectedUser = window.selectedContextUser;

    if (!selectedUser || selectedUser.username !== username)
    {
        return;
    }

    const menu = document.getElementById('contextMenu');
    if (!menu || !menu.innerHTML.trim())
    {
        return;
    }

    const spectateBtn = document.getElementById('spectateBtn');
    const canSpectate = status === 'in-game';
    const isInGame = status === 'in-game' || status === 'in-tournament';

    selectedUser.isInGame = isInGame;
    window.contextMenuIsInGame = canSpectate;

    if (!canSpectate && spectateBtn)
    {
        spectateBtn.remove();
    }
    else if (canSpectate && !spectateBtn)
    {
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn)
        {
            profileBtn.insertAdjacentHTML('afterend', '<li id="spectateBtn">Spectate</li>');
        }
    }
}

// Updates the DOM elements for a friend's username and avatar when they edit their profile
function updateFriendProfile(userId: number, newUsername: string, newAvatarUrl: string): void
{
    const friendElement = document.querySelector(`#friendsList [data-user-id="${userId}"]`);
    if (!friendElement)
        return;

    const friendNameElement = friendElement.querySelector('.friend-username') as HTMLElement;
    if (friendNameElement)
    {
        const animation = friendNameElement.querySelector('.mini-pong-animation');
        friendNameElement.textContent = newUsername;
        if (animation)
        {
            friendNameElement.appendChild(animation);
        }
    }

    const avatarElement = friendElement.querySelector('.friend-avatar') as HTMLImageElement;
    if (avatarElement && newAvatarUrl)
    {
        avatarElement.src = newAvatarUrl;
    }

    friendElement.setAttribute('data-username', newUsername);
}

// Reloads the entire friend list HTML from the module to ensure consistency after additions or removals
async function reloadFriendList(): Promise<void>
{
    const friendListContainer = document.getElementById('friendList');
    if (!friendListContainer || friendListContainer.innerHTML.trim() === '')
    {
        return;
    }

    try
    {
        const { friendListHTML } = await import('./friendList.html.js');
        const newHTML = await friendListHTML();
        friendListContainer.innerHTML = newHTML;
        initializeAddFriendsButton();
        initializeFriendListEventListeners();

        setTimeout(async () =>
        {
            await fetchInitialFriendStatuses();
        }, 100);
    }
    catch (error)
    {
    }
}

// Handles the logic for a user attempting to spectate a friend's game
export async function spectateFreind(username: string): Promise<void>
{
    try
    {
        const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
        const canSpectate = friendElement?.getAttribute('data-can-spectate') === 'true';

        if (!canSpectate)
            return;

        const response = await fetch(`/rooms/friend/${username}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok)
        {
            const error = await response.json();
            if (response.status === 403)
                alert('You can only spectate friends.');
            else if (response.status === 401)
                alert('Authentication required. Please log in.');
            else
                console.warn('Error finding game: ' + (error.error || 'Unknown error'));
            return;
        }

        const roomData = await response.json();

        if (window.socket && window.socket.connected)
        {
            window.socket.emit('joinRoom', {
                roomName: roomData.roomName,
                spectator: true
            });

            const { load } = await import('../navigation/utils.js');
            await load('game');
        }
        else
        {
            alert('WebSocket connection not available');
        }
    }
    catch (error: any)
    {
        alert('Failed to spectate friend: ' + (error.message || 'Unknown error'));
    }
}

export function initLoadingIcons(): void {}
export function destroyLoadingIcons(): void {}

// Fetches the current count of received friend requests and updates the notification badge
export async function updateFriendRequestsBadge(): Promise<void>
{
    try
    {
        const requestsResponse = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });

        if (!requestsResponse.ok)
            return;

        const requestsData = await requestsResponse.json();
        const friendRequestsCount = (requestsData.requests || []).length;

        const addFriendsBtn = document.getElementById('addFriendsBtn');
        if (!addFriendsBtn)
            return;

        let badge = addFriendsBtn.querySelector('.friend-requests-badge') as HTMLElement;

        if (friendRequestsCount > 0)
        {
            if (badge)
            {
                badge.textContent = friendRequestsCount.toString();
            }
            else
            {
                const badgeHTML = `<span class="friend-requests-badge">${friendRequestsCount}</span>`;
                addFriendsBtn.insertAdjacentHTML('beforeend', badgeHTML);
            }
        }
        else
        {
            if (badge)
            {
                badge.remove();
            }
        }
    }
    catch (error)
    {
    }
}

// We rely on a global event to initialize the components once the DOM is fully ready
document.addEventListener('componentsReady', () =>
{
    const addFriendsElement = document.getElementById('addFriends');
    if (addFriendsElement && addFriendsElement.innerHTML !== '')
    {
        initializeAddFriendSearch();
        initializeBackToFriendsButton();
        initializeFriendRequestListeners();
    }

    const friendListElement = document.getElementById('friendList');
    if (friendListElement && friendListElement.innerHTML !== '')
    {
        initializeAddFriendsButton();
        initializeFriendListEventListeners();
    }
});