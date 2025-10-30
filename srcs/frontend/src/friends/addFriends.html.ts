// Export functions from friends.ts
export { initializeAddFriendSearch, initializeBackToFriendsButton, initializeFriendRequestListeners } from './friends.js';

export async function addFriendsHTML() {
    
    // Récupérer les demandes d'amis reçues
    let friendRequests: any[] = [];
    try {
        const response = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            friendRequests = data.requests || [];
        }
    } catch (error) {
        console.error('Error fetching friend requests:', error);
    }
    
    let requestsHTML = '';
    if (friendRequests.length > 0) {
        requestsHTML = friendRequests.map((request: any) => `
            <div class="friend-request-item">
                <img src="${request.avatar_url || './img/planet.gif'}" 
                     alt="${request.username}"
                     onerror="this.onerror=null;this.src='./img/planet.gif';">
                <span>${request.username}</span>
                <button class="friend-request-accept-btn" 
                        data-request-id="${request.request_id}">
                    ✓
                </button>
                <button class="friend-request-reject-btn" 
                        data-request-id="${request.request_id}">
                    ✗
                </button>
            </div>
        `).join('');
    } else {
        requestsHTML = '<p class="friend-requests-empty">No friend requests</p>';
    }
    
    return /*html*/`
        <div id="addFriends" class="user-list">
            <div class="relative">
                <h2>Friends</h2>
                <button id="backToFriendsBtn" class="add-friends-back-btn" title="Back to Friends">
                    <img src="./img/back-to-list-arrow.svg" alt="Back to Friends">
                </button>
            </div>
            <div class="add-friends-search-container">
                <input 
                    type="text" 
                    id="friendSearch" 
                    placeholder="Search users..." 
                    class="add-friends-search-input"
                    autocomplete="off"
                >
                <div id="searchResults" class="add-friends-search-results hidden"></div>
            </div>
            <hr>
            <h3 class="add-friends-section-title">Friend Requests</h3>
            <div id="friendRequestsList" class="add-friends-requests-list">
                ${requestsHTML}
            </div>
        </div>
    `;
}
