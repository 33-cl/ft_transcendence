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

        // Récupérer le statut en temps réel des amis
        let friendsStatus = new Map<string, any>();
        try {
            const statusResponse = await fetch('/users/status', {
                method: 'GET',
                credentials: 'include'
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('Friends status received:', statusData);
                const statuses = statusData.friendsStatus || [];
                statuses.forEach((friend: any) => {
                    friendsStatus.set(friend.username, friend);
                });
                console.log('Friends status map:', friendsStatus);
            } else {
                console.warn('Failed to fetch friends status:', statusResponse.status, statusResponse.statusText);
            }
        } catch (error) {
            console.warn('Could not fetch friends status:', error);
        }

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
            
            // Récupérer le statut de l'ami
            const friendStatus = friendsStatus.get(user.username) || { status: 'offline', isInGame: false, isOnline: false };
            const { status, isInGame } = friendStatus;
            
            console.log(`User ${user.username}: status=${status}, isInGame=${isInGame}`);

            // Définir la couleur du point de statut
            let statusColor = '#666'; // offline (gris)
            let statusText = 'Offline';
            if (status === 'online') {
                statusColor = '#4CAF50'; // online (vert)
                statusText = 'Online';
            } else if (status === 'in-game') {
                statusColor = '#FF9800'; // in-game (orange)
                statusText = 'In Game';
            }

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
    if (addFriendsBtn) {
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

// Fonction pour rafraîchir le statut des amis
export async function refreshFriendListStatus() {
    try {
        const friendsList = document.getElementById('friendsList');
        if (!friendsList) return;

        // Récupérer le statut en temps réel des amis
        const statusResponse = await fetch('/users/status', {
            method: 'GET',
            credentials: 'include'
        });

        if (!statusResponse.ok) {
            console.warn('Failed to refresh friends status');
            return;
        }

        const statusData = await statusResponse.json();
        const friendsStatus = statusData.friendsStatus || [];
        console.log('🔄 Refreshing friend status:', friendsStatus);

        // Mettre à jour chaque ami dans la liste
        friendsStatus.forEach((friend: any) => {
            // Sélectionner spécifiquement dans la friendList, pas dans le leaderboard
            const friendElement = document.querySelector(`#friendsList [data-username="${friend.username}"]`);
            console.log(`🔍 Looking for friend element: ${friend.username}`, friendElement);
            
            if (friendElement) {
                const statusIndicator = friendElement.querySelector('.status-indicator') as HTMLElement;
                const friendNameElement = friendElement.querySelector('.friend-name') as HTMLElement;

                console.log(`📍 Status elements for ${friend.username}:`, { statusIndicator, friendNameElement });

                if (statusIndicator) {
                    // Mettre à jour la couleur du point de statut
                    let statusColor = '#666'; // offline (gris)
                    let statusTextContent = 'Offline';
                    if (friend.status === 'online') {
                        statusColor = '#4CAF50'; // online (vert)
                        statusTextContent = 'Online';
                    } else if (friend.status === 'in-game') {
                        statusColor = '#FF9800'; // in-game (orange)
                        statusTextContent = 'In Game';
                    }

                    console.log(`🎨 Updating ${friend.username}: ${friend.status} -> ${statusTextContent} (${statusColor})`);

                    statusIndicator.style.backgroundColor = statusColor;
                    statusIndicator.title = statusTextContent;

                    // Mettre à jour l'attribut data-status
                    friendElement.setAttribute('data-status', friend.status);
                    friendElement.setAttribute('data-is-in-game', friend.isInGame ? 'true' : 'false');
                }

                // Gérer l'animation mini-pong en temps réel
                if (friendNameElement) {
                    const currentAnimation = friendNameElement.querySelector('.mini-pong-animation');
                    const shouldShowAnimation = friend.status === 'in-game' && friend.isInGame;

                    console.log(`🎮 Animation for ${friend.username}: shouldShow=${shouldShowAnimation}, currentExists=${!!currentAnimation}`);

                    if (shouldShowAnimation && !currentAnimation) {
                        // Ajouter l'animation mini-pong
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
                        
                        // Ajouter le style keyframes s'il n'existe pas déjà
                        if (!document.querySelector('#ballMoveStyle')) {
                            const style = document.createElement('style');
                            style.id = 'ballMoveStyle';
                            style.textContent = `
                                @keyframes ballMove {
                                    0% { left: 2px; }
                                    100% { left: calc(100% - 6px); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        console.log(`🎮 Added mini-pong animation for ${friend.username}`);
                    } else if (!shouldShowAnimation && currentAnimation) {
                        // Retirer l'animation mini-pong
                        currentAnimation.remove();
                        console.log(`🎮 Removed mini-pong animation for ${friend.username}`);
                    }
                }

            }
        });
    } catch (error) {
        console.error('Error refreshing friend list status:', error);
    }
}

// Make refresh function available globally for other components
(window as any).refreshFriendList = refreshFriendListStatus;

// Variable pour stocker l'intervalle de rafraîchissement
let friendListRefreshInterval: number | null = null;

// Fonction pour démarrer le rafraîchissement automatique
export function startFriendListAutoRefresh() {
    // Arrêter l'ancien intervalle s'il existe
    if (friendListRefreshInterval) {
        clearInterval(friendListRefreshInterval);
    }
    
    console.log('🔄 Starting friend list auto-refresh...');
    
    // Faire un premier rafraîchissement immédiatement
    setTimeout(() => {
        console.log('🔄 First automatic refresh trigger');
        refreshFriendListStatus();
        updateFriendRequestsBadge();
    }, 1000);
    
    // Démarrer un nouveau rafraîchissement toutes les 3 secondes (plus rapide pour tester)
    friendListRefreshInterval = window.setInterval(() => {
        console.log('🔄 Auto-refresh interval triggered');
        refreshFriendListStatus();
        updateFriendRequestsBadge();
    }, 3000);
    console.log('🔄 Started friend list auto-refresh with interval:', friendListRefreshInterval);
}

// Fonction pour arrêter le rafraîchissement automatique
export function stopFriendListAutoRefresh() {
    if (friendListRefreshInterval) {
        clearInterval(friendListRefreshInterval);
        friendListRefreshInterval = null;
        console.log('🔄 Stopped friend list auto-refresh');
    }
}



// Fonction pour spectater un ami
export async function spectateFreind(username: string) {
    try {
        console.log(`🔍 [SPECTATE] Starting spectate for ${username}`);
        console.log(`🔍 [SPECTATE] Socket status:`, {
            exists: !!window.socket,
            connected: window.socket ? window.socket.connected : false,
            id: window.socket ? window.socket.id : 'none'
        });
        
        // Chercher la room de l'ami (utilise les cookies automatiquement)
        const response = await fetch(`/rooms/friend/${username}`, {
            method: 'GET',
            credentials: 'include' // Important : inclure les cookies
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 404) {
                // Joueur pas en jeu - ne rien faire silencieusement
                console.log(`🔍 [SPECTATE] ${username} is not in any active game right now.`);
                return;
            } else if (response.status === 403) {
                alert('You can only spectate friends.');
            } else if (response.status === 401) {
                alert('Authentication required. Please log in.');
            } else {
                alert('Error finding game: ' + (error.error || 'Unknown error'));
            }
            return;
        }

        const roomData = await response.json();
        console.log('🔍 [SPECTATE] Room data for spectating:', roomData);
        
        // Vérifier que la room existe vraiment
        if (!roomData.roomName) {
            console.log(`🔍 [SPECTATE] No active room found for ${username}`);
            return;
        }
        
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