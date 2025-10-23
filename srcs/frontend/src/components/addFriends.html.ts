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
            <div class="flex items-center p-2 border-b border-gray-700 gap-2 pointer-events-auto">
                <img src="${request.avatar_url || './img/planet.gif'}" 
                     alt="${request.username}" 
                     class="w-10 h-10 rounded-full"
                     onerror="this.onerror=null;this.src='./img/planet.gif';">
                <span class="flex-1 text-sm">${request.username}</span>
                <button class="accept-request-btn bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700" 
                        data-request-id="${request.request_id}">
                    ✓
                </button>
                <button class="reject-request-btn bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700" 
                        data-request-id="${request.request_id}">
                    ✗
                </button>
            </div>
        `).join('');
    } else {
        requestsHTML = '<p class="text-center text-gray-400 text-sm mt-2">No friend requests</p>';
    }
    
    return /*html*/`
        <div id="addFriends" class="user-list">
            <div class="relative">
                <h2>Friends</h2>
                <button id="backToFriendsBtn" class="absolute top-0 right-0 w-8 h-8 bg-black hover:bg-gray-900 border border-gray-600 rounded flex items-center justify-center transition-colors p-1.5" title="Back to Friends">
                    <img src="./img/back-to-list-arrow.svg" alt="Back to Friends" class="w-full h-full">
                </button>
            </div>
            <div class="search-container my-2.5">
                <input 
                    type="text" 
                    id="friendSearch" 
                    placeholder="Search users..." 
                    class="search-input w-full px-2 py-2 border border-gray-600 rounded bg-gray-800 text-white text-sm pointer-events-auto"
                    autocomplete="off"
                >
                <div id="searchResults" class="search-results max-h-48 overflow-y-auto mt-1.5 bg-gray-900 rounded hidden"></div>
            </div>
            <hr>
            <h3 class="text-sm font-bold mt-3 mb-2">Friend Requests</h3>
            <div id="friendRequestsList" class="max-h-64 overflow-y-auto">
                ${requestsHTML}
            </div>
        </div>
    `;
}

// Fonction pour ajouter un ami
async function addFriend(userId: number, buttonElement?: HTMLButtonElement) {
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
            buttonElement.classList.remove('bg-green-600', 'hover:bg-green-700');
            buttonElement.classList.add('bg-gray-600', 'cursor-default');
        }

        // Ne plus cacher les résultats ni effacer la recherche
        // L'utilisateur peut maintenant voir qu'il a envoyé la demande

    } catch (error) {
        console.error('Error adding friend:', error);
    }
}

// Fonction pour gérer la recherche d'amis
export function initializeAddFriendSearch() {
    const searchInput = document.getElementById('friendSearch') as HTMLInputElement;
    const searchResults = document.getElementById('searchResults');
    let searchTimeout: number;

    if (searchInput && searchResults) {
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
                    const { escapeHtml, sanitizeUrl } = await import('../utils/security.js');

                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="p-2.5 text-center text-gray-400">No users found</div>';
                    } else {
                        searchResults.innerHTML = users.map((user: any) => {
                            // Déterminer l'état du bouton
                            const buttonState = user.hasPendingRequest 
                                ? { text: 'Sent', class: 'bg-gray-600 cursor-default', disabled: true }
                                : { text: 'Add', class: 'bg-green-600 hover:bg-green-700', disabled: false };
                            
                            // SECURITY: Escape all user-controlled content to prevent XSS
                            const safeUserId = parseInt(user.id) || 0;
                            const safeUsername = escapeHtml(user.username || 'Unknown');
                            const safeAvatarUrl = sanitizeUrl(user.avatar_url || './img/planet.gif');
                            
                            return `
                                <div class="search-result-item flex items-center p-2 border-b border-gray-700 cursor-pointer hover:bg-gray-700" data-user-id="${safeUserId}">
                                    <img src="${safeAvatarUrl}" 
                                         alt="${safeUsername}" 
                                         class="w-7.5 h-7.5 rounded-full mr-2.5"
                                         onerror="this.onerror=null;this.src='./img/planet.gif';">
                                    <span class="flex-1">${safeUsername}</span>
                                    <button class="add-friend-btn ${buttonState.class} text-white border-none px-2 py-1 rounded text-xs" 
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
                    console.error('Error searching users:', error);
                    searchResults.innerHTML = '<div class="p-2.5 text-center text-red-500">Error searching users</div>';
                    searchResults.classList.remove('hidden');
                }
            }, 300);
        });

        // Masquer les résultats quand on clique ailleurs
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!searchInput.contains(target) && !searchResults.contains(target)) {
                searchResults.classList.add('hidden');
            }
        });
    }
}

