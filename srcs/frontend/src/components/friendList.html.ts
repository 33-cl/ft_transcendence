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
        
        let userItems = '';
        
        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/default-pp.jpg';
            const isFirstRank = user.id === firstRankUserId;
            const crownIcon = isFirstRank ? '<img src="./img/gold-crown.png" alt="First place" class="crown-icon crown" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; z-index: 10;">' : '';
            
            userItems += `
                <div id="profileBtn" class="friend" data-username="${user.username}" style="position: relative;">
                    <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                         onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                    <p class="friend-name">${user.username}</p>
                    ${crownIcon}
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