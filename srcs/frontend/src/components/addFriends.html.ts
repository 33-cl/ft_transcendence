export async function addFriendsHTML() {
    console.log('🔍 addFriendsHTML called');
    
    return /*html*/`
        <div id="addFriends" class="user-list">
            <h2>Add Friends</h2>
            <div class="search-container my-2.5">
                <input 
                    type="text" 
                    id="friendSearch" 
                    placeholder="Search users to add..." 
                    class="search-input w-full px-2 py-2 border border-gray-600 rounded bg-gray-800 text-white text-sm"
                >
                <div id="searchResults" class="search-results max-h-48 overflow-y-auto mt-1.5 bg-gray-900 rounded hidden"></div>
            </div>
            <hr>
            <div class="text-center mt-5">
                <button id="backToFriendsBtn" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                    Back to Friends
                </button>
            </div>
        </div>
    `;
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

        // Afficher un message de succès
        alert('Friend added successfully!');

        // Cacher les résultats de recherche
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.classList.add('hidden');
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

                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="p-2.5 text-center text-gray-400">No users found</div>';
                    } else {
                        searchResults.innerHTML = users.map((user: any) => `
                            <div class="search-result-item flex items-center p-2 border-b border-gray-700 cursor-pointer hover:bg-gray-700" data-user-id="${user.id}">
                                <img src="${user.avatar_url || './img/default-pp.jpg'}" 
                                     alt="${user.username}" 
                                     class="w-7.5 h-7.5 rounded-full mr-2.5"
                                     onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                                <span class="flex-1">${user.username}</span>
                                <button class="add-friend-btn bg-green-600 text-white border-none px-2 py-1 rounded cursor-pointer text-xs hover:bg-green-700" 
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
            const { load } = await import('../pages/utils.js');
            await load('friendList');
        });
    }
}
