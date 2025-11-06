import { load } from '../navigation/utils.js';

// Types pour les données du tournoi
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
    max_players: number;
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

// Page de détail d'un tournoi (lecture seule)
export default async function renderTournamentDetail(tournamentId: string): Promise<void> {
    console.log(`📄 Rendering tournament detail for ID: ${tournamentId}`);
    
    const containerId = 'tournamentDetailPage';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'p-4 max-w-6xl mx-auto';
        document.body.appendChild(container);
    }

    // Affichage initial avec loading
    container.innerHTML = `
        <div class="mb-4">
            <button id="tournament-back" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">
                ← Retour aux tournois
            </button>
        </div>
        <div id="tournament-content">
            <div class="text-center py-8">
                <div class="text-lg">Chargement du tournoi...</div>
            </div>
        </div>
    `;

    // Event listener pour le bouton retour
    const backBtn = document.getElementById('tournament-back');
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            await load('tournaments');
        });
    }

    const contentContainer = document.getElementById('tournament-content');
    if (!contentContainer) return;

    try {
        // Fetch des données du tournoi
        // TEMPORAIRE: Données de test pour pouvoir tester la page
        // TODO: Remettre l'appel API une fois nginx configuré correctement
        const useTestData = true; // Changer à false quand l'API fonctionne
        
        if (useTestData && tournamentId.startsWith('test-')) {
            console.log('🧪 Using test data for tournament detail');
            
            // Simuler un délai d'API
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const testData: TournamentDetailResponse = {
                success: true,
                tournament: {
                    id: tournamentId,
                    name: tournamentId === 'test-1' ? 'Tournament Test 1' : 
                          tournamentId === 'test-2' ? 'Tournament Test 2' : 'Tournament Test 3',
                    status: tournamentId === 'test-1' ? 'registration' : 
                           tournamentId === 'test-2' ? 'active' : 'completed',
                    max_players: 8,
                    current_players: tournamentId === 'test-1' ? 3 : 8,
                    created_at: new Date().toISOString(),
                    started_at: tournamentId !== 'test-1' ? new Date().toISOString() : null,
                    completed_at: tournamentId === 'test-3' ? new Date().toISOString() : null
                },
                participants: [
                    { id: 1, tournament_id: tournamentId, user_id: 1, alias: 'Player1', joined_at: new Date().toISOString() },
                    { id: 2, tournament_id: tournamentId, user_id: 2, alias: 'Player2', joined_at: new Date().toISOString() },
                    { id: 3, tournament_id: tournamentId, user_id: 3, alias: 'Player3', joined_at: new Date().toISOString() },
                    ...(tournamentId !== 'test-1' ? [
                        { id: 4, tournament_id: tournamentId, user_id: 4, alias: 'Player4', joined_at: new Date().toISOString() },
                        { id: 5, tournament_id: tournamentId, user_id: 5, alias: 'Player5', joined_at: new Date().toISOString() },
                        { id: 6, tournament_id: tournamentId, user_id: 6, alias: 'Player6', joined_at: new Date().toISOString() },
                        { id: 7, tournament_id: tournamentId, user_id: 7, alias: 'Player7', joined_at: new Date().toISOString() },
                        { id: 8, tournament_id: tournamentId, user_id: 8, alias: 'Player8', joined_at: new Date().toISOString() }
                    ] : [])
                ],
                matches: tournamentId !== 'test-1' ? [
                    // Round 1
                    { id: 1, tournament_id: tournamentId, round: 1, player1_id: 1, player2_id: 2, winner_id: tournamentId === 'test-3' ? 1 : null, status: tournamentId === 'test-3' ? 'finished' : 'scheduled', scheduled_at: new Date().toISOString() },
                    { id: 2, tournament_id: tournamentId, round: 1, player1_id: 3, player2_id: 4, winner_id: tournamentId === 'test-3' ? 3 : null, status: tournamentId === 'test-3' ? 'finished' : 'scheduled', scheduled_at: new Date().toISOString() },
                    { id: 3, tournament_id: tournamentId, round: 1, player1_id: 5, player2_id: 6, winner_id: tournamentId === 'test-3' ? 5 : null, status: tournamentId === 'test-3' ? 'finished' : 'scheduled', scheduled_at: new Date().toISOString() },
                    { id: 4, tournament_id: tournamentId, round: 1, player1_id: 7, player2_id: 8, winner_id: tournamentId === 'test-3' ? 7 : null, status: tournamentId === 'test-3' ? 'finished' : 'scheduled', scheduled_at: new Date().toISOString() },
                    // Round 2 (demi-finales)
                    ...(tournamentId === 'test-3' ? [
                        { id: 5, tournament_id: tournamentId, round: 2, player1_id: 1, player2_id: 3, winner_id: 1, status: 'finished' as const, scheduled_at: new Date().toISOString() },
                        { id: 6, tournament_id: tournamentId, round: 2, player1_id: 5, player2_id: 7, winner_id: 7, status: 'finished' as const, scheduled_at: new Date().toISOString() },
                        // Round 3 (finale)
                        { id: 7, tournament_id: tournamentId, round: 3, player1_id: 1, player2_id: 7, winner_id: 1, status: 'finished' as const, scheduled_at: new Date().toISOString() }
                    ] : [])
                ] : []
            };
            
            console.log('Test tournament data:', testData);
            contentContainer.innerHTML = renderTournamentContent(testData);
        } else {
            // Code original avec appel API
            const response = await fetch(`/tournaments/${tournamentId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Tournoi non trouvé');
                }
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }

            const data: TournamentDetailResponse = await response.json();
            
            if (!data.success) {
                throw new Error('Réponse invalide du serveur');
            }

            console.log('Tournament data received:', data);

            // Validation des données critiques
            if (!data.tournament || !data.tournament.id) {
                throw new Error('Données de tournoi invalides');
            }

            // Construire la page avec les données
            contentContainer.innerHTML = renderTournamentContent(data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement du tournoi:', error);
        contentContainer.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <h2 class="text-xl font-bold mb-2">Erreur</h2>
                <p>${error instanceof Error ? error.message : 'Erreur inconnue lors du chargement du tournoi'}</p>
            </div>
        `;
    }

    // Assurer que la page est visible
    container.style.display = 'block';
}

// Helper pour créer la map user_id -> alias (robuste)
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

// Helper pour grouper les matchs par round (robuste)
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

// Helper pour générer le HTML des participants (robuste)
function renderParticipantsHtml(participants: TournamentParticipant[]): string {
    if (!participants || participants.length === 0) {
        return '<p class="text-gray-500">No participants</p>';
    }
    
    return participants
        .filter(p => p && p.alias) // Filtrer les participants invalides
        .map(p => `
            <div class="bg-gray-50 px-3 py-2 rounded border">
                <span class="font-medium">${p.alias.trim() || 'Empty alias'}</span>
                <span class="text-sm text-gray-500 ml-2">(ID: ${p.user_id || 'N/A'})</span>
            </div>
        `).join('');
}

// Helper pour générer le HTML du bracket par rounds
function renderBracketHtml(matchesByRound: Map<number, TournamentMatch[]>, playerAliasMap: Map<number, string>): string {
    if (matchesByRound.size === 0) {
        return '<p class="text-gray-500">No matches scheduled</p>';
    }
    
    return Array.from(matchesByRound.entries())
        .sort(([a], [b]) => a - b) // Trier par numéro de round
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

// Fonction principale de rendu du contenu du tournoi
function renderTournamentContent(data: TournamentDetailResponse): string {
    const { tournament, participants, matches } = data;
    
    // Utiliser les helpers pour traiter les données
    const playerAliasMap = createPlayerAliasMap(participants);
    const matchesByRound = groupMatchesByRound(matches);
    const participantsHtml = renderParticipantsHtml(participants);
    const bracketHtml = renderBracketHtml(matchesByRound, playerAliasMap);
    
    // Statut du tournoi avec couleur
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
            <!-- En-tête du tournoi -->
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
            </div>

            <!-- Section Participants -->
            <div class="bg-white shadow rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 text-gray-800">Participants</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    ${participantsHtml}
                </div>
            </div>

            <!-- Section Bracket -->
            <div class="bg-white shadow rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 text-gray-800">Bracket</h2>
                <div class="space-y-4">
                    ${bracketHtml}
                </div>
            </div>
        </div>
    `;
}

// Helper pour obtenir l'alias d'un joueur (robuste)
function getPlayerAlias(playerId: number | null, playerAliasMap: Map<number, string>): string {
    if (!playerId || playerId === 0) return 'BYE';
    const alias = playerAliasMap.get(playerId);
    if (!alias || alias.trim() === '') return `Unknown (ID: ${playerId})`;
    return alias;
}
