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

            // Bouton spectate seulement si en jeu
            const spectateButton = isInGame ? `
                <button class="spectate-btn" 
                        data-username="${user.username}" 
                        style="
                            background: #2196F3; 
                            color: white; 
                            border: none; 
                            padding: 4px 8px; 
                            border-radius: 3px; 
                            cursor: pointer;
                            font-size: 11px;
                            margin-top: 4px;
                        ">
                    👁 Spectate
                </button>
            ` : '';

            userItems += `
<<<<<<< HEAD
                <div id="profileBtn" class="friend" data-username="${user.username}" data-user-id="${user.id}" data-is-in-game="${isInGame}" style="position: relative;">
                    <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                         onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                    <p class="friend-name flex items-center justify-start">
                        ${user.username}
                        <div class="inline-block ml-3 w-8 h-5 animate-spin" style="animation-duration: 3s;">
                            <div class="relative w-full h-full bg-white bg-opacity-20 rounded-sm overflow-hidden">
                                <div class="absolute left-0 top-1/2 w-0.5 h-2 bg-white -translate-y-1/2"></div>
                                <div class="absolute right-0 top-1/2 w-0.5 h-2 bg-white -translate-y-1/2"></div>
                                <div class="absolute top-1/2 w-1 h-1 bg-white rounded-full -translate-y-1/2" style="animation: ballMove 1s ease-in-out infinite alternate;"></div>
                            </div>
                        </div>
                        <style>
                        @keyframes ballMove {
                            0% { left: 2px; }
                            100% { left: calc(100% - 6px); }
                        }
                        </style>
                    </p>
=======
                <div id="profileBtn" class="friend" data-username="${user.username}" data-user-id="${user.id}" data-status="${status}" style="position: relative;">
                    <div style="position: relative; display: inline-block;">
                        <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                             onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                        <div class="status-indicator" 
                             style="
                                 position: absolute; 
                                 bottom: 2px; 
                                 right: 2px; 
                                 width: 12px; 
                                 height: 12px; 
                                 border-radius: 50%; 
                                 background-color: ${statusColor}; 
                                 border: 2px solid #1a1a1a; 
                                 z-index: 10;
                             " 
                             title="${statusText}">
                        </div>
                    </div>
                    <p class="friend-name">${user.username}</p>
                    <p class="friend-status" style="font-size: 11px; color: ${statusColor}; margin: 2px 0;">${statusText}</p>
                    ${spectateButton}
>>>>>>> aa69620 (need to work on spectate again but online dot working)
                    <!--${crownIcon}-->
                </div>
            `;
        });

        if (userItems === '') {
            userItems = '<p style="text-align: center; color: #ccc; margin-top: 20px;">No friends yet...</p>';
        }

        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Friends</h2>
                <div class="search-container" style="margin: 10px 0;">
                    <input 
                        type="text" 
                        id="friendSearch" 
                        placeholder="Search users to add..." 
                        class="search-input"
                        style="
                            width: 100%; 
                            padding: 8px; 
                            border: 1px solid #444; 
                            border-radius: 4px; 
                            background: #2a2a2a; 
                            color: white; 
                            font-size: 14px;
                        "
                    >
                    <div id="searchResults" class="search-results" style="
                        max-height: 200px; 
                        overflow-y: auto; 
                        margin-top: 5px;
                        background: #1a1a1a;
                        border-radius: 4px;
                        display: none;
                    "></div>
                </div>
                <hr>
                <div id="friendsList">
                    ${userItems}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading friends:', error);
        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Friends</h2>
                <hr>
                <p style="text-align: center; color: #f00; margin-top: 20px;">Error loading friends</p>
            </div>
        `;
    }
}

// Fonction pour ajouter un ami
async function addFriend(userId: number) {
    try {
        const response = await fetch(`/users/${userId}/friend`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add friend');
        }

        // Recharger la liste d'amis
        const friendListContainer = document.getElementById('friendList');
        if (friendListContainer) {
            friendListContainer.innerHTML = await friendListHTML();
            initializeFriendSearch(); // Réinitialiser la recherche
        }

        // Cacher les résultats de recherche
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.style.display = 'none';
        }

        // Effacer la recherche
        const searchInput = document.getElementById('friendSearch') as HTMLInputElement;
        if (searchInput) {
            searchInput.value = '';
        }

    } catch (error) {
        console.error('Error adding friend:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert('Error adding friend: ' + errorMessage);
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
                const statusText = friendElement.querySelector('.friend-status') as HTMLElement;
                const existingSpectateBtn = friendElement.querySelector('.spectate-btn');

                console.log(`📍 Status elements for ${friend.username}:`, { statusIndicator, statusText });

                if (statusIndicator && statusText) {
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
                    statusText.textContent = statusTextContent;
                    statusText.style.color = statusColor;

                    // Ajouter/retirer le bouton spectate selon le statut
                    if (friend.isInGame && !existingSpectateBtn) {
                        // Ajouter le bouton spectate
                        const spectateButton = document.createElement('button');
                        spectateButton.className = 'spectate-btn';
                        spectateButton.dataset.username = friend.username;
                        spectateButton.innerHTML = '👁 Spectate';
                        spectateButton.style.cssText = `
                            background: #2196F3; 
                            color: white; 
                            border: none; 
                            padding: 4px 8px; 
                            border-radius: 3px; 
                            cursor: pointer;
                            font-size: 11px;
                            margin-top: 4px;
                        `;
                        spectateButton.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await spectateFreind(friend.username);
                        });
                        friendElement.appendChild(spectateButton);
                    } else if (!friend.isInGame && existingSpectateBtn) {
                        // Retirer le bouton spectate
                        existingSpectateBtn.remove();
                    }

                    // Mettre à jour l'attribut data-status
                    friendElement.setAttribute('data-status', friend.status);
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
    }, 1000);
    
    // Démarrer un nouveau rafraîchissement toutes les 3 secondes (plus rapide pour tester)
    friendListRefreshInterval = window.setInterval(() => {
        console.log('🔄 Auto-refresh interval triggered');
        refreshFriendListStatus();
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

// Fonction pour gérer la recherche d'amis
export function initializeFriendSearch() {
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
                searchResults.style.display = 'none';
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

                    if (users.length === 0) {
                        searchResults.innerHTML = '<div style="padding: 10px; text-align: center; color: #ccc;">No users found</div>';
                    } else {
                        searchResults.innerHTML = users.map((user: any) => `
                            <div class="search-result-item" style="
                                display: flex; 
                                align-items: center; 
                                padding: 8px; 
                                border-bottom: 1px solid #333;
                                cursor: pointer;
                            " data-user-id="${user.id}" onmouseover="this.style.backgroundColor='#333'" onmouseout="this.style.backgroundColor='transparent'">
                                <img src="${user.avatar_url || './img/default-pp.jpg'}" 
                                     alt="${user.username}" 
                                     style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;"
                                     onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                                <span style="flex: 1;">${user.username}</span>
                                <button class="add-friend-btn" 
                                        style="
                                            background: #4CAF50; 
                                            color: white; 
                                            border: none; 
                                            padding: 4px 8px; 
                                            border-radius: 3px; 
                                            cursor: pointer;
                                            font-size: 12px;
                                        " 
                                        data-user-id="${user.id}">
                                    Add
                                </button>
                            </div>
                        `).join('');

                        // Ajouter les event listeners pour les boutons d'ajout
                        const addButtons = searchResults.querySelectorAll('.add-friend-btn');
                        addButtons.forEach(button => {
                            button.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
                                if (userId) {
                                    await addFriend(userId);
                                }
                            });
                        });
                    }

                    searchResults.style.display = 'block';

                } catch (error) {
                    console.error('Error searching users:', error);
                    searchResults.innerHTML = '<div style="padding: 10px; text-align: center; color: #f00;">Error searching users</div>';
                    searchResults.style.display = 'block';
                }
            }, 300);
        });

        // Masquer les résultats quand on clique ailleurs
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!searchInput.contains(target) && !searchResults.contains(target)) {
                searchResults.style.display = 'none';
            }
        });
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