// Fonction pour initialiser le bouton retour
export function initializeBackToFriendsButton() {
    const backBtn = document.getElementById('backToFriendsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            const { show, hide } = await import('../pages/utils.js');
            const { initializeAddFriendsButton, initializeFriendListEventListeners, startFriendListRealtimeUpdates, fetchInitialFriendStatuses } = await import('./friendList.html.js');
            
            // Cacher addFriends et afficher friendList
            hide('addFriends');
            await show('friendList');
            
            // Réinitialiser les fonctionnalités de friendList
            setTimeout(async () => {
                initializeAddFriendsButton();
                initializeFriendListEventListeners();
                startFriendListRealtimeUpdates(); // 🚀 NOUVEAU : Activer les mises à jour temps réel via WebSocket
                
                // 🎯 IMPORTANT : Toujours rafraîchir les statuts quand on retourne à friendList
                // (au cas où la liste a changé pendant qu'on était sur addFriends)
                await fetchInitialFriendStatuses();
                
                // 🔔 IMPORTANT : Mettre à jour le badge dès qu'on affiche friendList
                const { updateFriendRequestsBadge } = await import('./friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
        });
    }
}

// Fonction pour accepter une demande d'ami
async function acceptFriendRequest(requestId: number) {
    try {
        const response = await fetch(`/users/friend-requests/${requestId}/accept`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to accept friend request');
        }

        
        // Rafraîchir la liste des demandes d'amis
        await refreshFriendRequests();

        // Mettre à jour le badge dans la friend list
        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();

    } catch (error) {
        console.error('Error accepting friend request:', error);
    }
}

// Fonction pour rejeter une demande d'ami
async function rejectFriendRequest(requestId: number) {
    try {
        const response = await fetch(`/users/friend-requests/${requestId}/reject`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reject friend request');
        }

        // Rafraîchir la liste des demandes d'amis
        await refreshFriendRequests();

        // Mettre à jour le badge dans la friend list
        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();

    } catch (error) {
        console.error('Error rejecting friend request:', error);
    }
}

// Fonction pour rafraîchir la liste des demandes d'amis
async function refreshFriendRequests() {
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
                <div class="flex items-center p-2 border-b border-gray-700 gap-2">
                    <img src="${request.avatar_url || './img/planet.gif'}" 
                         alt="${request.username}" 
                         class="w-10 h-10 rounded-full"
                         onerror="this.onerror=null;this.src='./img/planet.gif';">
                    <span class="flex-1 text-sm">${request.username}</span>
                    <button class="accept-request-btn bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700" 
                            data-request-id="${request.request_id}">
                        ✓
                    </button>
                    <button class="reject-request-btn bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700" 
                            data-request-id="${request.request_id}">
                        ✗
                    </button>
                </div>
            `).join('');
        } else {
            requestsHTML = '<p class="text-center text-gray-400 text-sm mt-2">No friend requests</p>';
        }

        requestsList.innerHTML = requestsHTML;

        // Réinitialiser les event listeners
        initializeFriendRequestListeners();

    } catch (error) {
        console.error('Error refreshing friend requests:', error);
    }
}

// Fonction pour initialiser les event listeners des demandes d'amis
export function initializeFriendRequestListeners() {
    // Event listeners pour les boutons d'acceptation
    const acceptButtons = document.querySelectorAll('.accept-request-btn');
    acceptButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const requestId = parseInt((e.target as HTMLElement).dataset.requestId || '0');
            if (requestId) {
                await acceptFriendRequest(requestId);
            }
        });
    });

    // Event listeners pour les boutons de rejet
    const rejectButtons = document.querySelectorAll('.reject-request-btn');
    rejectButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const requestId = parseInt((e.target as HTMLElement).dataset.requestId || '0');
            if (requestId) {
                await rejectFriendRequest(requestId);
            }
        });
    });
}
