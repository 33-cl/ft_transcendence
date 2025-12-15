import { getSafeAvatarUrl } from '../services/avatarProxy.js';

/**
 * Ajoute un ami en envoyant une demande
 */
async function addFriend(userId: number, buttonElement?: HTMLButtonElement): Promise<void> {
    try {
        const response = await fetch(`/users/${userId}/friend`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add friend');
        }

        // Mettre à jour le bouton pour afficher "Sent" au lieu de "Add"
        if (buttonElement) {
            buttonElement.textContent = 'Sent';
            buttonElement.disabled = true;
            buttonElement.classList.remove('active');
            buttonElement.classList.add('sent');
        }
    } catch (error) {
    }
}

/**
 * Accepte une demande d'ami
 */
async function acceptFriendRequest(requestId: number): Promise<void> {
    try {
        const response = await fetch(`/users/friend-requests/${requestId}/accept`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to accept friend request');
        }

        // Refresh friend requests list
        await refreshFriendRequests();

        // Update badge in friend list
        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();
    } catch (error) {
    }
}

/**
 * Rejette une demande d'ami
 */
async function rejectFriendRequest(requestId: number): Promise<void> {
    try {
        const response = await fetch(`/users/friend-requests/${requestId}/reject`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reject friend request');
        }

        // Refresh friend requests list
        await refreshFriendRequests();

        // Update badge in friend list
        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();
    } catch (error) {
    }
}

/**
 * Rafraîchit la liste des demandes d'amis
 */
