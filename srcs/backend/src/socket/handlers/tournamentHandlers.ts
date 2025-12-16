// socket/handlers/tournamentHandlers.ts - WebSocket handlers for tournament real-time updates

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType, TournamentState } from '../../types.js';
import { rooms } from '../roomManager.js';
import { PongGame } from '../../../game/PongGame.js';
import { updateUserStats } from '../../user.js';
import { getGlobalIo } from '../socketHandlers.js';
import { getSocketIdForUser } from '../socketAuth.js';
import { notifyFriendsGameEnded } from './gameEndHandlers.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';

/**
 * Émet un événement quand un joueur rejoint ou quitte un tournoi
 * @param tournamentId - UUID du tournoi
 * @param action - 'joined' ou 'left'
 * @param participant - Données du participant
 */
export function emitTournamentPlayerUpdate(
    tournamentId: string,
    action: 'joined' | 'left',
    participant: { user_id: number; alias: string; current_players: number }
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:player_update', {
        tournament_id: tournamentId,
        action,
        participant,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:player_update (${action}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un tournoi démarre
 * @param tournamentId - UUID du tournoi
 * @param matches - Liste des matchs générés
 */
export function emitTournamentStarted(
    tournamentId: string,
    matches: Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:started', {
        tournament_id: tournamentId,
        matches,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:started for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un match est prêt à être joué
 * @param tournamentId - UUID du tournoi
 * @param match - Données du match
 */
export function emitMatchReady(
    tournamentId: string,
    match: { id: number; round: number; player1_id: number; player2_id: number }
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:match_ready', {
        tournament_id: tournamentId,
        match,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:match_ready (match ${match.id}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un match se termine
 * @param tournamentId - UUID du tournoi
 * @param matchId - ID du match
 * @param winnerId - ID du gagnant
 * @param round - Round du match (1 = semi-final, 2 = final)
 */
export function emitMatchFinished(
    tournamentId: string,
    matchId: number,
    winnerId: number,
    round: number
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:match_finished', {
        tournament_id: tournamentId,
        match_id: matchId,
        winner_id: winnerId,
        round,
        timestamp: new Date().toISOString()
    });

    console.log(`📡 WebSocket: tournament:match_finished (match ${matchId}, winner ${winnerId}) for tournament ${tournamentId}`);
}

/**
 * Émet un événement quand un tournoi se termine
 * @param tournamentId - UUID du tournoi
 * @param championId - ID du champion
 */
export function emitTournamentCompleted(
    tournamentId: string,
    championId: number
): void {
    const io = getGlobalIo();
    if (!io) return;

    io.to(`tournament:${tournamentId}`).emit('tournament:completed', {
        tournament_id: tournamentId,
        champion_id: championId,
        timestamp: new Date().toISOString()
    });

    console.log(`🏆 WebSocket: tournament:completed for tournament ${tournamentId}, champion: ${championId}`);
}

/**
 * Fait rejoindre un socket à une room de tournoi
 * @param socketId - ID du socket
 * @param tournamentId - UUID du tournoi
 */
export function joinTournamentRoom(socketId: string, tournamentId: string): void {
    const io = getGlobalIo();
    if (!io) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.join(`tournament:${tournamentId}`);
    console.log(`🔌 Socket ${socketId} joined tournament room: tournament:${tournamentId}`);
}

/**
 * Fait quitter un socket d'une room de tournoi
 * @param socketId - ID du socket
 * @param tournamentId - UUID du tournoi
 */
export function leaveTournamentRoom(socketId: string, tournamentId: string): void {
    const io = getGlobalIo();
    if (!io) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.leave(`tournament:${tournamentId}`);
    console.log(`🔌 Socket ${socketId} left tournament room: tournament:${tournamentId}`);
}

// ========================================
// SIMPLIFIED TOURNAMENT SYSTEM (4 players)
// ========================================

/**
 * Initialise l'état du tournoi quand la room est pleine
 */
export function initializeTournamentState(room: RoomType): void {
    if (!room.isTournament || room.players.length !== 4) return;
    
    room.tournamentState = {
        phase: 'waiting',
        players: [...room.players],
        playerUsernames: { ...(room.playerUsernames || {}) },
        playerUserIds: { ...(room.playerUserIds || {}) },
    };
}

/**
 * Crée une structure de match de demi-finale
 */
function createSemifinalMatch(player1: string, player2: string): import('../../types.js').SemifinalMatch {
    return {
        player1,
        player2,
        paddleBySocket: {
            [player1]: 'LEFT',
            [player2]: 'RIGHT'
        },
        paddleInputs: {
            LEFT: { up: false, down: false },
            RIGHT: { up: false, down: false }
        },
        finished: false
    };
}

/**
 * Démarre les deux demi-finales simultanément
 */
export function startSemifinals(
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void {
    if (!room.tournamentState) return;
    
    const state = room.tournamentState;
    state.phase = 'semifinals';
    
    // Créer les 2 matchs de demi-finale
    const sf1Player1 = state.players[0];
    const sf1Player2 = state.players[1];
    const sf2Player1 = state.players[2];
    const sf2Player2 = state.players[3];
    
    state.semifinal1 = createSemifinalMatch(sf1Player1, sf1Player2);
    state.semifinal2 = createSemifinalMatch(sf2Player1, sf2Player2);
    
    console.log(`🎮 Tournament: Starting BOTH Semi-finals simultaneously`);
    console.log(`   SF1: ${state.playerUsernames[sf1Player1]} vs ${state.playerUsernames[sf1Player2]}`);
    console.log(`   SF2: ${state.playerUsernames[sf2Player1]} vs ${state.playerUsernames[sf2Player2]}`);
    
    // Créer les callbacks de fin pour chaque demi-finale
    const onSemifinal1End = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        handleSemifinalEnd(1, winner, room, roomName, io, fastify);
    };
    
    const onSemifinal2End = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        handleSemifinalEnd(2, winner, room, roomName, io, fastify);
    };
    
    // Créer les jeux Pong pour chaque demi-finale
    state.semifinal1.pongGame = new PongGame(2, onSemifinal1End);
    state.semifinal2.pongGame = new PongGame(2, onSemifinal2End);
    
    // Démarrer les 2 jeux
    state.semifinal1.pongGame.start();
    state.semifinal2.pongGame.start();
    
    // Notifier les joueurs de la demi-finale 1
    io.to(sf1Player1).emit('roomJoined', {
        paddle: 'LEFT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        semifinal: 1
    });
    io.to(sf1Player2).emit('roomJoined', {
        paddle: 'RIGHT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        semifinal: 1
    });
    
    // Notifier les joueurs de la demi-finale 2
    io.to(sf2Player1).emit('roomJoined', {
        paddle: 'LEFT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        semifinal: 2
    });
    io.to(sf2Player2).emit('roomJoined', {
        paddle: 'RIGHT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        semifinal: 2
    });
    
    // Envoyer l'update du tournoi à tous
    io.to(roomName).emit('tournamentUpdate', {
        phase: 'semifinals',
        message: 'Both semi-finals starting!',
        semifinal1: {
            player1: state.playerUsernames[sf1Player1] || 'Player 1',
            player2: state.playerUsernames[sf1Player2] || 'Player 2'
        },
        semifinal2: {
            player1: state.playerUsernames[sf2Player1] || 'Player 3',
            player2: state.playerUsernames[sf2Player2] || 'Player 4'
        }
    });
}

/**
 * Gère la fin d'une demi-finale
 */
function handleSemifinalEnd(
    semifinalNumber: 1 | 2,
    winner: { side: string; score: number },
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void {
    if (!room.tournamentState) return;
    
    const state = room.tournamentState;
    const semifinal = semifinalNumber === 1 ? state.semifinal1 : state.semifinal2;
    if (!semifinal) return;
    
    // Éviter double exécution
    if (semifinal.finished) return;
    
    // Déterminer le gagnant et le perdant
    const winnerId = winner.side === 'LEFT' ? semifinal.player1 : semifinal.player2;
    const loserId = winner.side === 'LEFT' ? semifinal.player2 : semifinal.player1;
    semifinal.winner = winnerId;
    semifinal.finished = true;
    
    // Enregistrer le gagnant
    if (semifinalNumber === 1) {
        state.semifinal1Winner = winnerId;
    } else {
        state.semifinal2Winner = winnerId;
    }
    
    const winnerName = state.playerUsernames[winnerId] || 'Player';
    const loserName = state.playerUsernames[loserId] || 'Player';
    const winnerScore = winner.score;
    const loserScore = winner.side === 'LEFT' 
        ? (semifinal.pongGame?.state?.score?.C || 0)
        : (semifinal.pongGame?.state?.score?.A || 0);
    
    console.log(`🏆 Tournament: Semi-final ${semifinalNumber} complete - Winner: ${winnerName}`);
    
    // Envoyer tournamentSemifinalFinished aux joueurs de cette demi-finale pour afficher l'écran de fin
    io.to(semifinal.player1).emit('tournamentSemifinalFinished', {
        winner: { side: winner.side, score: winnerScore, username: winnerName },
        loser: { side: winner.side === 'LEFT' ? 'RIGHT' : 'LEFT', score: loserScore, username: loserName },
        semifinalNumber
    });
    io.to(semifinal.player2).emit('tournamentSemifinalFinished', {
        winner: { side: winner.side, score: winnerScore, username: winnerName },
        loser: { side: winner.side === 'LEFT' ? 'RIGHT' : 'LEFT', score: loserScore, username: loserName },
        semifinalNumber
    });
    
    // Notifier les joueurs de cette demi-finale via tournamentUpdate aussi
    io.to(semifinal.player1).emit('tournamentUpdate', {
        phase: `semifinal${semifinalNumber}_complete`,
        message: `Semi-final ${semifinalNumber} complete! Winner: ${winnerName}`,
        winner: winnerName
    });
    io.to(semifinal.player2).emit('tournamentUpdate', {
        phase: `semifinal${semifinalNumber}_complete`,
        message: `Semi-final ${semifinalNumber} complete! Winner: ${winnerName}`,
        winner: winnerName
    });
    
    // Vérifier si les 2 demi-finales sont terminées
    if (state.semifinal1?.finished && state.semifinal2?.finished) {
        console.log(`🎯 Tournament: Both semi-finals complete, starting final...`);
        
        // IMPORTANT: Changer la phase AVANT d'arrêter les jeux
        // Sinon handleGameTick peut voir phase='semifinals' avec pongGame=null et crasher
        state.phase = 'waiting_final';
        
        // Arrêter les jeux des demi-finales
        if (state.semifinal1.pongGame) {
            state.semifinal1.pongGame.stop();
            state.semifinal1.pongGame = null;
        }
        if (state.semifinal2.pongGame) {
            state.semifinal2.pongGame.stop();
            state.semifinal2.pongGame = null;
        }
        
        // Notifier tout le monde
        io.to(roomName).emit('tournamentUpdate', {
            phase: 'waiting_final',
            message: 'Both semi-finals complete! Final starting soon...',
            finalist1: state.playerUsernames[state.semifinal1Winner!] || 'Finalist 1',
            finalist2: state.playerUsernames[state.semifinal2Winner!] || 'Finalist 2'
        });
        
        // Démarrer la finale après un court délai
        setTimeout(() => {
            startFinal(room, roomName, io, fastify);
        }, 3000);
    }
}

/**
 * Configure la room pour un match de tournoi 1v1 (utilisé pour la finale)
 */
function setupTournamentMatch(room: RoomType, player1: string, player2: string): void {
    // Réinitialiser les paddles pour le match (en majuscules pour correspondre aux inputs client)
    room.paddleBySocket = {
        [player1]: 'LEFT',
        [player2]: 'RIGHT'
    };
    
    // Réinitialiser les inputs (en majuscules pour correspondre au jeu)
    room.paddleInputs = {
        LEFT: { up: false, down: false },
        RIGHT: { up: false, down: false }
    };
}

/**
 * Démarre un jeu de tournoi (utilisé pour la finale)
 */
function startTournamentGame(
    room: RoomType,
    roomName: string,
    io: Server,
    onMatchEnd: (winnerId: string, loserId: string, winnerScore: number, loserScore: number) => void
): void {
    const currentMatch = room.tournamentState?.currentMatch;
    if (!currentMatch) return;
    
    // Créer un nouveau jeu Pong avec callback de fin
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        // Déterminer le gagnant basé sur le côté (en majuscules: 'LEFT' ou 'RIGHT')
        let winnerId: string;
        let loserId: string;
        
        if (winner.side === 'LEFT') {
            winnerId = currentMatch.player1;
            loserId = currentMatch.player2;
        } else {
            winnerId = currentMatch.player2;
            loserId = currentMatch.player1;
        }
        
        onMatchEnd(winnerId, loserId, winner.score, loser.score);
    };
    
    room.pongGame = new PongGame(2, gameEndCallback);
    room.pongGame.start();
    room.gameState = room.pongGame.state;
    
    // Envoyer les assignations de paddle aux joueurs du match
    io.to(currentMatch.player1).emit('roomJoined', {
        paddle: 'LEFT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true
    });
    
    io.to(currentMatch.player2).emit('roomJoined', {
        paddle: 'RIGHT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true
    });
    
    // Les autres joueurs sont spectateurs de ce match
    const spectators = room.tournamentState!.players.filter(
        p => p !== currentMatch.player1 && p !== currentMatch.player2
    );
    
    for (const spectatorId of spectators) {
        io.to(spectatorId).emit('tournamentSpectator', {
            phase: room.tournamentState!.phase,
            message: 'Waiting for your match...',
            currentMatch: {
                player1: room.tournamentState!.playerUsernames[currentMatch.player1] || 'Player 1',
                player2: room.tournamentState!.playerUsernames[currentMatch.player2] || 'Player 2'
            }
        });
    }
}

/**
 * Démarre la finale du tournoi
 */
function startFinal(
    _room: RoomType,  // Paramètre ignoré - on utilise rooms[roomName] directement
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void {
    // IMPORTANT: Utiliser rooms[roomName] directement car le paramètre room peut être obsolète
    // après les setTimeout dans handleSemifinalEnd
    const room = rooms[roomName] as RoomType;
    if (!room || !room.tournamentState) {
        return;
    }
    
    // Éviter double démarrage
    if (room.tournamentState.phase === 'final') return;
    
    const state = room.tournamentState;
    state.phase = 'final';
    
    // Les anciens socket IDs des gagnants
    const oldPlayer1SocketId = state.semifinal1Winner!;
    const oldPlayer2SocketId = state.semifinal2Winner!;
    
    // Récupérer les user IDs
    const player1UserId = state.playerUserIds[oldPlayer1SocketId];
    const player2UserId = state.playerUserIds[oldPlayer2SocketId];
    
    // Récupérer les socket IDs ACTUELS (peuvent avoir changé si le joueur s'est reconnecté)
    const player1CurrentSocketId = getSocketIdForUser(player1UserId) || oldPlayer1SocketId;
    const player2CurrentSocketId = getSocketIdForUser(player2UserId) || oldPlayer2SocketId;
    
    // Utiliser les socket IDs actuels pour la finale
    const player1 = player1CurrentSocketId;
    const player2 = player2CurrentSocketId;
    
    state.currentMatch = { player1, player2 };
    
    const player1Name = state.playerUsernames[oldPlayer1SocketId] || 'Finalist 1';
    const player2Name = state.playerUsernames[oldPlayer2SocketId] || 'Finalist 2';
    
    // Configurer le match (paddles et inputs) avec les nouveaux socket IDs
    setupTournamentMatch(room, player1, player2);
    
    // Créer le jeu Pong pour la finale
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        let winnerId: string;
        let loserId: string;
        
        if (winner.side === 'LEFT') {
            winnerId = oldPlayer1SocketId; // Utiliser les anciens IDs pour le mapping username
            loserId = oldPlayer2SocketId;
        } else {
            winnerId = oldPlayer2SocketId;
            loserId = oldPlayer1SocketId;
        }
        
        handleFinalEnd(winnerId, loserId, winner.score, loser.score, room, roomName, io, fastify);
    };
    
    room.pongGame = new PongGame(2, gameEndCallback);
    room.pongGame.start();
    room.gameState = room.pongGame.state;
    
    // Notifier les amis que les finalistes sont en tournoi
    if (player1UserId) {
        broadcastUserStatusChange(getGlobalIo(), player1UserId, 'in-tournament', fastify);
    }
    if (player2UserId) {
        broadcastUserStatusChange(getGlobalIo(), player2UserId, 'in-tournament', fastify);
    }
    
    // Envoyer roomJoined avec les socket IDs ACTUELS
    io.to(player1).emit('roomJoined', {
        paddle: 'LEFT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        isFinal: true
    });
    
    io.to(player2).emit('roomJoined', {
        paddle: 'RIGHT',
        maxPlayers: 2,
        players: 2,
        spectator: false,
        isTournament: true,
        isFinal: true
    });
    
    // Les perdants des demi-finales deviennent spectateurs
    // Utiliser aussi les socket IDs actuels
    for (const oldSocketId of state.players) {
        if (oldSocketId !== oldPlayer1SocketId && oldSocketId !== oldPlayer2SocketId) {
            const loserUserId = state.playerUserIds[oldSocketId];
            const loserCurrentSocketId = getSocketIdForUser(loserUserId) || oldSocketId;
            io.to(loserCurrentSocketId).emit('tournamentSpectator', {
                phase: 'final',
                message: 'Watch the final!',
                match: { player1: player1Name, player2: player2Name }
            });
        }
    }
}

/**
 * Gère la fin de la finale
 */
function handleFinalEnd(
    winnerId: string,
    loserId: string,
    winnerScore: number,
    loserScore: number,
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void {
    if (!room.tournamentState) return;
    
    // Éviter double exécution
    if (room.tournamentState.phase === 'completed') return;
    
    room.tournamentState.finalWinner = winnerId;
    room.tournamentState.phase = 'completed';
    
    const winnerName = room.tournamentState.playerUsernames[winnerId] || 'Player';
    const loserName = room.tournamentState.playerUsernames[loserId] || 'Player';
    
    console.log(`🏆🏆🏆 Tournament COMPLETE - Champion: ${winnerName}`);
    
    // Envoyer tournamentFinalFinished aux finalistes pour afficher l'écran de fin
    io.to(winnerId).emit('tournamentFinalFinished', {
        winner: { side: 'LEFT', score: winnerScore, username: winnerName },
        loser: { side: 'RIGHT', score: loserScore, username: loserName }
    });
    io.to(loserId).emit('tournamentFinalFinished', {
        winner: { side: 'LEFT', score: winnerScore, username: winnerName },
        loser: { side: 'RIGHT', score: loserScore, username: loserName }
    });

    // Le match est terminé: arrêter et retirer le pongGame pour ne pas laisser les joueurs "in-game"
    if (room.pongGame) {
        room.pongGame.stop();
        room.pongGame = null;
    }

    // Remettre immédiatement les statuts à "online" côté amis
    notifyFriendsGameEnded(room, fastify);
    
    // Notifier tous les joueurs de la fin du tournoi
    io.to(roomName).emit('tournamentComplete', {
        winner: winnerName,
        winnerId: room.tournamentState.playerUserIds[winnerId],
        message: `🏆 Tournament Champion: ${winnerName}!`
    });
    
    // Enregistrer le résultat de la finale
    const winnerUserId = room.tournamentState.playerUserIds[winnerId];
    const loserUserId = room.tournamentState.playerUserIds[loserId];
    
    if (winnerUserId && loserUserId) {
        try {
            // Score par défaut pour le tournoi (on pourrait le récupérer du dernier match)
            updateUserStats(winnerUserId, loserUserId, 7, 0, 'tournament');
        } catch (error) {
        }
    }
    
    // Nettoyer la room après un délai
    setTimeout(() => {
        if (rooms[roomName]) {
            delete rooms[roomName];
        }
    }, 10000);
}

/**
 * Démarre le tournoi (appelé quand la room est pleine)
 */
export function startTournament(
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void {
    if (!room.isTournament || room.players.length !== 4) {
        console.log(`❌ Cannot start tournament: isTournament=${room.isTournament}, players=${room.players.length}`);
        return;
    }
    
    initializeTournamentState(room);
    
    console.log(`🏁 Tournament starting in room ${roomName} with ${room.players.length} players`);
    
    // Notifier tous les joueurs que le tournoi démarre
    io.to(roomName).emit('tournamentStart', {
        message: 'Tournament is starting!',
        players: Object.values(room.tournamentState!.playerUsernames)
    });
    
    // Démarrer les deux demi-finales simultanément après un court délai
    setTimeout(() => {
        startSemifinals(room, roomName, io, fastify);
    }, 2000);
}
