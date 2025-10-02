// Icône de chargement intégrée directement dans le HTML

export async function friendListHTML() {
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

        // Récupérer les rooms actives pour savoir qui est en jeu
        let activeUsers = new Set<string>();
        try {
            const roomsResponse = await fetch('/rooms', {
                method: 'GET',
                credentials: 'include'
            });

            if (roomsResponse.ok) {
                const roomsData = await roomsResponse.json();
                console.log('Rooms data received:', roomsData);
                const rooms = roomsData.rooms || {};
                console.log('Rooms object keys:', Object.keys(rooms));
                // rooms est un objet avec des clés (noms de rooms), pas un tableau
                Object.values(rooms).forEach((room: any) => {
                    console.log('Processing room:', room);
                    if (room.players && Array.isArray(room.players)) {
                        room.players.forEach((player: any) => {
                            if (player.username) {
                                console.log('Found active player:', player.username);
                                activeUsers.add(player.username);
                            }
                        });
                    }
                });
                console.log('Active users in game:', Array.from(activeUsers));
            } else {
                console.warn('Failed to fetch rooms:', roomsResponse.status, roomsResponse.statusText);
            }
        } catch (error) {
            // Si on ne peut pas récupérer les rooms, on continue sans les boutons spectate
            console.warn('Could not fetch rooms for spectate buttons:', error);
            activeUsers = new Set<string>();
        }

        console.log('Users fetched:', users.length);
        console.log('Active users in game before simulation:', Array.from(activeUsers));

        // TEMPORAIRE: Pour tester, simulons que tous les amis sont en jeu
        // TODO: Enlever cette ligne une fois que l'API /rooms fonctionne
        console.log('TEMP: Simulating all friends are in game for testing');
        users.forEach((user: any) => activeUsers.add(user.username));
        
        console.log('Active users in game after simulation:', Array.from(activeUsers));
        
        let userItems = '';

        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/default-pp.jpg';
            const isFirstRank = user.id === firstRankUserId;
            const crownIcon = isFirstRank ? '<img src="./img/gold-crown.png" alt="First place" class="crown-icon crown" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; z-index: 10;">' : '';
            
            // Vérifier si l'utilisateur est en jeu
            const isInGame = activeUsers.has(user.username);
            console.log(`User ${user.username}: isInGame=${isInGame}`);

            userItems += /*html*/`
                <div id="profileBtn" class="friend" data-username="${user.username}" data-user-id="${user.id}" data-is-in-game="${isInGame}" style="position: relative;">
                    <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                         onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                    <p class="friend-name">
                        ${user.username}
                    </p>
                    <div class="absolute right-2 top-1/2 w-8 h-5" style="transform: translateY(-50%) rotate(0deg); animation: spin 3s linear infinite;">
                        <div class="relative w-full h-full rounded-sm overflow-hidden">
                            <div class="absolute w-0.5 h-3 bg-white -translate-y-1/2" style="left: 4px; top: 50%;"></div>
                            <div class="absolute w-0.5 h-3 bg-white -translate-y-1/2" style="right: 4px; top: 50%;"></div>
                            <div class="absolute top-1/2 w-1 h-1 bg-white rounded-full -translate-y-1/2" style="animation: ballMove 1s ease-in-out infinite alternate;"></div>
                        </div>
                    </div>
                    <style>
                    @keyframes ballMove {
                        0% { left: 6px; }
                        100% { left: calc(100% - 10px); }
                    }
                    @keyframes spin {
                        0% { transform: translateY(-50%) rotate(0deg); }
                        100% { transform: translateY(-50%) rotate(360deg); }
                    }
                    </style>
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