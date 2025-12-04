// tournamentSocket.ts - WebSocket handlers for tournament real-time updates

import { toast } from '../shared/toast.js';

let tournamentListenersActive = false;

/**
 * Configure les listeners WebSocket pour les événements de tournoi
 */
export function setupTournamentSocketListeners(): void {
    const socket = (window as any).socket;
    if (!socket) {
        console.warn('⚠️ Socket not available for tournament listeners');
        return;
    }

    if (tournamentListenersActive) {
        console.log('📡 Tournament socket listeners already active');
        return;
    }

    tournamentListenersActive = true;
    console.log('📡 Setting up tournament socket listeners');

    // Quand un match se termine
    socket.on('tournament:match_finished', (data: {
        tournament_id: string;
        match_id: number;
        winner_id: number;
        round: number;
        timestamp: string;
    }) => {
        console.log('🎮 Tournament match finished:', data);
        
        // Si on est sur la page de détail du tournoi, rafraîchir
        const tournamentDetailPage = document.getElementById('tournamentDetailPage');
        if (tournamentDetailPage && tournamentDetailPage.style.display !== 'none') {
            const currentTournamentId = (window as any).currentTournamentId;
            if (currentTournamentId === data.tournament_id) {
                console.log('🔄 Refreshing tournament bracket...');
                // Recharger la page de détail du tournoi
                import('./tournamentDetail.js').then(module => {
                    module.default(data.tournament_id);
                });
            }
        }
    });

    // Quand le tournoi démarre (bracket généré)
    socket.on('tournament:started', (data: {
        tournament_id: string;
        matches: Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>;
        timestamp: string;
    }) => {
        console.log('🏁 Tournament started:', data);
        
        // Si on est sur la page des tournois, rafraîchir
        const tournamentsPage = document.getElementById('tournaments');
        if (tournamentsPage && tournamentsPage.style.display !== 'none') {
            console.log('🔄 Refreshing tournaments list...');
            import('./tournaments.js').then(module => {
                module.default();
            });
        }
        
        // Si on est sur la page de détail du tournoi, rafraîchir
        const tournamentDetailPage = document.getElementById('tournamentDetailPage');
        if (tournamentDetailPage && tournamentDetailPage.style.display !== 'none') {
            const currentTournamentId = (window as any).currentTournamentId;
            if (currentTournamentId === data.tournament_id) {
                import('./tournamentDetail.js').then(module => {
                    module.default(data.tournament_id);
                });
            }
        }
    });

    // Quand le tournoi est terminé
    socket.on('tournament:completed', (data: {
        tournament_id: string;
        champion_id: number;
        timestamp: string;
    }) => {
        console.log('🏆 Tournament completed! Champion:', data.champion_id);
        
        // Afficher une notification
        showChampionNotification(data.champion_id);
        
        // Rafraîchir la page de détail si on y est
        const tournamentDetailPage = document.getElementById('tournamentDetailPage');
        if (tournamentDetailPage && tournamentDetailPage.style.display !== 'none') {
            const currentTournamentId = (window as any).currentTournamentId;
            if (currentTournamentId === data.tournament_id) {
                import('./tournamentDetail.js').then(module => {
                    module.default(data.tournament_id);
                });
            }
        }
        
        // NOTE: Ne pas nettoyer les variables ici, car l'écran de fin de match
        // en a besoin pour afficher correctement "Back to Tournament" au lieu de "Play Again".
        // Les variables seront nettoyées lors de la navigation vers le menu principal.
    });

    // Quand un joueur rejoint/quitte le tournoi
    socket.on('tournament:player_update', (data: {
        tournament_id: string;
        action: 'joined' | 'left';
        participant: { user_id: number; alias: string; current_players: number };
        timestamp: string;
    }) => {
        console.log(`👤 Tournament player ${data.action}:`, data.participant);
        
        // Rafraîchir les listes si on est sur les pages concernées
        const tournamentsPage = document.getElementById('tournaments');
        if (tournamentsPage && tournamentsPage.style.display !== 'none') {
            import('./tournaments.js').then(module => {
                module.default();
            });
        }
        
        const tournamentDetailPage = document.getElementById('tournamentDetailPage');
        if (tournamentDetailPage && tournamentDetailPage.style.display !== 'none') {
            const currentTournamentId = (window as any).currentTournamentId;
            if (currentTournamentId === data.tournament_id) {
                import('./tournamentDetail.js').then(module => {
                    module.default(data.tournament_id);
                });
            }
        }
    });

    // Quand un match est prêt à être joué
    socket.on('tournament:match_ready', (data: {
        tournament_id: string;
        match: { id: number; round: number; player1_id: number; player2_id: number };
        timestamp: string;
    }) => {
        console.log('🎮 Tournament match ready:', data);
        
        // Vérifier si le joueur courant est dans ce match
        const currentUserId = (window as any).currentUser?.id;
        if (currentUserId === data.match.player1_id || currentUserId === data.match.player2_id) {
            // Déterminer le nom du round
            const roundName = data.match.round === 1 ? 'Semi-Final' : 'Final';
            
            // Afficher une notification toast
            toast.matchReady(data.tournament_id, data.match.id, roundName);
        }
    });
}

/**
 * Nettoie les listeners WebSocket de tournoi
 */
export function cleanupTournamentSocketListeners(): void {
    const socket = (window as any).socket;
    if (!socket) return;

    socket.off('tournament:match_finished');
    socket.off('tournament:started');
    socket.off('tournament:completed');
    socket.off('tournament:player_update');
    socket.off('tournament:match_ready');
    
    tournamentListenersActive = false;
    console.log('🧹 Tournament socket listeners cleaned up');
}

/**
 * Rejoint la room WebSocket du tournoi
 */
export function joinTournamentRoom(tournamentId: string): void {
    const socket = (window as any).socket;
    if (!socket) return;

    socket.emit('joinTournamentRoom', { tournamentId });
    console.log(`🔌 Joined tournament room: ${tournamentId}`);
}

/**
 * Quitte la room WebSocket du tournoi
 */
export function leaveTournamentRoom(tournamentId: string): void {
    const socket = (window as any).socket;
    if (!socket) return;

    socket.emit('leaveTournamentRoom', { tournamentId });
    console.log(`🔌 Left tournament room: ${tournamentId}`);
}

/**
 * Affiche une notification quand le champion est déclaré
 */
function showChampionNotification(championId: number): void {
    // TODO: Récupérer le nom du champion et afficher une belle notification
    console.log(`🏆 Champion notification for user ${championId}`);
    
    // Simple alert pour l'instant
    // En production, utiliser un toast ou une modal
}
