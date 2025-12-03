// Page tournaments: liste des tournois 4-player (legacy, not used anymore) (couche UI dans le navigateur)

import { load } from '../navigation/utils.js';

// Navigate to tournament detail page
function navigateToTournamentDetail(tournamentId: string) {
    console.log(`🏆 Navigating to tournament detail: ${tournamentId}`);
    load(`tournaments/${tournamentId}`);
}

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
    console.log('🔄 loadTournamentsList() called');
    const listContainer = document.getElementById('tournaments-list');
    console.log('📦 listContainer:', listContainer);
    if (!listContainer) {
        console.error('❌ tournaments-list container not found!');
        return;
    }
    
    try {
        // API call to fetch 4-player tournaments
        console.log('📡 Fetching tournaments from /api/tournaments...');
        const res = await fetch('/api/tournaments', { method: 'GET', credentials: 'include' });
        console.log('📡 Response status:', res.status);
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data = await res.json();
        console.log('📋 Tournaments data:', data);
        const tournaments = data.tournaments || [];

        if (tournaments.length === 0) {
            console.log('📭 No tournaments found');
            listContainer!.innerHTML = '<p class="text-gray-400 text-center py-4">No tournaments yet. Create one!</p>';
        } else {
            console.log(`📋 Rendering ${tournaments.length} tournaments`);
            const rows = tournaments.map((t: any) => `
                <div class="tournament-item" data-tournament-id="${t.id}" style="cursor: pointer;">
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
                            <button data-id="${t.id}" class="view-tournament tournament-view-btn-active">
                                ${t.status === 'active' ? '🏆 View Bracket' : '📊 Results'}
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
                    e.stopPropagation(); // Prevent navigation when clicking join
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
                    e.stopPropagation(); // Prevent navigation when clicking leave
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
                    e.stopPropagation(); // Prevent navigation when clicking delete
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        await handleDeleteTournament(id);
                    }
                });
            }
        });

        // Attach click handlers for view bracket buttons
        document.querySelectorAll('.view-tournament').forEach(btn => {
            if (!(btn as any)._listenerSet) {
                (btn as any)._listenerSet = true;
                
                (btn as HTMLElement).addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        navigateToTournamentDetail(id);
                    }
                });
            }
        });

        // Attach click handlers for tournament items (entire row clickable)
        document.querySelectorAll('.tournament-item').forEach(item => {
            if (!(item as any)._navListenerSet) {
                (item as any)._navListenerSet = true;
                
                (item as HTMLElement).addEventListener('click', (e) => {
                    // Only navigate if the click wasn't on a button
                    if ((e.target as HTMLElement).closest('button')) return;
                    const id = (item as HTMLElement).getAttribute('data-tournament-id');
                    if (id) {
                        navigateToTournamentDetail(id);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error loading tournaments:', error);
        listContainer!.innerHTML = '<p class="text-red-500 text-center py-4">Error loading tournaments.</p>';
    }
}
