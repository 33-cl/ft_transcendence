// Icône de chargement intégrée directement dans le HTML

export async function friendListHTML() {
    console.log('🔥 friendListHTML called - VERSION 3.0 - WITH REAL-TIME STATUS');
    try {
        // Récupérer les utilisateurs récents
        const usersResponse = await fetch('/users', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!usersResponse.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const usersData = await usersResponse.json();
        const users = usersData.users || [];

        // ✨ NOUVEAU : On ne fait plus de fetch du statut initial
        // Les WebSocket events mettront à jour le statut en temps réel après le chargement
        console.log('Users will be displayed with offline status, WebSocket will update in real-time');

        // Récupérer le leaderboard pour identifier le premier
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

        console.log('Users fetched:', users.length);
        
        // Récupérer le nombre de demandes d'amis en attente
        let friendRequestsCount = 0;
        try {
            const requestsResponse = await fetch('/users/friend-requests/received', {
                method: 'GET',
                credentials: 'include'
            });

            if (requestsResponse.ok) {
                const requestsData = await requestsResponse.json();
                friendRequestsCount = (requestsData.requests || []).length;
                console.log('Friend requests count:', friendRequestsCount);
            }
        } catch (error) {
            console.warn('Could not fetch friend requests count:', error);
        }

        let userItems = '';

        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/default-pp.jpg';
            const isFirstRank = user.id === firstRankUserId;
            const crownIcon = isFirstRank ? '<img src="./img/gold-crown.png" alt="First place" class="crown-icon crown" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; z-index: 10;">' : '';
            
            // ✨ NOUVEAU : Au chargement initial, tous les amis sont "offline"
            // Les WebSocket events mettront à jour le statut en temps réel
            const status = 'offline';
            const isInGame = false;
            
            console.log(`User ${user.username}: initial status=${status} (will be updated by WebSocket)`);

            // Définir la couleur du point de statut (offline par défaut)
            const statusColor = '#666'; // offline (gris)
            const statusText = 'Offline';

            userItems += `
                <div id="profileBtn" class="friend relative" data-username="${user.username}" data-user-id="${user.id}" data-status="${status}" data-is-in-game="${isInGame}">
                    <div class="relative inline-block">
                        <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                             onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                        <div class="status-indicator absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 z-10" 
                             style="background-color: ${statusColor};" 
                             title="${statusText}">
                        </div>
                    </div>
                    <p class="friend-name flex items-center justify-start">
                        ${user.username}
                    </p>
                    <!--${crownIcon}-->
                </div>
            `;
        });

        if (userItems === '') {
            userItems = '<p class="text-center text-gray-400 mt-5">No friends yet...</p>';
        }

        // Badge HTML pour les demandes d'amis en attente
        const requestsBadge = friendRequestsCount > 0 
            ? `<span class="friend-requests-badge absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">${friendRequestsCount}</span>`
            : '';

        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="relative">
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="absolute top-0 right-0 w-8 h-8 bg-black hover:bg-gray-900 border border-gray-600 rounded flex items-center justify-center transition-colors p-1.5" title="Add Friends">
                        <img src="./img/add-friend-icon.svg" alt="Add Friend" class="w-full h-full">
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
            ? `<span class="friend-requests-badge absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">${friendRequestsCount}</span>`
            : '';

        return /*html*/`
            <div id="friendList" class="user-list">
                <div class="relative">
                    <h2>Friends</h2>
                    <button id="addFriendsBtn" class="absolute top-0 right-0 w-8 h-8 bg-black hover:bg-gray-900 border border-gray-600 rounded flex items-center justify-center transition-colors p-1.5" title="Add Friends">
                        <img src="./img/add-friend-icon.svg" alt="Add Friend" class="w-full h-full">
                        ${requestsBadge}
                    </button>
                </div>
                <hr>
                <p class="text-center text-red-500 mt-5">Error loading friends</p>
            </div>
        `;
    }
}



