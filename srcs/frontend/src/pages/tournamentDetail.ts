import { load } from './utils.js';

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
        return '<p class="text-gray-500">Aucun participant</p>';
    }
    
    return participants
        .filter(p => p && p.alias) // Filtrer les participants invalides
        .map(p => `
            <div class="bg-gray-50 px-3 py-2 rounded border">
                <span class="font-medium">${p.alias.trim() || 'Alias vide'}</span>
                <span class="text-sm text-gray-500 ml-2">(ID: ${p.user_id || 'N/A'})</span>
            </div>
        `).join('');
}

// Helper pour générer le HTML du bracket par rounds
function renderBracketHtml(matchesByRound: Map<number, TournamentMatch[]>, playerAliasMap: Map<number, string>): string {
    if (matchesByRound.size === 0) {
        return '<p class="text-gray-500">Aucun match programmé</p>';
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
                    statusDisplayText = `Terminé - Gagnant: ${winner}`;
                    statusClass = 'text-green-600 font-medium';
                } else if (match.status === 'scheduled') {
                    statusDisplayText = 'Programmé';
                    statusClass = 'text-blue-600';
                } else if (match.status === 'cancelled') {
                    statusDisplayText = 'Annulé';
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

// Helper pour obtenir l'alias d'un joueur (robuste)
function getPlayerAlias(playerId: number | null, playerAliasMap: Map<number, string>): string {
    if (!playerId || playerId === 0) return 'BYE';
    const alias = playerAliasMap.get(playerId);
    if (!alias || alias.trim() === '') return `Unknown (ID: ${playerId})`;
    return alias;
}
