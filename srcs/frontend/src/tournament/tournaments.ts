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

async function handleJoinTournament(tournamentId: string) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });
        
        if (response.ok) {
            await loadTournamentsList();
        } else {
            const error = await response.json();
            alert(`Erreur: ${error.error || 'Impossible de rejoindre le tournoi'}`);
        }
    } catch (error) {
        alert('Erreur lors de l\'inscription au tournoi');
        console.error('Tournament join error:', error);
    }
}

async function handleLeaveTournament(tournamentId: string) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });
        
        if (response.ok) {
            await loadTournamentsList();
        } else {
            const error = await response.json();
            alert(`Erreur: ${error.error || 'Impossible de quitter le tournoi'}`);
        }
    } catch (error) {
        alert('Erreur lors de la désinscription du tournoi');
        console.error('Tournament leave error:', error);
    }
}

async function handleCreateTournament() {
    const createForm = document.getElementById('tournament-create-form');
    const nameInput = document.getElementById('tournament-name-input') as HTMLInputElement;
    const createBtn = document.getElementById('create-tournament-btn');
    const name = nameInput?.value.trim();
    
    if (!name) {
        return;
    }
    
    try {
        const response = await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, maxPlayers: 4 })
        });
        
        if (response.ok) {
            // Cacher le formulaire et réafficher le bouton
            if (createForm) createForm.style.display = 'none';
            if (createBtn) createBtn.style.display = 'inline-block';
            nameInput.value = '';
            await loadTournamentsList();
        } else {
            const error = await response.json();
            alert(`Erreur: ${error.error || 'Impossible de créer le tournoi'}`);
            nameInput?.focus();
        }
    } catch (error) {
        alert('Erreur lors de la création du tournoi');
        console.error('Tournament creation error:', error);
    }
}

function cancelCreateTournament() {
    const createForm = document.getElementById('tournament-create-form');
    const createBtn = document.getElementById('create-tournament-btn');
    const nameInput = document.getElementById('tournament-name-input') as HTMLInputElement;
    
    if (createForm) createForm.style.display = 'none';
    if (createBtn) createBtn.style.display = 'inline-block';
    if (nameInput) nameInput.value = '';
}

async function handleDeleteTournament(tournamentId: string) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
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

function setupTournamentEventListeners() {
    const createBtn = document.getElementById('create-tournament-btn');
    const createForm = document.getElementById('tournament-create-form');
    const nameInput = document.getElementById('tournament-name-input') as HTMLInputElement;
    const confirmBtn = document.getElementById('confirm-create-btn');
    const cancelBtn = document.getElementById('cancel-create-btn');
    
    // Afficher le formulaire de création
    if (createBtn && !(createBtn as any)._listenerSet) {
        (createBtn as any)._listenerSet = true;
        createBtn.addEventListener('click', () => {
            if (createForm) createForm.style.display = 'flex';
            createBtn.style.display = 'none';
            setTimeout(() => nameInput?.focus(), 100);
        });
    }
    
    // Confirmer avec le bouton ✓
    if (confirmBtn && !(confirmBtn as any)._listenerSet) {
        (confirmBtn as any)._listenerSet = true;
        confirmBtn.addEventListener('click', async () => {
            await handleCreateTournament();
        });
    }
    
    // Annuler avec le bouton ✕
    if (cancelBtn && !(cancelBtn as any)._listenerSet) {
        (cancelBtn as any)._listenerSet = true;
        cancelBtn.addEventListener('click', () => {
            cancelCreateTournament();
        });
    }
    
    // Confirmer avec Enter
    if (nameInput && !(nameInput as any)._listenerSet) {
        (nameInput as any)._listenerSet = true;
        nameInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await handleCreateTournament();
            }
        });
        
        // Annuler avec Escape
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelCreateTournament();
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
                        ${t.status === 'registration' ? `
                            ${t.is_participant ? `
                                <button data-id="${t.id}" class="leave-tournament tournament-leave-btn">
                                    ✕ Quitter
                                </button>
                            ` : `
                                <button data-id="${t.id}" class="join-tournament tournament-join-btn">
                                    ➕ Rejoindre
                                </button>
                            `}
                            <button data-id="${t.id}" class="delete-tournament tournament-delete-btn">
                                🗑️ Supprimer
                            </button>
                        ` : `
                            <button disabled class="tournament-view-btn tournament-disabled">
                                ${t.status === 'active' ? 'En cours' : 'Terminé'}
                            </button>
                        `}
                    </div>
                </div>
            `).join('');
            listContainer!.innerHTML = `<div class="tournament-list-container">${rows}</div>`;
        }

        // Attach click handlers for join buttons
        document.querySelectorAll('.join-tournament').forEach(btn => {
            if (!(btn as any)._listenerSet) {
                (btn as any)._listenerSet = true;
                
                (btn as HTMLElement).addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        await handleJoinTournament(id);
                    }
                });
            }
        });

        // Attach click handlers for leave buttons
        document.querySelectorAll('.leave-tournament').forEach(btn => {
            if (!(btn as any)._listenerSet) {
                (btn as any)._listenerSet = true;
                
                (btn as HTMLElement).addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        await handleLeaveTournament(id);
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
                        await handleDeleteTournament(id);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error loading tournaments:', error);
        listContainer!.innerHTML = '<p class="text-red-500 text-center py-4">Erreur lors du chargement des tournois.</p>';
    }
}
