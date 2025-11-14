import { load } from '../navigation/utils.js';

// Types for tournament data (4-player specs)
interface TournamentParticipant {
    id: number;
    tournament_id: string;
    user_id: number;
    alias: string;
    joined_at: string;
}

interface TournamentMatch {
    id: number;
    tournament_id: string;
    round: number;
    player1_id: number | null;
    player2_id: number | null;
    winner_id: number | null;
    status: 'scheduled' | 'finished' | 'cancelled';
    scheduled_at: string | null;
}

interface Tournament {
    id: string;
    name: string;
    status: 'registration' | 'active' | 'completed' | 'cancelled';
    max_players: number; // Should be 4 for our specs
    current_players: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}

interface TournamentDetailResponse {
    success: boolean;
    tournament: Tournament;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
}

// Tournament detail page (4-player tournament management)
export default async function renderTournamentDetail(tournamentId: string): Promise<void> {
    console.log(`📄 Rendering tournament detail for ID: ${tournamentId}`);
    
    // Hide existing content without breaking structure
    const mainContent = document.querySelector('main') || document.body;
    
    const containerId = 'tournamentDetailPage';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'p-4 max-w-6xl mx-auto';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = 'white';
        container.style.zIndex = '1000';
        mainContent.appendChild(container);
    }
    
    // Show container
    container.style.display = 'block';

    // Initial display with loading
    container.innerHTML = `
        <div class="mb-4">
            <button id="tournament-back" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">
                ← Back to tournaments
            </button>
        </div>
        <div id="tournament-content">
            <div class="text-center py-8">
                <div class="text-lg">Loading tournament...</div>
            </div>
        </div>
    `;

    // Event listener for back button
    const backBtn = document.getElementById('tournament-back');
    if (backBtn && !(backBtn as any)._listenerSet) {
        (backBtn as any)._listenerSet = true;
        backBtn.addEventListener('click', async () => {
            // Completely remove tournament detail page
            const detailPage = document.getElementById('tournamentDetailPage');
            if (detailPage) {
                detailPage.remove();
            }
            await load('tournaments');
        });
    }

    const contentContainer = document.getElementById('tournament-content');
    if (!contentContainer) return;

    try {
        // Fetch tournament data via API
        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Tournament not found');
            }
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data: TournamentDetailResponse = await response.json();
        
        if (!data.success) {
            throw new Error('Invalid server response');
        }

        console.log('Tournament data received:', data);
        console.log('Tournament object:', data.tournament);
        console.log('Participants:', data.participants);

        // Validation of critical data
        if (!data.tournament || !data.tournament.id) {
            console.error('❌ Invalid tournament data:', data);
            throw new Error('Invalid tournament data');
        }
        
        console.log('✅ Valid data, rendering...');

        // Build page with data
        contentContainer.innerHTML = renderTournamentContent(data);
        
        // Attach event listeners for action buttons
        attachTournamentActionListeners(data.tournament);
    } catch (error) {
        console.error('Error loading tournament:', error);
        contentContainer.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <h2 class="text-xl font-bold mb-2">Error</h2>
                <p>${error instanceof Error ? error.message : 'Unknown error while loading tournament'}</p>
            </div>
        `;
    }

    // Ensure page is visible
    container.style.display = 'block';
}

// Helper to create user_id -> alias map (robust)
function createPlayerAliasMap(participants: TournamentParticipant[]): Map<number, string> {
    const playerAliasMap = new Map<number, string>();
    if (participants && Array.isArray(participants)) {
        participants.forEach(participant => {
            if (participant && participant.user_id && participant.alias) {
                playerAliasMap.set(participant.user_id, participant.alias.trim());
            }
        });
    }
    return playerAliasMap;
}

// Helper to group matches by round (robust)
function groupMatchesByRound(matches: TournamentMatch[]): Map<number, TournamentMatch[]> {
    const matchesByRound = new Map<number, TournamentMatch[]>();
    if (matches && Array.isArray(matches)) {
        matches.forEach(match => {
            if (match && typeof match.round === 'number' && match.round > 0) {
                if (!matchesByRound.has(match.round)) {
                    matchesByRound.set(match.round, []);
                }
                matchesByRound.get(match.round)!.push(match);
            }
        });
    }
    return matchesByRound;
}

// Helper to generate participants HTML (robust)
function renderParticipantsHtml(participants: TournamentParticipant[]): string {
    if (!participants || participants.length === 0) {
        return '<p class="text-gray-500">No participants</p>';
    }
    
    return participants
        .filter(p => p && p.alias) // Filter invalid participants
        .map(p => `
            <div class="bg-gray-50 px-3 py-2 rounded border">
                <span class="font-medium">${p.alias.trim() || 'Empty alias'}</span>
                <span class="text-sm text-gray-500 ml-2">(ID: ${p.user_id || 'N/A'})</span>
            </div>
        `).join('');
}

// Helper to generate bracket HTML by rounds
function renderBracketHtml(matchesByRound: Map<number, TournamentMatch[]>, playerAliasMap: Map<number, string>): string {
    if (matchesByRound.size === 0) {
        return '<p class="text-gray-500">No matches scheduled</p>';
    }
    
    return Array.from(matchesByRound.entries())
        .sort(([a], [b]) => a - b) // Sort by round number
        .map(([round, roundMatches]) => {
            const matchesHtml = roundMatches.map(match => {
                const player1 = getPlayerAlias(match.player1_id, playerAliasMap);
                const player2 = getPlayerAlias(match.player2_id, playerAliasMap);
                const winner = match.winner_id ? getPlayerAlias(match.winner_id, playerAliasMap) : null;
                
                let statusDisplayText: string = match.status;
                let statusClass = 'text-gray-600';
                
                if (match.status === 'finished' && winner) {
                    statusDisplayText = `Finished - Winner: ${winner}`;
                    statusClass = 'text-green-600 font-medium';
                } else if (match.status === 'scheduled') {
                    statusDisplayText = 'Scheduled';
                    statusClass = 'text-blue-600';
                } else if (match.status === 'cancelled') {
                    statusDisplayText = 'Cancelled';
                    statusClass = 'text-red-600';
                }

                return `
                    <div class="bg-white border rounded p-3 mb-2">
                        <div class="flex justify-between items-center">
                            <div class="font-medium">
                                ${player1} <span class="text-gray-400">vs</span> ${player2}
                            </div>
                            <div class="text-sm ${statusClass}">
                                ${statusDisplayText}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 text-blue-800">Round ${round}</h3>
                    <div class="space-y-2">
                        ${matchesHtml}
                    </div>
                </div>
            `;
        }).join('');
}

// Main function to render tournament content
function renderTournamentContent(data: TournamentDetailResponse): string {
    const { tournament, participants, matches } = data;
    
    // Use helpers to process data
    const playerAliasMap = createPlayerAliasMap(participants);
    const matchesByRound = groupMatchesByRound(matches);
    const participantsHtml = renderParticipantsHtml(participants);
    const bracketHtml = renderBracketHtml(matchesByRound, playerAliasMap);
    
    // Tournament status with color
    let statusClass = 'text-gray-600';
    let statusDisplayText: string = tournament.status;
    
    switch (tournament.status) {
        case 'registration':
            statusClass = 'text-blue-600';
            statusDisplayText = 'Registration Open';
            break;
        case 'active':
            statusClass = 'text-green-600';
            statusDisplayText = 'In Progress';
            break;
        case 'completed':
            statusClass = 'text-purple-600';
            statusDisplayText = 'Completed';
            break;
        case 'cancelled':
            statusClass = 'text-red-600';
            statusDisplayText = 'Cancelled';
            break;
    }

    return `
        <div class="space-y-6">
            <!-- Tournament Header -->
            <div class="bg-white shadow rounded-lg p-6">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">${tournament.name}</h1>
                <div class="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span class="px-3 py-1 rounded-full bg-gray-100">
                        ID: ${tournament.id}
                    </span>
                    <span class="px-3 py-1 rounded-full ${statusClass.replace('text-', 'bg-').replace('-600', '-100')} ${statusClass}">
                        ${statusDisplayText}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-gray-100">
                        ${tournament.current_players || 0}/${tournament.max_players || 0} players
                    </span>
                    <span class="px-3 py-1 rounded-full bg-gray-100">
                        Created: ${tournament.created_at ? new Date(tournament.created_at).toLocaleDateString('en-US') : 'Unknown date'}
                    </span>
                </div>
                
                <!-- Tournament Action Buttons -->
                <div class="mt-4 flex gap-3">
                    ${tournament.status === 'registration' && tournament.current_players >= tournament.max_players ? `
                        <button id="start-tournament-btn" data-tournament-id="${tournament.id}" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors">
                            🚀 Start Tournament
                        </button>
                    ` : ''}
                    ${tournament.status === 'registration' && tournament.current_players < tournament.max_players ? `
                        <button id="join-tournament-btn" data-tournament-id="${tournament.id}" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors">
                            ➕ Join Tournament (${tournament.current_players}/${tournament.max_players})
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Participants Section -->
            <div class="bg-white shadow rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 text-gray-800">Participants</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    ${participantsHtml}
                </div>
            </div>

            <!-- Bracket Section -->
            <div class="bg-white shadow rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 text-gray-800">Bracket</h2>
                <div class="space-y-4">
                    ${bracketHtml}
                </div>
            </div>
        </div>
    `;
}

// Helper to get player alias (robust)
function getPlayerAlias(playerId: number | null, playerAliasMap: Map<number, string>): string {
    if (!playerId || playerId === 0) return 'BYE';
    const alias = playerAliasMap.get(playerId);
    if (!alias || alias.trim() === '') return `Unknown (ID: ${playerId})`;
    return alias;
}

// Attach event listeners for tournament action buttons
function attachTournamentActionListeners(tournament: Tournament): void {
    // "Join Tournament" button
    const joinBtn = document.getElementById('join-tournament-btn');
    if (joinBtn && !(joinBtn as any)._listenerSet) {
        (joinBtn as any)._listenerSet = true;
        
        joinBtn.addEventListener('click', async () => {
            try {
                joinBtn.textContent = 'Joining...';
                (joinBtn as HTMLButtonElement).disabled = true;
                
                const response = await fetch(`/api/tournaments/${tournament.id}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    // Reload page to show update
                    await renderTournamentDetail(tournament.id);
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.error || 'Failed to join tournament'}`);
                    joinBtn.textContent = `➕ Join Tournament (${tournament.current_players}/${tournament.max_players})`;
                    (joinBtn as HTMLButtonElement).disabled = false;
                }
            } catch (error) {
                console.error('Tournament join error:', error);
                alert('Error when joining tournament');
                joinBtn.textContent = `➕ Join Tournament (${tournament.current_players}/${tournament.max_players})`;
                (joinBtn as HTMLButtonElement).disabled = false;
            }
        });
    }

    // "Start Tournament" button 
    const startBtn = document.getElementById('start-tournament-btn');
    if (startBtn && !(startBtn as any)._listenerSet) {
        (startBtn as any)._listenerSet = true;
        
        startBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to start this tournament? This action is irreversible.')) {
                return;
            }
            
            try {
                startBtn.textContent = 'Starting...';
                (startBtn as HTMLButtonElement).disabled = true;
                
                // Call manual start route
                const response = await fetch(`/api/tournaments/${tournament.id}/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    // Reload page to see started tournament
                    await renderTournamentDetail(tournament.id);
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.error || 'Failed to start tournament'}`);
                    startBtn.textContent = '🚀 Start Tournament';
                    (startBtn as HTMLButtonElement).disabled = false;
                }
                
            } catch (error) {
                console.error('Tournament start error:', error);
                alert('Error when starting tournament');
                startBtn.textContent = '🚀 Start Tournament';
                (startBtn as HTMLButtonElement).disabled = false;
            }
        });
    }
}
