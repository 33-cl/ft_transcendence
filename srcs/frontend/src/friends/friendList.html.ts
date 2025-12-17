// We re-export these utility functions to ensure they are available to other modules that import from this file
export {
    initializeFriendListEventListeners,
    initializeAddFriendsButton,
    startFriendListRealtimeUpdates,
    stopFriendListRealtimeUpdates,
    fetchInitialFriendStatuses,
    spectateFreind,
    initLoadingIcons,
    destroyLoadingIcons,
    updateFriendRequestsBadge
} from './friends.js';
import { getSafeAvatarUrl } from '../services/avatarProxy.js';

// This function generates the HTML structure for the friends sidebar, fetching necessary data asynchronously
export async function friendListHTML()
{
    try
    {
        // We attempt to retrieve the current user's friend list from the backend
        const usersResponse = await fetch('/users', {
            method: 'GET',
            credentials: 'include'
        });

        if (!usersResponse.ok)
            throw new Error('Failed to fetch users');

        const usersData = await usersResponse.json();
        const users = usersData.users || [];


        // We check for incoming friend requests to display a notification badge on the 'Add Friend' button
        let friendRequestsCount = 0;
        try
        {
            const requestsResponse = await fetch('/users/friend-requests/received', {
                method: 'GET',
                credentials: 'include'
            });

            if (requestsResponse.ok)
            {
                const requestsData = await requestsResponse.json();
                friendRequestsCount = (requestsData.requests || []).length;
            }
        }
        catch (error)
        {
            console.warn('Could not fetch friend requests count:', error);
        }

        let userItems = '';

        // We iterate through the list of friends to construct their individual HTML cards
        users.forEach((user: any) =>
        {
            const avatarUrl = getSafeAvatarUrl(user.avatar_url);

            const status = 'offline';
            const isInGame = false;
            const statusColor = '#666';
            const statusText = 'Offline';

            userItems += `
                <div id="profileBtn" class="friend friend-item" data-username="${user.username}" data-user-id="${user.id}" data-status="${status}" data-is-in-game="${isInGame}">
                    <div class="friend-avatar-container">
                        <img src="${avatarUrl}" alt="${user.username} Avatar" class="friend-avatar" 
                            onerror="this.onerror=null;this.src='/img/planet.gif';">
                        <div class="friend-status-indicator" 
                             style="background-color: ${statusColor};" 
                             title="${statusText}">
                        </div>
                    </div>
                    <p class="friend-name friend-username">
                        ${user.username}
                    </p>
                    </div>
            `;
        });

        if (userItems === '')
            userItems = '<p class="friend-list-empty">No friends yet...</p>';

        const requestsBadge = friendRequestsCount > 0
            ? `<span class="friend-requests-badge">${friendRequestsCount}</span>`
            : '';

        // We return the fully assembled HTML string for the friends list panel
        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="friend-list-header">
                    <div class="friend-header-btn-placeholder"></div>
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="friend-header-btn right" title="Add Friends">
                        <img src="./img/add-friend-icon.svg" alt="Add Friend">
                        ${requestsBadge}
                    </button>
                </div>
                <hr>
                <div id="friendsList">
                    ${userItems}
                </div>
            </div>
        `;

    }
    catch (error)
    {
        // Even if the main friend list fails to load, we try to fetch the request count to ensure the user sees pending invites
        let friendRequestsCount = 0;
        try
        {
            const requestsResponse = await fetch('/users/friend-requests/received', {
                method: 'GET',
                credentials: 'include'
            });
            if (requestsResponse.ok)
            {
                const requestsData = await requestsResponse.json();
                friendRequestsCount = (requestsData.requests || []).length;
            }
        }
        catch (err)
        {
            console.warn('Could not fetch friend requests count in error handler:', err);
        }

        const requestsBadge = friendRequestsCount > 0
            ? `<span class="friend-requests-badge">${friendRequestsCount}</span>`
            : '';

        // If the main fetch failed, we return the structure with an error message but keep the header functional
        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="friend-list-header">
                    <div class="friend-header-btn-placeholder"></div>
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="friend-header-btn right" title="Add Friends">
                        <img src="./img/add-friend-icon.svg" alt="Add Friend">
                        ${requestsBadge}
                    </button>
                </div>
                <hr>
                <p class="friend-list-error">Error loading friends</p>
            </div>
        `;
    }
}