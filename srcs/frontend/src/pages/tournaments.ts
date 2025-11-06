import { load } from '../navigation/utils.js';

// Page tournaments: liste des tournois 4-player
export default async function tournamentsPage() {
    // Masquer le contenu existant sans casser la structure
    const mainContent = document.querySelector('main') || document.body;
    
    const containerId = 'tournamentsPage';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'p-4';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = 'white';
        container.style.zIndex = '1000';
        mainContent.appendChild(container);
    }
    
    // Afficher le conteneur
    container.style.display = 'block';

    container.innerHTML = `
        <div class="max-w-3xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-3xl font-bold">Tournois 4-Player</h1>
                <button id="create-tournament-btn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                    ➕ Créer Tournoi
                </button>
            </div>
            <div id="tournaments-list">
                <div class="text-center py-8">
                    <p class="text-gray-500">Chargement des tournois...</p>
                </div>
            </div>
            <div class="mt-4">
                <button id="tournaments-back" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Retour</button>
            </div>
        </div>
    `;

    // Attendre que le DOM soit prêt
    setTimeout(async () => {
        await loadTournamentsList();
        setupTournamentEventListeners();
    }, 100);
}

// Initialize tournaments functionality after HTML is rendered
export async function initTournaments() {
    await loadTournamentsList();
    setupTournamentEventListeners();
}

function setupTournamentEventListeners() {
    const backBtn = document.getElementById('tournaments-back');
    if (backBtn && !(backBtn as any)._listenerSet) {
        (backBtn as any)._listenerSet = true;
        backBtn.addEventListener('click', async () => {
            // Supprimer complètement la page tournaments
            const tournamentsPage = document.getElementById('tournamentsPage');
            if (tournamentsPage) {
                tournamentsPage.remove();
            }
            await load('mainMenu');
        });
    }

    const createBtn = document.getElementById('create-tournament-btn');
    if (createBtn && !(createBtn as any)._listenerSet) {
        (createBtn as any)._listenerSet = true;
        createBtn.addEventListener('click', async () => {
            const name = prompt('Nom du tournoi 4-player:');
            if (name && name.trim()) {
                try {
                    const response = await fetch('/tournaments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ name: name.trim(), maxPlayers: 4 })
                    });
                    
                    if (response.ok) {
                        // Recharger la liste des tournois
                        await loadTournamentsList();
                    } else {
                        const error = await response.json();
                        alert(`Erreur: ${error.error || 'Impossible de créer le tournoi'}`);
                    }
                } catch (error) {
                    alert('Erreur lors de la création du tournoi');
                    console.error('Tournament creation error:', error);
                }
            }
        });
    }
}

async function loadTournamentsList() {
    const listContainer = document.getElementById('tournaments-list');
    if (!listContainer) return;
    
    try {
        // Appel API pour récupérer les tournois 4-player
        const res = await fetch('/tournaments', { method: 'GET', credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data = await res.json();
        const tournaments = data.tournaments || [];

        if (tournaments.length === 0) {
            listContainer!.innerHTML = `
                <div class="text-center py-8 bg-white shadow rounded">
                    <p class="text-gray-500 mb-4">Aucun tournoi disponible pour le moment.</p>
                    <p class="text-sm text-gray-400">Les tournois 4-player apparaîtront ici une fois créés.</p>
                </div>
            `;
        } else {
            const rows = tournaments.map((t: any) => `
                <div class="p-3 border-b flex justify-between items-center">
                    <div>
                        <div class="font-medium">${t.name}</div>
                        <div class="text-sm text-gray-400">Status: ${t.status} — ${t.current_players}/${t.max_players} joueurs</div>
                        ${t.max_players === 4 ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">4-Player</span>' : ''}
                    </div>
                    <div>
                        <button data-id="${t.id}" class="view-tournament px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Voir
                        </button>
                    </div>
                </div>
            `).join('');
            listContainer!.innerHTML = `<div class="bg-white shadow rounded">${rows}</div>`;
        }

        // Attach click handlers
        document.querySelectorAll('.view-tournament').forEach(btn => {
            if (!(btn as any)._listenerSet) {
                (btn as any)._listenerSet = true;
                
                (btn as HTMLElement).addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        // Navigation vers la page de détail du tournoi
                        await load(`tournaments/${id}`);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error loading tournaments:', error);
        listContainer!.innerHTML = '<p class="text-red-500 text-center py-4">Erreur lors du chargement des tournois.</p>';
    }
}
