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
    const createBtn = document.getElementById('create-tournament-btn');
    if (createBtn && !(createBtn as any)._listenerSet) {
        (createBtn as any)._listenerSet = true;
        createBtn.addEventListener('click', async () => {
            const name = prompt('Nom du tournoi 4-player:');
            if (name && name.trim()) {
                try {
                    const response = await fetch('/api/tournaments', {
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
        const res = await fetch('/api/tournaments', { method: 'GET', credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data = await res.json();
        const tournaments = data.tournaments || [];

        if (tournaments.length === 0) {
            listContainer!.innerHTML = '';
        } else {
            const rows = tournaments.map((t: any) => `
                <div class="tournament-item">
                    <div class="tournament-item-info">
                        <div class="tournament-item-name">${t.name}</div>
                        <div class="tournament-item-status">Status: ${t.status} — ${t.current_players}/${t.max_players} joueurs</div>
                        ${t.max_players === 4 ? '<span class="tournament-badge-4player">4-Player</span>' : ''}
                    </div>
                    <div class="tournament-actions">
                        <button data-id="${t.id}" class="view-tournament tournament-view-btn">
                            Voir
                        </button>
                        ${t.status === 'registration' ? `
                            <button data-id="${t.id}" class="delete-tournament tournament-delete-btn">
                                🗑️ Supprimer
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
            listContainer!.innerHTML = `<div class="tournament-list-container">${rows}</div>`;
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
