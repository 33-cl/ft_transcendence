import { load } from '../navigation/utils.js';

// Page tournaments: liste des tournois 4-player (legacy, not used anymore)
export default async function tournamentsPage() {
    console.warn('tournamentsPage() is deprecated, use initTournaments() instead');
}

// Initialize tournaments functionality after HTML is rendered
export async function initTournaments() {
    console.log('🎾 Initializing tournaments functionality...');
    await loadTournamentsList();
    setupTournamentEventListeners();
}

function setupTournamentEventListeners() {
    const backBtn = document.getElementById('tournaments-back');
    if (backBtn && !(backBtn as any)._listenerSet) {
        (backBtn as any)._listenerSet = true;
        backBtn.addEventListener('click', async () => {
            console.log('🔙 Tournaments back button clicked');
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
                <div class="text-center py-8 bg-gray-800 border border-gray-600 rounded-lg">
                    <p class="text-gray-300 mb-4">Aucun tournoi disponible pour le moment.</p>
                    <p class="text-sm text-gray-500">Les tournois 4-player apparaîtront ici une fois créés.</p>
                </div>
            `;
        } else {
            const rows = tournaments.map((t: any) => `
                <div class="p-4 border-b border-gray-600 flex justify-between items-center">
                    <div class="text-left">
                        <div class="font-medium text-white text-lg">${t.name}</div>
                        <div class="text-sm text-gray-400">Status: ${t.status} — ${t.current_players}/${t.max_players} joueurs</div>
                        ${t.max_players === 4 ? '<span class="text-xs bg-green-600 text-green-100 px-2 py-1 rounded-full mt-2 inline-block">4-Player</span>' : ''}
                    </div>
                    <div class="flex gap-2">
                        <button data-id="${t.id}" class="view-tournament px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Voir
                        </button>
                        ${t.status === 'registration' ? `
                            <button data-id="${t.id}" class="delete-tournament px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                🗑️ Supprimer
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
            listContainer!.innerHTML = `<div class="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">${rows}</div>`;
        }

        // Attach click handlers for view buttons
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

        // Attach click handlers for delete buttons
        document.querySelectorAll('.delete-tournament').forEach(btn => {
            if (!(btn as any)._listenerSet) {
                (btn as any)._listenerSet = true;
                
                (btn as HTMLElement).addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        const tournamentName = (e.currentTarget as HTMLElement).closest('.p-4')?.querySelector('.font-medium')?.textContent;
                        
                        if (confirm(`Êtes-vous sûr de vouloir supprimer le tournoi "${tournamentName}" ?\n\nCette action est irréversible.`)) {
                            try {
                                const response = await fetch(`/tournaments/${id}`, {
                                    method: 'DELETE',
                                    credentials: 'include'
                                });
                                
                                if (response.ok) {
                                    const result = await response.json();
                                    alert(result.message || 'Tournoi supprimé avec succès');
                                    // Recharger la liste des tournois
                                    await loadTournamentsList();
                                } else {
                                    const error = await response.json();
                                    alert(`Erreur: ${error.error || 'Impossible de supprimer le tournoi'}`);
                                }
                            } catch (error) {
                                alert('Erreur lors de la suppression du tournoi');
                                console.error('Tournament deletion error:', error);
                            }
                        }
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error loading tournaments:', error);
        listContainer!.innerHTML = '<p class="text-red-500 text-center py-4">Erreur lors du chargement des tournois.</p>';
    }
}
