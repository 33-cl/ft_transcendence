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

// Helper to create user_id -> alias map (matches use user_id, not participant.id)
function createPlayerAliasMap(participants: TournamentParticipant[]): Map<number, string> {
    const playerAliasMap = new Map<number, string>();
    if (participants && Array.isArray(participants)) {
        participants.forEach(participant => {
            if (participant && participant.user_id && participant.alias) {
                // Use user_id as key since matches reference user_id, not participant.id
                playerAliasMap.set(participant.user_id, participant.alias.trim());
            }
        });
    }
    console.log('🗺️ Player alias map (user_id -> alias):', Array.from(playerAliasMap.entries()));
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

// Helper to render a single match card
function renderMatchCard(
    match: TournamentMatch, 
    playerAliasMap: Map<number, string>, 
    label: string,
    currentUserId: number | null,
    tournamentId: string
): string {
    const player1 = getPlayerAlias(match.player1_id, playerAliasMap);
    const player2 = getPlayerAlias(match.player2_id, playerAliasMap);
    const winner = match.winner_id ? getPlayerAlias(match.winner_id, playerAliasMap) : null;
    
    let statusBadge = '';
    let borderColor = 'border-gray-300';
    
    if (match.status === 'finished' && winner) {
        statusBadge = `<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ ${winner}</span>`;
        borderColor = 'border-green-400';
    } else if (match.status === 'scheduled') {
        statusBadge = `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Scheduled</span>`;
        borderColor = 'border-blue-400';
    } else if (match.status === 'cancelled') {
        statusBadge = `<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Cancelled</span>`;
        borderColor = 'border-red-400';
    }

    // Highlight winner in player names
    const player1Class = match.winner_id === match.player1_id ? 'font-bold text-green-700' : '';
    const player2Class = match.winner_id === match.player2_id ? 'font-bold text-green-700' : '';

    // Check if current user is one of the players in this match
    // player1_id and player2_id are user_ids, not participant_ids
    const isCurrentUserInMatch = currentUserId !== null && (
        currentUserId === match.player1_id || currentUserId === match.player2_id
    );
    
    // DEBUG: Log match info to understand why button might not show
    console.log(`🎯 Match ${match.id} (${label}):`, {
        status: match.status,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        currentUserId,
        isCurrentUserInMatch
    });
    
    // Show "Play Match" button only if:
    // - Match is scheduled (not finished/cancelled)
    // - Both players are assigned
    // - Current user is one of the players
    const canPlay = match.status === 'scheduled' 
        && match.player1_id !== null 
        && match.player2_id !== null 
        && isCurrentUserInMatch;
    
    console.log(`🎮 canPlay for match ${match.id}: ${canPlay}`);

    const playButtonHtml = canPlay ? `
        <button 
            class="play-match-btn mt-2 w-full px-3 py-2 bg-orange-500 text-white text-sm font-medium rounded hover:bg-orange-600 transition-colors"
            data-tournament-id="${tournamentId}"
            data-match-id="${match.id}"
        >
            🎮 Play Match
        </button>
    ` : '';

    return `
        <div class="bracket-match bg-white border-2 ${borderColor} rounded-lg p-3 min-w-[180px] shadow-sm" data-match-id="${match.id}">
            <div class="text-xs text-gray-500 mb-2 font-semibold uppercase">${label}</div>
            <div class="space-y-1">
                <div class="flex items-center gap-2 ${player1Class}">
                    <span class="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">1</span>
                    <span class="truncate">${player1}</span>
                </div>
                <div class="text-center text-gray-400 text-xs">vs</div>
                <div class="flex items-center gap-2 ${player2Class}">
                    <span class="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">2</span>
                    <span class="truncate">${player2}</span>
                </div>
            </div>
            <div class="mt-2 text-center">
                ${statusBadge}
            </div>
            ${playButtonHtml}
        </div>
    `;
}

// Helper to generate bracket HTML as a visual tree (4-player tournament)
function renderBracketHtml(
    matchesByRound: Map<number, TournamentMatch[]>, 
    playerAliasMap: Map<number, string>, 
    tournament: Tournament,
    currentUserId: number | null
): string {
    if (matchesByRound.size === 0) {
        return '<p class="text-gray-500">No matches scheduled yet. The bracket will appear once the tournament starts.</p>';
    }
    
    // Get matches by round
    const semiFinals = matchesByRound.get(1) || [];
    const finals = matchesByRound.get(2) || [];
    const finalMatch = finals[0];
    
    // Determine champion (if tournament completed)
    let championHtml = '';
    if (tournament?.status === 'completed' && finalMatch?.winner_id) {
        const championAlias = getPlayerAlias(finalMatch.winner_id, playerAliasMap);
        championHtml = `
            <div class="flex flex-col items-center justify-center">
                <div class="text-4xl mb-2">🏆</div>
                <div class="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 text-center shadow-lg">
                    <div class="text-xs text-yellow-600 font-semibold uppercase mb-1">Champion</div>
                    <div class="text-xl font-bold text-yellow-800">${championAlias}</div>
                </div>
            </div>
        `;
    } else {
        championHtml = `
            <div class="flex flex-col items-center justify-center">
                <div class="text-4xl mb-2 opacity-30">🏆</div>
                <div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <div class="text-xs text-gray-500 font-semibold uppercase mb-1">Champion</div>
                    <div class="text-lg text-gray-400">TBD</div>
                </div>
            </div>
        `;
    }

    // Build semi-finals HTML
    const semi1Html = semiFinals[0] ? renderMatchCard(semiFinals[0], playerAliasMap, 'Semi-Final 1', currentUserId, tournament.id) : '';
    const semi2Html = semiFinals[1] ? renderMatchCard(semiFinals[1], playerAliasMap, 'Semi-Final 2', currentUserId, tournament.id) : '';
    const finalHtml = finalMatch ? renderMatchCard(finalMatch, playerAliasMap, 'Final', currentUserId, tournament.id) : `
        <div class="bracket-match bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-3 min-w-[180px]">
            <div class="text-xs text-gray-500 mb-2 font-semibold uppercase">Final</div>
            <div class="text-center text-gray-400 py-4">Waiting for semi-finals...</div>
        </div>
    `;

    // Visual bracket tree structure using flexbox
    return `
        <div class="bracket-container overflow-x-auto">
            <div class="flex items-center justify-center gap-4 min-w-[700px] py-4">
                <!-- Semi-Finals Column -->
                <div class="flex flex-col gap-8">
                    ${semi1Html}
                    ${semi2Html}
                </div>
                
                <!-- Connector Lines (Semi → Final) -->
                <div class="flex flex-col items-center justify-center h-48">
                    <svg width="40" height="200" class="text-gray-400">
                        <!-- Top line from Semi 1 -->
                        <line x1="0" y1="50" x2="20" y2="50" stroke="currentColor" stroke-width="2"/>
                        <line x1="20" y1="50" x2="20" y2="100" stroke="currentColor" stroke-width="2"/>
                        <!-- Bottom line from Semi 2 -->
                        <line x1="0" y1="150" x2="20" y2="150" stroke="currentColor" stroke-width="2"/>
                        <line x1="20" y1="150" x2="20" y2="100" stroke="currentColor" stroke-width="2"/>
                        <!-- Line to Final -->
                        <line x1="20" y1="100" x2="40" y2="100" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                
                <!-- Final Column -->
                <div class="flex items-center">
                    ${finalHtml}
                </div>
                
                <!-- Connector Line (Final → Champion) -->
                <div class="flex items-center">
                    <svg width="40" height="50" class="text-gray-400">
                        <line x1="0" y1="25" x2="40" y2="25" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                
                <!-- Champion Column -->
                ${championHtml}
            </div>
        </div>
    `;
}

// Main function to render tournament content
function renderTournamentContent(data: TournamentDetailResponse): string {
    const { tournament, participants, matches } = data;
    
    // Get current user ID from global state
    const currentUserId = (window as any).currentUser?.id || null;
    
    // Use helpers to process data
    const playerAliasMap = createPlayerAliasMap(participants);
    const matchesByRound = groupMatchesByRound(matches);
    const participantsHtml = renderParticipantsHtml(participants);
    const bracketHtml = renderBracketHtml(matchesByRound, playerAliasMap, tournament, currentUserId);
    
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
                    ${tournament.status === 'registration' && tournament.current_players < tournament.max_players ? `
                        <button id="join-tournament-btn" data-tournament-id="${tournament.id}" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors">
                            ➕ Join Tournament (${tournament.current_players}/${tournament.max_players})
                        </button>
                    ` : ''}
                    ${tournament.status === 'registration' && tournament.current_players >= tournament.max_players ? `
                        <span class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded font-medium">
                            ⏳ Waiting for tournament to start...
                        </span>
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

    // "Play Match" buttons (multiple buttons possible)
    const playBtns = document.querySelectorAll('.play-match-btn');
    playBtns.forEach(btn => {
        if (!(btn as any)._listenerSet) {
            (btn as any)._listenerSet = true;
            
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const tournamentId = target.dataset.tournamentId;
                const matchId = target.dataset.matchId;
                
                if (!tournamentId || !matchId) {
                    console.error('Missing tournament or match ID');
                    return;
                }
                
                try {
                    target.textContent = 'Starting...';
                    target.disabled = true;
                    
                    // Call API to create/get match room
                    const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/play`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({}) // Empty body required by Fastify
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const roomName = data.roomName;
                        
                        console.log(`🎮 Joining tournament match room: ${roomName}`);
                        
                        // Join the room via WebSocket
                        const socket = (window as any).socket;
                        if (socket) {
                            // Store tournament context for later use (e.g., returning to bracket)
                            (window as any).currentTournamentId = tournamentId;
                            (window as any).currentMatchId = matchId;
                            
                            socket.emit('joinRoom', { roomName });
                            // The 'roomJoined' event handler in websocket.ts will navigate to the game page
                        } else {
                            console.error('Socket not available');
                            alert('Connection error. Please refresh the page.');
                            target.textContent = '🎮 Play Match';
                            target.disabled = false;
                        }
                    } else {
                        const error = await response.json();
                        alert(`Error: ${error.error || 'Failed to start match'}`);
                        target.textContent = '🎮 Play Match';
                        target.disabled = false;
                    }
                } catch (error) {
                    console.error('Match start error:', error);
                    alert('Error starting match');
                    target.textContent = '🎮 Play Match';
                    target.disabled = false;
                }
            });
        }
    });
}