// Fonction pour initialiser les event listeners de la liste d'amis
export function initializeFriendListEventListeners() {
    // Event listeners pour les boutons spectate
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

// Fonction pour initialiser le bouton Add Friends
export function initializeAddFriendsButton() {
    const addFriendsBtn = document.getElementById('addFriendsBtn');
    if (addFriendsBtn && !(addFriendsBtn as any)._addFriendsListenerSet) {
        // Marquer le bouton comme ayant un listener pour éviter les doublons
        (addFriendsBtn as any)._addFriendsListenerSet = true;
        
        addFriendsBtn.addEventListener('click', async () => {
            const { show, hide } = await import('../pages/utils.js');
            const { initializeAddFriendSearch, initializeBackToFriendsButton, initializeFriendRequestListeners } = await import('./addFriends.html.js');
            
            // Cacher friendList et afficher addFriends
            hide('friendList');
            await show('addFriends');
            
            // Initialiser les fonctionnalités de addFriends
            setTimeout(() => {
                initializeAddFriendSearch();
                initializeBackToFriendsButton();
                initializeFriendRequestListeners();
            }, 100);
        });
    }
}

// ============================================
// 🚀 NOUVEAU SYSTÈME : WebSocket Push Events
// ============================================
// Plus de polling ! Le serveur nous notifie en temps réel

// Variable pour suivre si les listeners WebSocket sont actifs
let friendListSocketListenersActive = false;

// Fonction pour écouter les événements WebSocket en temps réel
export function startFriendListRealtimeUpdates() {
    if (!window.socket) {
        console.warn('⚠️ WebSocket not available for real-time friend updates');
        return;
    }

    // Éviter les doublons de listeners
    if (friendListSocketListenersActive) {
        console.log('✅ Friend list WebSocket listeners already active');
        return;
    }

    console.log('� Starting real-time friend list updates via WebSocket...');

    // 1️⃣ Écouter les changements de statut des amis (online/offline/in-game)
    window.socket.on('friendStatusChanged', (data: { username: string; status: string; timestamp: number }) => {
        console.log('🔔 Friend status changed:', data);
        updateFriendStatus(data.username, data.status);
    });

    // 2️⃣ Écouter les ajouts d'amis
    window.socket.on('friendAdded', (data: { friend: { id: number; username: string }; timestamp: number }) => {
        console.log('🔔 Friend added:', data);
        reloadFriendList();
    });

    // 3️⃣ Écouter les suppressions d'amis
    window.socket.on('friendRemoved', (data: { friendId: number; timestamp: number }) => {
        console.log('� Friend removed:', data);
        reloadFriendList();
    });

    // 4️⃣ Écouter les mises à jour de profil (pseudo/avatar)
    window.socket.on('profileUpdated', (data: { userId: number; username: string; avatar_url: string; timestamp: number }) => {
        console.log('🔔 Profile updated:', data);
        updateFriendProfile(data.userId, data.username, data.avatar_url);
    });

    // 5️⃣ Écouter les nouvelles demandes d'ami (pour le badge)
    window.socket.on('friendRequestReceived', (data: { sender: { id: number; username: string }; timestamp: number }) => {
        console.log('🔔 Friend request received:', data);
        updateFriendRequestsBadge();
    });

    friendListSocketListenersActive = true;
    console.log('✅ Friend list real-time updates activated!');

    // 🆕 Faire un fetch initial UNIQUE pour obtenir les statuts actuels
    // Ensuite, les WebSocket events prendront le relais
    fetchInitialFriendStatuses();
}

// Fonction pour récupérer les statuts initiaux des amis (peut être appelée à tout moment pour rafraîchir)
export async function fetchInitialFriendStatuses() {
    try {
        console.log('📡 Fetching initial friend statuses (one-time fetch)...');
        const response = await fetch('/users/friends-online', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            console.warn('Failed to fetch initial friend statuses');
            return;
        }

        const data = await response.json();
        const friendsStatus = data.friendsStatus || [];
        
        console.log('✅ Initial friend statuses received:', friendsStatus);
        
        // Mettre à jour les statuts dans le DOM
        for (const friend of friendsStatus) {
            updateFriendStatus(friend.username, friend.status);
        }
    } catch (error) {
        console.error('Error fetching initial friend statuses:', error);
    }
}

// Fonction pour arrêter les listeners WebSocket
export function stopFriendListRealtimeUpdates() {
    if (!window.socket || !friendListSocketListenersActive) {
        return;
    }

    console.log('🛑 Stopping friend list real-time updates...');

    // Retirer tous les listeners
    window.socket.off('friendStatusChanged');
    window.socket.off('friendAdded');
    window.socket.off('friendRemoved');
    window.socket.off('profileUpdated');
    window.socket.off('friendRequestReceived');

    friendListSocketListenersActive = false;
    console.log('✅ Friend list real-time updates stopped');
}

// Fonction helper pour mettre à jour le statut d'un ami spécifique
function updateFriendStatus(username: string, status: string) {
    const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
    if (!friendElement) return;

    const statusIndicator = friendElement.querySelector('.status-indicator') as HTMLElement;
    const friendNameElement = friendElement.querySelector('.friend-name') as HTMLElement;

    if (statusIndicator) {
        let statusColor = '#666'; // offline
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

    // Gérer l'animation mini-pong
    if (friendNameElement) {
        const currentAnimation = friendNameElement.querySelector('.mini-pong-animation');
        const shouldShowAnimation = status === 'in-game';

        if (shouldShowAnimation && !currentAnimation) {
            const miniPongHTML = `
                <div class="mini-pong-animation inline-block ml-3 w-8 h-5 animate-spin" style="animation-duration: 3s;">
                    <div class="relative w-full h-full bg-white bg-opacity-20 rounded-sm overflow-hidden">
                        <div class="absolute left-0 top-1/2 w-0.5 h-2 bg-white -translate-y-1/2"></div>
                        <div class="absolute right-0 top-1/2 w-0.5 h-2 bg-white -translate-y-1/2"></div>
                        <div class="absolute top-1/2 w-1 h-1 bg-white rounded-full -translate-y-1/2" style="animation: ballMove 1s ease-in-out infinite alternate;"></div>
                    </div>
                </div>
            `;
            friendNameElement.insertAdjacentHTML('beforeend', miniPongHTML);
        } else if (!shouldShowAnimation && currentAnimation) {
            currentAnimation.remove();
        }
    }
}

// Fonction helper pour mettre à jour le profil d'un ami
function updateFriendProfile(userId: number, newUsername: string, newAvatarUrl: string) {
    const friendElement = document.querySelector(`#friendsList [data-user-id="${userId}"]`);
    if (!friendElement) return;

    // Mettre à jour le pseudo
    const friendNameElement = friendElement.querySelector('.friend-name') as HTMLElement;
    if (friendNameElement) {
        const animation = friendNameElement.querySelector('.mini-pong-animation');
        friendNameElement.textContent = newUsername;
        if (animation) {
            friendNameElement.appendChild(animation);
        }
    }

    // Mettre à jour l'avatar
    const avatarElement = friendElement.querySelector('.profile-pic') as HTMLImageElement;
    if (avatarElement && newAvatarUrl) {
        avatarElement.src = newAvatarUrl;
    }

    // Mettre à jour l'attribut data-username
    friendElement.setAttribute('data-username', newUsername);
}

// Fonction helper pour recharger toute la liste d'amis
async function reloadFriendList() {
    const friendListContainer = document.getElementById('friendList');
    if (!friendListContainer) return;

    try {
        const newHTML = await friendListHTML();
        friendListContainer.innerHTML = newHTML;
        initializeAddFriendsButton();
        initializeFriendListEventListeners();
        
        // 🚀 IMPORTANT : Après avoir rechargé la liste, récupérer les statuts actuels
        // Attendre un peu que le DOM soit complètement rendu avant de mettre à jour les statuts
        setTimeout(async () => {
            await fetchInitialFriendStatuses();
        }, 100);
    } catch (error) {
        console.error('Error reloading friend list:', error);
    }
}



// Fonction pour spectater un ami
export async function spectateFreind(username: string) {
    try {
        console.log(`🔍 [SPECTATE] Starting spectate for ${username}`);
        
        // Vérifier le statut actuel de l'ami AVANT de faire la requête
        const friendElement = document.querySelector(`#friendsList [data-username="${username}"]`);
        const isInGame = friendElement?.getAttribute('data-is-in-game') === 'true';
        
        if (!isInGame) {
            console.log(`🔍 [SPECTATE] Friend ${username} is no longer in game`);
            alert(`${username} is not currently in a game. Please wait for them to start playing!`);
            return;
        }
        
        // Chercher la room de l'ami (utilise les cookies automatiquement)
        const response = await fetch(`/rooms/friend/${username}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 403) {
                alert('You can only spectate friends.');
            } else if (response.status === 401) {
                alert('Authentication required. Please log in.');
            } else {
                // Ne plus afficher d'alerte pour "Friend is not in any active game"
                console.warn('Error finding game: ' + (error.error || 'Unknown error'));
            }
            return;
        }

        const roomData = await response.json();
        console.log('🔍 [SPECTATE] Room data for spectating:', roomData);
        
        // Rejoindre la room en tant que spectateur
        if (window.socket && window.socket.connected) {
            console.log(`🔍 [SPECTATE] Emitting joinRoom for ${roomData.roomName} as spectator`);
            console.log(`🔍 [SPECTATE] Event data:`, { 
                roomName: roomData.roomName,
                spectator: true 
            });
            
            window.socket.emit('joinRoom', { 
                roomName: roomData.roomName,
                spectator: true 
            });
            
            console.log(`🔍 [SPECTATE] joinRoom event emitted successfully`);
            
            // Naviguer vers la page de jeu - utiliser la méthode standard du SPA
            const { load } = await import('../pages/utils.js');
            await load('game');
            
            console.log(`🔍 [SPECTATE] Navigation to game page complete for ${username}'s game in room ${roomData.roomName}!`);
        } else {
            console.error(`🔍 [SPECTATE] WebSocket connection not available:`, {
                exists: !!window.socket,
                connected: window.socket ? window.socket.connected : false
            });
            alert('WebSocket connection not available');
        }

    } catch (error: any) {
        console.error('🔍 [SPECTATE] Error spectating friend:', error);
        alert('Failed to spectate friend: ' + (error.message || 'Unknown error'));
    }
}

// Fonction pour initialiser les icônes de chargement (plus nécessaire avec CSS pur)
export function initLoadingIcons(): void {
    console.log('Loading icons initialized (CSS version)');
}

// Fonction pour nettoyer les icônes (plus nécessaire avec CSS pur)
export function destroyLoadingIcons(): void {
    console.log('Loading icons destroyed (CSS version)');
}

// Fonction pour mettre à jour le badge des demandes d'amis
export async function updateFriendRequestsBadge() {
    try {
        const requestsResponse = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });

        if (!requestsResponse.ok) {
            console.warn('Failed to fetch friend requests count');
            return;
        }

        const requestsData = await requestsResponse.json();
        const friendRequestsCount = (requestsData.requests || []).length;
        console.log('🔔 Updating friend requests badge:', friendRequestsCount);

        const addFriendsBtn = document.getElementById('addFriendsBtn');
        if (!addFriendsBtn) return;

        // Chercher le badge existant
        let badge = addFriendsBtn.querySelector('.friend-requests-badge') as HTMLElement;

        if (friendRequestsCount > 0) {
            if (badge) {
                // Mettre à jour le badge existant
                badge.textContent = friendRequestsCount.toString();
            } else {
                // Créer un nouveau badge
                const badgeHTML = `<span class="friend-requests-badge absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">${friendRequestsCount}</span>`;
                addFriendsBtn.insertAdjacentHTML('beforeend', badgeHTML);
            }
        } else {
            // Supprimer le badge s'il n'y a plus de demandes
            if (badge) {
                badge.remove();
            }
        }
    } catch (error) {
        console.error('Error updating friend requests badge:', error);
    }
}