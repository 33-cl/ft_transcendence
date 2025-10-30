// Export functions from friends.ts
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
} from '../pages/friends.js';

export async function friendListHTML() {
    try {
        const usersResponse = await fetch('/users', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!usersResponse.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const usersData = await usersResponse.json();
        const users = usersData.users || [];

        const leaderboardResponse = await fetch('/users/leaderboard?limit=1', {
            method: 'GET',
            credentials: 'include'
        });

        let firstRankUserId = null;
        if (leaderboardResponse.ok) {
            const leaderboardData = await leaderboardResponse.json();
            if (leaderboardData.leaderboard && leaderboardData.leaderboard.length > 0) {
                firstRankUserId = leaderboardData.leaderboard[0].id;
            }
        }

        let friendRequestsCount = 0;
        try {
            const requestsResponse = await fetch('/users/friend-requests/received', {
                method: 'GET',
                credentials: 'include'
            });

            if (requestsResponse.ok) {
                const requestsData = await requestsResponse.json();
                friendRequestsCount = (requestsData.requests || []).length;
            }
        } catch (error) {
            console.warn('Could not fetch friend requests count:', error);
        }

        let userItems = '';

        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/planet.gif';
            const isFirstRank = user.id === firstRankUserId;
            const crownIcon = isFirstRank ? '<img src="./img/gold-crown.png" alt="First place" class="crown-icon">' : '';
            
            const status = 'offline';
            const isInGame = false;
            const statusColor = '#666';
            const statusText = 'Offline';

            userItems += `
                <div id="profileBtn" class="friend friend-item" data-username="${user.username}" data-user-id="${user.id}" data-status="${status}" data-is-in-game="${isInGame}">
                    <div class="friend-avatar-container">
                        <img src="${avatarUrl}" alt="${user.username} Avatar" class="friend-avatar" 
                             onerror="this.onerror=null;this.src='./img/planet.gif';">
                        <div class="friend-status-indicator" 
                             style="background-color: ${statusColor};" 
                             title="${statusText}">
                        </div>
                    </div>
                    <p class="friend-name friend-username">
                        ${user.username}
                    </p>
                    <!--${crownIcon}-->
                </div>
            `;
        });

        if (userItems === '') {
            userItems = '<p class="friend-list-empty">No friends yet...</p>';
        }

        const requestsBadge = friendRequestsCount > 0 
            ? `<span class="friend-requests-badge">${friendRequestsCount}</span>`
            : '';

        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="relative">
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="friend-list-add-btn" title="Add Friends">
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
        
    } catch (error) {
        console.error('Error loading friends:', error);
        // Même en cas d'erreur, essayer de récupérer le nombre de demandes
        let friendRequestsCount = 0;
        try {
            const requestsResponse = await fetch('/users/friend-requests/received', {
                method: 'GET',
                credentials: 'include'
            });
            if (requestsResponse.ok) {
                const requestsData = await requestsResponse.json();
                friendRequestsCount = (requestsData.requests || []).length;
            }
        } catch (err) {
            console.warn('Could not fetch friend requests count in error handler:', err);
        }
        
        const requestsBadge = friendRequestsCount > 0 
            ? `<span class="friend-requests-badge">${friendRequestsCount}</span>`
            : '';

        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="relative">
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="friend-list-add-btn" title="Add Friends">
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
