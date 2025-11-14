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
            alert(`Error: ${error.error || 'Failed to join tournament'}`);
        }
    } catch (error) {
        alert('Error when joining tournament');
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
            alert(`Error: ${error.error || 'Failed to leave tournament'}`);
        }
    } catch (error) {
        alert('Error when leaving tournament');
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
            // Hide form and show button again
            if (createForm) createForm.style.display = 'none';
            if (createBtn) createBtn.style.display = 'inline-block';
            nameInput.value = '';
            await loadTournamentsList();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to create tournament'}`);
            nameInput?.focus();
        }
    } catch (error) {
        alert('Error creating tournament');
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
            alert(`Error: ${error.error || 'Failed to delete tournament'}`);
        }
    } catch (error) {
        alert('Error deleting tournament');
        console.error('Tournament deletion error:', error);
    }
}

function setupTournamentEventListeners() {
    const createBtn = document.getElementById('create-tournament-btn');
    const createForm = document.getElementById('tournament-create-form');
    const nameInput = document.getElementById('tournament-name-input') as HTMLInputElement;
    const confirmBtn = document.getElementById('confirm-create-btn');
    const cancelBtn = document.getElementById('cancel-create-btn');
    
    // Show creation form
    if (createBtn && !(createBtn as any)._listenerSet) {
        (createBtn as any)._listenerSet = true;
        createBtn.addEventListener('click', () => {
            if (createForm) createForm.style.display = 'flex';
            createBtn.style.display = 'none';
            setTimeout(() => nameInput?.focus(), 100);
        });
    }
    
    // Confirm with ✓ button
    if (confirmBtn && !(confirmBtn as any)._listenerSet) {
        (confirmBtn as any)._listenerSet = true;
        confirmBtn.addEventListener('click', async () => {
            await handleCreateTournament();
        });
    }
    
    // Cancel with ✕ button
    if (cancelBtn && !(cancelBtn as any)._listenerSet) {
        (cancelBtn as any)._listenerSet = true;
        cancelBtn.addEventListener('click', () => {
            cancelCreateTournament();
        });
    }
    
    // Confirm with Enter
    if (nameInput && !(nameInput as any)._listenerSet) {
        (nameInput as any)._listenerSet = true;
        nameInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await handleCreateTournament();
            }
        });
        
        // Cancel with Escape
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
        // API call to fetch 4-player tournaments
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
                        <div class="tournament-item-status">Status: ${t.status} — ${t.current_players}/${t.max_players} players</div>
                        ${t.max_players === 4 ? '<span class="tournament-badge-4player">4-Player</span>' : ''}
                    </div>
                    <div class="tournament-actions">
                        ${t.status === 'registration' ? `
                            ${t.is_participant ? `
                                <button data-id="${t.id}" class="leave-tournament tournament-leave-btn">
                                    ✕ Leave
                                </button>
                            ` : `
                                <button data-id="${t.id}" class="join-tournament tournament-join-btn">
                                    ➕ Join
                                </button>
                            `}
                            ${t.is_creator ? `
                                <button data-id="${t.id}" class="delete-tournament tournament-delete-btn">
                                    🗑️ Delete
                                </button>
                            ` : ''}
                        ` : `
                            <button disabled class="tournament-view-btn tournament-disabled">
                                ${t.status === 'active' ? 'Ongoing' : 'Completed'}
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
        listContainer!.innerHTML = '<p class="text-red-500 text-center py-4">Error loading tournaments.</p>';
    }
}