async function refreshFriendRequests(): Promise<void> {
    try {
        const response = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch friend requests');
        }

        const data = await response.json();
        const friendRequests = data.requests || [];

        const requestsList = document.getElementById('friendRequestsList');
        if (!requestsList) return;

        let requestsHTML = '';
        if (friendRequests.length > 0) {
            requestsHTML = friendRequests.map((request: any) => `
                <div class="friend-request-item">
                    <img src="${getSafeAvatarUrl(request.avatar_url)}" 
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

        requestsList.innerHTML = requestsHTML;

        // Réinitialiser les event listeners
        initializeFriendRequestListeners();
    } catch (error) {
    }
}

/**
 * Initialise les event listeners pour la recherche d'amis
 */
export function initializeAddFriendSearch(): void {
    const searchInput = document.getElementById('friendSearch') as HTMLInputElement;
    const searchResults = document.getElementById('searchResults');
    let searchTimeout: number;

    if (searchInput && searchResults && !(searchInput as any)._listenerSet) {
        (searchInput as any)._listenerSet = true;
        
        searchInput.addEventListener('input', async (e) => {
            const query = (e.target as HTMLInputElement).value.trim();
            
            // Effacer le timeout précédent
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            if (query.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }

            // Délai pour éviter trop de requêtes
            searchTimeout = window.setTimeout(async () => {
                try {
                    const response = await fetch(`/users/search?q=${encodeURIComponent(query)}`, {
                        method: 'GET',
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error('Failed to search users');
                    }

                    const data = await response.json();
                    const users = data.users || [];

                    // Import security utilities
                    const { escapeHtml } = await import('../navigation/security.js');

                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="search-no-results">No users found</div>';
                    } else {
                        searchResults.innerHTML = users.map((user: any) => {
                            // Déterminer l'état du bouton
                            const buttonState = user.hasPendingRequest 
                                ? { text: 'Sent', class: 'sent', disabled: true }
                                : { text: 'Add', class: 'active', disabled: false };
                            
                            // SECURITY: Escape all user-controlled content to prevent XSS
                            const safeUserId = parseInt(user.id) || 0;
                            const safeUsername = escapeHtml(user.username || 'Unknown');
                            const safeAvatarUrl = getSafeAvatarUrl(user.avatar_url);
                            
                            return `
                                <div class="search-result-item" data-user-id="${safeUserId}">
                                    <img src="${safeAvatarUrl}" 
                                         alt="${safeUsername}"
                                         onerror="this.onerror=null;this.src='./img/planet.gif';">
                                    <span>${safeUsername}</span>
                                    <button class="add-friend-btn ${buttonState.class}" 
                                            data-user-id="${safeUserId}"
                                            ${buttonState.disabled ? 'disabled' : ''}>
                                        ${buttonState.text}
                                    </button>
                                </div>
                            `;
                        }).join('');

                        // Ajouter les event listeners pour les boutons d'ajout
                        const addButtons = searchResults.querySelectorAll('.add-friend-btn');
                        addButtons.forEach(button => {
                            button.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const buttonElement = e.target as HTMLButtonElement;
                                const userId = parseInt(buttonElement.dataset.userId || '0');
                                if (userId && !buttonElement.disabled) {
                                    await addFriend(userId, buttonElement);
                                }
                            });
                        });
                    }

                    searchResults.classList.remove('hidden');
                } catch (error) {
                    searchResults.innerHTML = '<div class="search-error">Error searching users</div>';
                    searchResults.classList.remove('hidden');
                }
            }, 300);
        });

        // Masquer les résultats quand on clique ailleurs
        if (!(document as any)._friendSearchClickListenerSet) {
            (document as any)._friendSearchClickListenerSet = true;
            
            document.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (!searchInput.contains(target) && !searchResults.contains(target)) {
                    searchResults.classList.add('hidden');
                }
            });
        }
    }
}

/**
 * Initialise le bouton retour vers la liste d'amis
 */
export function initializeBackToFriendsButton(): void {
    const backBtn = document.getElementById('backToFriendsBtn');
    if (backBtn && !(backBtn as any)._listenerSet) {
        (backBtn as any)._listenerSet = true;
        
        backBtn.addEventListener('click', async () => {
            const { show, hide } = await import('../navigation/utils.js');
            const { initializeAddFriendsButton, initializeFriendListEventListeners, startFriendListRealtimeUpdates, fetchInitialFriendStatuses } = await import('./friendList.html.js');
            
            // Hide addFriends and show friendList
            hide('addFriends');
            await show('friendList');
            
            // Réinitialiser les fonctionnalités de friendList
            setTimeout(async () => {
                initializeAddFriendsButton();
                initializeFriendListEventListeners();
                startFriendListRealtimeUpdates(); // Enable real-time updates via WebSocket
                
                // Always refresh statuses when returning to friendList
                await fetchInitialFriendStatuses();
                
                // Update badge when showing friendList
                const { updateFriendRequestsBadge } = await import('./friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
        });
    }
}

/**
 * Initialise les event listeners des demandes d'amis
 */
export function initializeFriendRequestListeners(): void {
    // Event listeners pour les boutons d'acceptation
    const acceptButtons = document.querySelectorAll('.friend-request-accept-btn');
    acceptButtons.forEach(button => {
        // Remove existing listeners by cloning the button
        const newButton = button.cloneNode(true) as HTMLElement;
        button.parentNode?.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            if (btn.disabled) return; // Prevent double-click
            
            const requestId = parseInt(btn.dataset.requestId || '0');
            if (requestId) {
                btn.disabled = true;
                btn.textContent = '...';
                await acceptFriendRequest(requestId);
            }
        });
    });

    // Event listeners pour les boutons de rejet
    const rejectButtons = document.querySelectorAll('.friend-request-reject-btn');
    rejectButtons.forEach(button => {
        // Remove existing listeners by cloning the button
        const newButton = button.cloneNode(true) as HTMLElement;
        button.parentNode?.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            if (btn.disabled) return; // Prevent double-click
            
            const requestId = parseInt(btn.dataset.requestId || '0');
            if (requestId) {
                btn.disabled = true;
                btn.textContent = '...';
                await rejectFriendRequest(requestId);
            }
        });
    });
}

// ============================================
// FriendList Logic
// ============================================

let friendListSocketListenersActive = false;

export function initializeFriendListEventListeners(): void {
    const spectateButtons = document.querySelectorAll('.spectate-btn');
    spectateButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const username = (e.target as HTMLElement).dataset.username;
            if (username) {
                await spectateFreind(username);
            }
        });
    });
}

export function initializeAddFriendsButton(): void {
    const addFriendsBtn = document.getElementById('addFriendsBtn');
    if (addFriendsBtn && !(addFriendsBtn as any)._addFriendsListenerSet) {
        (addFriendsBtn as any)._addFriendsListenerSet = true;
        
        addFriendsBtn.addEventListener('click', async () => {
            const { show, hide } = await import('../navigation/utils.js');
            
            hide('friendList');
            await show('addFriends');
            
            setTimeout(() => {
                initializeAddFriendSearch();
                initializeBackToFriendsButton();
                initializeFriendRequestListeners();
            }, 100);
        });
    }
}

export function startFriendListRealtimeUpdates(): void {
    if (!window.socket || friendListSocketListenersActive) {
        return;
    }

    window.socket.on('friendStatusChanged', (data: { username: string; status: string; timestamp: number }) => {
        updateFriendStatus(data.username, data.status);
        
        // 🎯 Mettre à jour le menu contextuel si ouvert pour cet utilisateur
        updateContextMenuForUser(data.username, data.status);
    });

    window.socket.on('friendAdded', (_data: { friend: { id: number; username: string }; timestamp: number }) => {
        reloadFriendList();
    });

    window.socket.on('friendRemoved', (_data: { friendId: number; timestamp: number }) => {
        reloadFriendList();
    });

    window.socket.on('profileUpdated', async (data: { userId: number; username: string; avatar_url: string; timestamp: number }) => {
        updateFriendProfile(data.userId, data.username, data.avatar_url);
        
        // Rafraîchir le leaderboard quand un profil est mis à jour
        const leaderboardContainer = document.getElementById('leaderboard');
        if (leaderboardContainer) {
            const { leaderboardHTML } = await import('../leaderboard/leaderboard.html.js');
            leaderboardContainer.innerHTML = await leaderboardHTML();
        }
    });

    window.socket.on('friendRequestReceived', (_data: { sender: { id: number; username: string }; timestamp: number }) => {
        updateFriendRequestsBadge();
    });

    friendListSocketListenersActive = true;
    fetchInitialFriendStatuses();
}

export async function fetchInitialFriendStatuses(): Promise<void> {
    try {
        const response = await fetch('/users/friends-online', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const friendsStatus = data.friendsStatus || [];
        
        for (const friend of friendsStatus) {
            updateFriendStatus(friend.username, friend.status);
        }
    } catch (error) {
    }
}

export function stopFriendListRealtimeUpdates(): void {
    if (!window.socket || !friendListSocketListenersActive) {
        return;
    }

    window.socket.off('friendStatusChanged');
    window.socket.off('friendAdded');
    window.socket.off('friendRemoved');
    window.socket.off('profileUpdated');
    window.socket.off('friendRequestReceived');

    friendListSocketListenersActive = false;
}

function updateFriendStatus(username: string, status: string): void {
    const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
    if (!friendElement) return;

    const statusIndicator = friendElement.querySelector('.friend-status-indicator') as HTMLElement;
    if (!statusIndicator) return;

    let statusColor = '#666';
    let statusText = 'Offline';
    if (status === 'online') {
        statusColor = '#4CAF50';
        statusText = 'Online';
    } else if (status === 'in-game') {
        statusColor = '#FF9800';
        statusText = 'In Game';
    }

    statusIndicator.style.backgroundColor = statusColor;
    statusIndicator.title = statusText;
    friendElement.setAttribute('data-status', status);
    friendElement.setAttribute('data-is-in-game', status === 'in-game' ? 'true' : 'false');


}

/**
 * Met à jour le menu contextuel si ouvert pour un utilisateur dont le statut change
 * Si l'utilisateur n'est plus en jeu, on retire le bouton Spectate
 */
function updateContextMenuForUser(username: string, status: string): void {
    const selectedUser = window.selectedContextUser;
    
    // Vérifier si le menu contextuel est ouvert pour cet utilisateur
    if (!selectedUser || selectedUser.username !== username) {
        return;
    }
    
    const menu = document.getElementById('contextMenu');
    if (!menu || !menu.innerHTML.trim()) {
        return; // Menu pas affiché
    }
    
    const spectateBtn = document.getElementById('spectateBtn');
    const isInGame = status === 'in-game';
    
    // Mettre à jour l'état stocké
    selectedUser.isInGame = isInGame;
    window.contextMenuIsInGame = isInGame;
    
    if (!isInGame && spectateBtn) {
        // L'ami n'est plus en game → retirer le bouton Spectate
        spectateBtn.remove();
    } else if (isInGame && !spectateBtn) {
        // L'ami est maintenant en game → ajouter le bouton Spectate
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.insertAdjacentHTML('afterend', '<li id="spectateBtn">Spectate</li>');
        }
    }
}

function updateFriendProfile(userId: number, newUsername: string, newAvatarUrl: string): void {
    const friendElement = document.querySelector(`#friendsList [data-user-id="${userId}"]`);
    if (!friendElement) return;

    const friendNameElement = friendElement.querySelector('.friend-username') as HTMLElement;
    if (friendNameElement) {
        const animation = friendNameElement.querySelector('.mini-pong-animation');
        friendNameElement.textContent = newUsername;
        if (animation) {
            friendNameElement.appendChild(animation);
        }
    }

    const avatarElement = friendElement.querySelector('.friend-avatar') as HTMLImageElement;
    if (avatarElement && newAvatarUrl) {
        avatarElement.src = newAvatarUrl;
    }

    friendElement.setAttribute('data-username', newUsername);
}

async function reloadFriendList(): Promise<void> {
    const friendListContainer = document.getElementById('friendList');
    if (!friendListContainer || friendListContainer.innerHTML.trim() === '') {
        return;
    }

    try {
        const { friendListHTML } = await import('./friendList.html.js');
        const newHTML = await friendListHTML();
        friendListContainer.innerHTML = newHTML;
        initializeAddFriendsButton();
        initializeFriendListEventListeners();
        
        setTimeout(async () => {
            await fetchInitialFriendStatuses();
        }, 100);
    } catch (error) {
    }
}

export async function spectateFreind(username: string): Promise<void> {
    try {
        const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
        const isInGame = friendElement?.getAttribute('data-is-in-game') === 'true';
        
        if (!isInGame)
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
        
        if (window.socket && window.socket.connected) {
            window.socket.emit('joinRoom', { 
                roomName: roomData.roomName,
                spectator: true 
            });
            
            const { load } = await import('../navigation/utils.js');
            await load('game');
        } else {
            alert('WebSocket connection not available');
        }
    } catch (error: any) {
        alert('Failed to spectate friend: ' + (error.message || 'Unknown error'));
    }
}

export function initLoadingIcons(): void {}
export function destroyLoadingIcons(): void {}

export async function updateFriendRequestsBadge(): Promise<void> {
    try {
        const requestsResponse = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });

        if (!requestsResponse.ok) return;

        const requestsData = await requestsResponse.json();
        const friendRequestsCount = (requestsData.requests || []).length;

        const addFriendsBtn = document.getElementById('addFriendsBtn');
        if (!addFriendsBtn) return;

        let badge = addFriendsBtn.querySelector('.friend-requests-badge') as HTMLElement;

        if (friendRequestsCount > 0) {
            if (badge) {
                badge.textContent = friendRequestsCount.toString();
            } else {
                const badgeHTML = `<span class="friend-requests-badge">${friendRequestsCount}</span>`;
                addFriendsBtn.insertAdjacentHTML('beforeend', badgeHTML);
            }
        } else {
            if (badge) {
                badge.remove();
            }
        }
    } catch (error) {
    }
}

// Initialize handlers
document.addEventListener('componentsReady', () => {
    const addFriendsElement = document.getElementById('addFriends');
    if (addFriendsElement && addFriendsElement.innerHTML !== '') {
        initializeAddFriendSearch();
        initializeBackToFriendsButton();
        initializeFriendRequestListeners();
    }
    
    const friendListElement = document.getElementById('friendList');
    if (friendListElement && friendListElement.innerHTML !== '') {
        initializeAddFriendsButton();
        initializeFriendListEventListeners();
    }
});
