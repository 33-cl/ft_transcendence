// socket/handlers/tournamentHandlers.ts - WebSocket handlers for tournament real-time updates

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType, TournamentState } from '../../types.js';
import { rooms, addPlayerToRoom, removePlayerFromRoom, isUserInGame } from '../roomManager.js';
import { PongGame } from '../../../game/pongGame.js';
import { updateUserStats } from '../../user.js';
import { getGlobalIo } from '../socketHandlers.js';
import { getSocketIdForUser } from '../socketAuth.js';
import { notifyFriendsGameEnded } from './gameEndHandlers.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { notifyFriendsForfeit } from '../utils/forfeitHandling.js';

/**
 * Emits an event when a player joins or leaves a tournament
 * @param tournamentId - Tournament UUID
 * @param action - 'joined' or 'left'
 * @param participant - Participant data
 */
export function emitTournamentPlayerUpdate(
    tournamentId: string,
    action: 'joined' | 'left',
    participant: { user_id: number; alias: string; current_players: number }
) 
{
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
 * Emits an event when a tournament starts
 * @param tournamentId - Tournament UUID
 * @param matches - List of generated matches
 */
export function emitTournamentStarted(
    tournamentId: string,
    matches: Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>
)
{
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
 * Emits an event when a match is ready to be played
 * @param tournamentId - Tournament UUID
 * @param match - Match data
 */
export function emitMatchReady(
    tournamentId: string,
    match: { id: number; round: number; player1_id: number; player2_id: number }
)
{
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
 * Emits an event when a match finishes
 * @param tournamentId - Tournament UUID
 * @param matchId - Match ID
 * @param winnerId - Winner ID
 * @param round - Match round (1 = semi-final, 2 = final)
 */
export function emitMatchFinished(
    tournamentId: string,
    matchId: number,
    winnerId: number,
    round: number
)
{
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
 * Emits an event when a tournament is completed
 * @param tournamentId - Tournament UUID
 * @param championId - Champion ID
 */
export function emitTournamentCompleted(
    tournamentId: string,
    championId: number
)
{
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
 * Makes a socket join a tournament room
 * @param socketId - Socket ID
 * @param tournamentId - Tournament UUID
 */
export function joinTournamentRoom(socketId: string, tournamentId: string): void
{
    const io = getGlobalIo();
    if (!io) return;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.join(`tournament:${tournamentId}`);
    console.log(`🔌 Socket ${socketId} joined tournament room: tournament:${tournamentId}`);
}

/**
 * Makes a socket leave a tournament room
 * @param socketId - Socket ID
 * @param tournamentId - Tournament UUID
 */
export function leaveTournamentRoom(socketId: string, tournamentId: string): void
{
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
 * Initializes the tournament state when the room is full
 */
export function initializeTournamentState(room: RoomType): void
{
    if (!room.isTournament || room.players.length !== 4) return;
    
    room.tournamentState = {
        phase: 'waiting',
        players: [...room.players],
        playerUsernames: { ...(room.playerUsernames || {}) },
        playerUserIds: { ...(room.playerUserIds || {}) },
    };
}

/**
 * Creates a semifinal match structure
 */
function createSemifinalMatch(player1: string, player2: string): import('../../types.js').SemifinalMatch
{
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
 * Starts both semifinals simultaneously
 */
export function startSemifinals(
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void
{
    if (!room.tournamentState) return;
    
    const state = room.tournamentState;
    state.phase = 'semifinals';
    
    // Create the 2 semifinal matches
    const sf1Player1 = state.players[0];
    const sf1Player2 = state.players[1];
    const sf2Player1 = state.players[2];
    const sf2Player2 = state.players[3];
    
    state.semifinal1 = createSemifinalMatch(sf1Player1, sf1Player2);
    state.semifinal2 = createSemifinalMatch(sf2Player1, sf2Player2);
    
    console.log(`🎮 Tournament: Starting BOTH Semi-finals simultaneously`);
    console.log(`   SF1: ${state.playerUsernames[sf1Player1]} vs ${state.playerUsernames[sf1Player2]}`);
    console.log(`   SF2: ${state.playerUsernames[sf2Player1]} vs ${state.playerUsernames[sf2Player2]}`);
    
    // Create end callbacks for each semifinal
    const onSemifinal1End = (winner: { side: string; score: number }, loser: { side: string; score: number }) =>
    {
        handleSemifinalEnd(1, winner, loser, room, roomName, io, fastify);
    };
    
    const onSemifinal2End = (winner: { side: string; score: number }, loser: { side: string; score: number }) =>
    {
        handleSemifinalEnd(2, winner, loser, room, roomName, io, fastify);
    };
    
    // Create Pong games for each semifinal
    state.semifinal1.pongGame = new PongGame(2, onSemifinal1End);
    state.semifinal2.pongGame = new PongGame(2, onSemifinal2End);
    
    // Start both games
    state.semifinal1.pongGame.start();
    state.semifinal2.pongGame.start();
    
    // Notify players of semifinal 1
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
    
    // Notify players of semifinal 2
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
    
    // Send tournament update to all
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
 * Handles the end of a semifinal
 */
function handleSemifinalEnd(
    semifinalNumber: 1 | 2,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void
{
    if (!room.tournamentState) return;
    
    const state = room.tournamentState;
    const semifinal = semifinalNumber === 1 ? state.semifinal1 : state.semifinal2;
    if (!semifinal) return;
    
    // Prevent double execution
    if (semifinal.finished) return;
    
    // Determine the winner and loser
    const winnerId = winner.side === 'LEFT' ? semifinal.player1 : semifinal.player2;
    const loserId = winner.side === 'LEFT' ? semifinal.player2 : semifinal.player1;
    semifinal.winner = winnerId;
    semifinal.finished = true;
    
    // Save the winner
    if (semifinalNumber === 1) {
        state.semifinal1Winner = winnerId;
    } else {
        state.semifinal2Winner = winnerId;
    }
    
    const winnerName = state.playerUsernames[winnerId] || 'Player';
    const loserName = state.playerUsernames[loserId] || 'Player';
    const winnerScore = winner.score;
    const loserScore = loser.score;
    
    // Record the semifinal match in the DB with the actual scores
    const winnerUserId = state.playerUserIds[winnerId];
    const loserUserId = state.playerUserIds[loserId];
    if (winnerUserId && loserUserId) {
        try {
            updateUserStats(winnerUserId, loserUserId, winnerScore, loserScore, 'tournament');
            console.log(`📊 Semi-final ${semifinalNumber} recorded: ${winnerName} ${winnerScore}-${loserScore} ${loserName}`);
        } catch (error) {
            console.error(`Error recording semifinal ${semifinalNumber} stats:`, error);
        }
    }
    
    console.log(`🏆 Tournament: Semi-final ${semifinalNumber} complete - Winner: ${winnerName}`);
    
    // Retrieve info from the other semifinal
    const otherSemifinal = semifinalNumber === 1 ? state.semifinal2 : state.semifinal1;
    let otherSemifinalInfo = null;
    if (otherSemifinal && otherSemifinal.pongGame) {
        const otherPlayer1Name = state.playerUsernames[otherSemifinal.player1] || 'Player';
        const otherPlayer2Name = state.playerUsernames[otherSemifinal.player2] || 'Player';
        const otherScore = otherSemifinal.pongGame.state?.score || { A: 0, C: 0 };
        otherSemifinalInfo = {
            player1: otherPlayer1Name,
            player2: otherPlayer2Name,
            score1: otherScore.A || 0,
            score2: otherScore.C || 0,
            finished: otherSemifinal.finished || false,
            winner: otherSemifinal.finished ? state.playerUsernames[otherSemifinal.winner!] : null
        };
    }
    
    // Send tournamentSemifinalFinished to the players of this semifinal to display the end screen
    io.to(semifinal.player1).emit('tournamentSemifinalFinished', {
        winner: { side: winner.side, score: winnerScore, username: winnerName },
        loser: { side: winner.side === 'LEFT' ? 'RIGHT' : 'LEFT', score: loserScore, username: loserName },
        semifinalNumber,
        otherSemifinal: otherSemifinalInfo
    });
    io.to(semifinal.player2).emit('tournamentSemifinalFinished', {
        winner: { side: winner.side, score: winnerScore, username: winnerName },
        loser: { side: winner.side === 'LEFT' ? 'RIGHT' : 'LEFT', score: loserScore, username: loserName },
        semifinalNumber,
        otherSemifinal: otherSemifinalInfo
    });
    
    // Notify the players of this semifinal via tournamentUpdate also
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
    
    // Check if both semifinals are finished
    if (state.semifinal1?.finished && state.semifinal2?.finished) {
        console.log(`🎯 Tournament: Both semi-finals complete, starting final...`);
        
        state.phase = 'waiting_final';
        
        // Stop the semifinal games
        if (state.semifinal1.pongGame) {
            state.semifinal1.pongGame.stop();
            state.semifinal1.pongGame = null;
        }
        if (state.semifinal2.pongGame) {
            state.semifinal2.pongGame.stop();
            state.semifinal2.pongGame = null;
        }
        
        // Notify everyone
        io.to(roomName).emit('tournamentUpdate', {
            phase: 'waiting_final',
            message: 'Both semi-finals complete! Final starting soon...',
            finalist1: state.playerUsernames[state.semifinal1Winner!] || 'Finalist 1',
            finalist2: state.playerUsernames[state.semifinal2Winner!] || 'Finalist 2'
        });
        
        // Start the final after a short delay
        setTimeout(() => {
            startFinal(room, roomName, io, fastify);
        }, 3000);
    }
}

/**
 * Processes a forfeit on an internal tournament match (semi-finals or final)
 * Identifies the affected match (semifinal1 / semifinal2 / final), determines the winner
 * and calls the appropriate end handlers (handleSemifinalEnd / handleFinalEnd).
 */
export function processTournamentStateForfeit(
    room: RoomType,
    roomName: string,
    disconnectedSocketId: string,
    io: Server,
    globalIo: Server | null,
    loserIsOffline: boolean,
    fastify: FastifyInstance
): void
{
    if (!room.tournamentState) return;
    const state = room.tournamentState;

    // SEMIFINALS
    if (state.phase === 'semifinals') {
        // check semifinal 1
        const sf1 = state.semifinal1;
        if (sf1 && sf1.pongGame && sf1.pongGame.state && sf1.pongGame.state.running && (disconnectedSocketId === sf1.player1 || disconnectedSocketId === sf1.player2)) {
            const winnerSocket = disconnectedSocketId === sf1.player1 ? sf1.player2 : sf1.player1;
            const winnerSide = sf1.paddleBySocket[winnerSocket];
            const loserSide = sf1.paddleBySocket[disconnectedSocketId];
            const winnerPaddle = sf1.pongGame.state.paddles.find((p: any) => p.side === (winnerSide as any));
            const loserPaddle = sf1.pongGame.state.paddles.find((p: any) => p.side === (loserSide as any));
            const winnerScore = (winnerPaddle && typeof winnerPaddle.score === 'number') ? winnerPaddle.score : 0;
            const loserScore = (loserPaddle && typeof loserPaddle.score === 'number') ? loserPaddle.score : 0;

            // Stop the semifinal game and process end
            if (sf1.pongGame) {
                sf1.pongGame.stop();
                sf1.pongGame = null;
            }

            handleSemifinalEnd(1, { side: winnerSide as any, score: winnerScore }, { side: loserSide as any, score: loserScore }, room, roomName, io, fastify);

            // Notify friends (stats already recorded in handleSemifinalEnd)
            const winnerName = state.playerUsernames[winnerSocket] || 'Player';
            const loserName = state.playerUsernames[disconnectedSocketId] || 'Player';
            notifyFriendsForfeit(globalIo, winnerName, loserName, loserIsOffline, fastify);
            
            // Remove the loser from the tournament state to prevent future notifications
            if (state.playerUserIds && state.playerUserIds[disconnectedSocketId]) {
                delete state.playerUserIds[disconnectedSocketId];
            }
            return;
        }

        // check semifinal 2
        const sf2 = state.semifinal2;
        if (sf2 && sf2.pongGame && sf2.pongGame.state && sf2.pongGame.state.running && (disconnectedSocketId === sf2.player1 || disconnectedSocketId === sf2.player2)) {
            const winnerSocket = disconnectedSocketId === sf2.player1 ? sf2.player2 : sf2.player1;
            const winnerSide = sf2.paddleBySocket[winnerSocket];
            const loserSide = sf2.paddleBySocket[disconnectedSocketId];
            const winnerPaddle = sf2.pongGame.state.paddles.find((p: any) => p.side === (winnerSide as any));
            const loserPaddle = sf2.pongGame.state.paddles.find((p: any) => p.side === (loserSide as any));
            const winnerScore = (winnerPaddle && typeof winnerPaddle.score === 'number') ? winnerPaddle.score : 0;
            const loserScore = (loserPaddle && typeof loserPaddle.score === 'number') ? loserPaddle.score : 0;

            if (sf2.pongGame) {
                sf2.pongGame.stop();
                sf2.pongGame = null;
            }

            handleSemifinalEnd(2, { side: winnerSide as any, score: winnerScore }, { side: loserSide as any, score: loserScore }, room, roomName, io, fastify);

            // Notify friends (stats already recorded in handleSemifinalEnd)
            const winnerName = state.playerUsernames[winnerSocket] || 'Player';
            const loserName = state.playerUsernames[disconnectedSocketId] || 'Player';
            notifyFriendsForfeit(globalIo, winnerName, loserName, loserIsOffline, fastify);
            
            // Remove the loser from the tournament state to prevent future notifications
            if (state.playerUserIds && state.playerUserIds[disconnectedSocketId]) {
                delete state.playerUserIds[disconnectedSocketId];
            }
            return;
        }
    }

    // FINAL
    if ((state.phase === 'final' || state.phase === 'waiting_final') && state.currentMatch) {
        const current = state.currentMatch;
        if (disconnectedSocketId === current.player1 || disconnectedSocketId === current.player2) {
            const winnerSocket = disconnectedSocketId === current.player1 ? current.player2 : current.player1;
            // Extract scores from room.pongGame (final uses room.pongGame)
            const winnerSide = room.paddleBySocket ? room.paddleBySocket[winnerSocket] : 'LEFT';
            const loserSide = room.paddleBySocket ? room.paddleBySocket[disconnectedSocketId] : 'RIGHT';
            const winnerPaddle = room.pongGame?.state?.paddles?.find((p: any) => p.side === winnerSide);
            const loserPaddle = room.pongGame?.state?.paddles?.find((p: any) => p.side === loserSide);
            const winnerScore = (winnerPaddle && typeof winnerPaddle.score === 'number') ? winnerPaddle.score : 0;
            const loserScore = (loserPaddle && typeof loserPaddle.score === 'number') ? loserPaddle.score : 0;

            // Stop final game
            if (room.pongGame) {
                room.pongGame.stop();
                room.pongGame = null;
            }

            handleFinalEnd(winnerSocket, disconnectedSocketId, winnerScore, loserScore, room, roomName, io, fastify);

            // Notify friends (stats already recorded in handleFinalEnd)
            const winnerName = state.playerUsernames[winnerSocket] || 'Player';
            const loserName = state.playerUsernames[disconnectedSocketId] || 'Player';
            notifyFriendsForfeit(globalIo, winnerName, loserName, loserIsOffline, fastify);
            return;
        }
    }
}

/**
 * Configure the room for a 1v1 tournament match (used for the final)
 * Sets up the room for a 1v1 tournament match (used for the final)
 */
function setupTournamentMatch(room: RoomType, player1: string, player2: string): void
{
    // Reset paddles for the match (uppercase to match client inputs)
    room.paddleBySocket = {
        [player1]: 'LEFT',
        [player2]: 'RIGHT'
    };
    
    // Reset inputs (uppercase to match game)
    room.paddleInputs = {
        LEFT: { up: false, down: false },
        RIGHT: { up: false, down: false }
    };
}

/**
 * Starts a tournament game (used for the final)
 * Démarre un jeu de tournoi (utilisé pour la finale)
 */
function startTournamentGame(
    room: RoomType,
    roomName: string,
    io: Server,
    onMatchEnd: (winnerId: string, loserId: string, winnerScore: number, loserScore: number) => void
): void
{
    const currentMatch = room.tournamentState?.currentMatch;
    if (!currentMatch) return;
    
    // Create a new Pong game with end callback
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        // Determine the winner based on the side (uppercase: 'LEFT' or 'RIGHT')
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
    
    // Send paddle assignments to match players
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
    
    // Other players become spectators of this match
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

// Start the final match
function startFinal(
    _room: RoomType, 
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void
{
    // IMPORTANT: Use rooms[roomName] directly as the room parameter may be outdated
    // after setTimeout in handleSemifinalEnd
    const room = rooms[roomName] as RoomType;
    if (!room || !room.tournamentState) {
        return;
    }
    
    // Prevent double start
    if (room.tournamentState.phase === 'final') return;
    
    const state = room.tournamentState;
    state.phase = 'final';
    
    // Old socket IDs of the winners
    const oldPlayer1SocketId = state.semifinal1Winner!;
    const oldPlayer2SocketId = state.semifinal2Winner!;
    
    // Retrieve user IDs
    const player1UserId = state.playerUserIds[oldPlayer1SocketId];
    const player2UserId = state.playerUserIds[oldPlayer2SocketId];
    
    // Retrieve CURRENT socket IDs (may have changed if the player reconnected)
    const player1CurrentSocketId = getSocketIdForUser(player1UserId) || oldPlayer1SocketId;
    const player2CurrentSocketId = getSocketIdForUser(player2UserId) || oldPlayer2SocketId;
    
    // Use current socket IDs for the final
    const player1 = player1CurrentSocketId;
    const player2 = player2CurrentSocketId;
    
    // Ensure players are in the room (in case they left)
    const ensurePlayerInRoom = (socketId: string) => {
        // Check all rooms for this player to clean up other sessions (e.g. local games)
        for (const rName in rooms) {
            if (rName === roomName) continue; // Skip current tournament room
            
            const r = rooms[rName];
            if (r.players.includes(socketId)) {
                // Found in another room.
                
                // If it's a local game, stop it explicitly
                if (r.isLocalGame) {
                     if (r.pongGame) r.pongGame.stop();
                     r.players = []; 
                     delete rooms[rName]; 
                }
                else {
                     // For other rooms, just remove the player
                     r.players = r.players.filter(id => id !== socketId);
                     if (r.players.length === 0) delete rooms[rName];
                }
                
                // Leave socket channel
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.leave(rName);
                }
            }
        }

        if (!room.players.includes(socketId)) {
            addPlayerToRoom(roomName, socketId);
        }
        
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            socket.join(roomName);
        }
    };
    
    // If the room was empty, we need to make sure we don't have stale data
    // But since we are using current socket IDs, it should be fine.
    
    ensurePlayerInRoom(player1);
    ensurePlayerInRoom(player2);

    state.currentMatch = { player1, player2 };
    
    const player1Name = state.playerUsernames[oldPlayer1SocketId] || 'Finalist 1';
    const player2Name = state.playerUsernames[oldPlayer2SocketId] || 'Finalist 2';
    
    // Setup the match (paddles and inputs) with new socket IDs
    setupTournamentMatch(room, player1, player2);
    
    // Create Pong game for the final
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        let winnerId: string;
        let loserId: string;
        
        if (winner.side === 'LEFT') {
            winnerId = oldPlayer1SocketId; // Use old IDs for username mapping
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
    
    // Notify friends that the finalists are in the tournament
    if (player1UserId) {
        broadcastUserStatusChange(getGlobalIo(), player1UserId, 'in-tournament', fastify);
    }
    if (player2UserId) {
        broadcastUserStatusChange(getGlobalIo(), player2UserId, 'in-tournament', fastify);
    }
    
    // Send roomJoined with CURRENT socket IDs
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
}

/**
 * Handles the end of the final
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
): void
{
    if (!room.tournamentState) return;
    
    // Prevent double execution
    if (room.tournamentState.phase === 'completed') return;
    
    room.tournamentState.finalWinner = winnerId;
    room.tournamentState.phase = 'completed';
    
    const winnerName = room.tournamentState.playerUsernames[winnerId] || 'Player';
    const loserName = room.tournamentState.playerUsernames[loserId] || 'Player';
    
    console.log(`🏆🏆🏆 Tournament COMPLETE - Champion: ${winnerName}`);
    
    // Send tournamentFinalFinished to the finalists to display the end screen
    console.log(`📤 Sending tournamentFinalFinished to winner ${winnerId} (${winnerName})`);
    io.to(winnerId).emit('tournamentFinalFinished', {
        winner: { side: 'LEFT', score: winnerScore, username: winnerName },
        loser: { side: 'RIGHT', score: loserScore, username: loserName }
    });
    console.log(`📤 Sending tournamentFinalFinished to loser ${loserId} (${loserName})`);
    io.to(loserId).emit('tournamentFinalFinished', {
        winner: { side: 'LEFT', score: winnerScore, username: winnerName },
        loser: { side: 'RIGHT', score: loserScore, username: loserName }
    });

    // The match is over: stop and remove pongGame to not leave players "in-game"
    if (room.pongGame) {
        room.pongGame.stop();
        room.pongGame = null;
    }

    // Immediately reset statuses to "online" for friends
    notifyFriendsGameEnded(room, fastify);
    
    // Notify all players of the tournament end
    io.to(roomName).emit('tournamentComplete', {
        winner: winnerName,
        winnerId: room.tournamentState.playerUserIds[winnerId],
        message: `🏆 Tournament Champion: ${winnerName}!`
    });
    
    // Record the final result with the actual scores
    const winnerUserId = room.tournamentState.playerUserIds[winnerId];
    const loserUserId = room.tournamentState.playerUserIds[loserId];
    
    if (winnerUserId && loserUserId) {
        try {
            updateUserStats(winnerUserId, loserUserId, winnerScore, loserScore, 'tournament');
            console.log(`📊 Final recorded: ${winnerName} ${winnerScore}-${loserScore} ${loserName}`);
        } catch (error) {
            console.error('Error recording final stats:', error);
        }
    }
    
    // Clean up the room after a delay
    setTimeout(() => {
        if (rooms[roomName]) {
            delete rooms[roomName];
        }
    }, 10000);
}

// Starts the tournament when the room is full
export function startTournament(
    room: RoomType,
    roomName: string,
    io: Server,
    fastify: FastifyInstance
): void
{
    if (!room.isTournament || room.players.length !== 4) {
        return;
    }
    
    initializeTournamentState(room);
    
    // Notify all players that the tournament is starting
    io.to(roomName).emit('tournamentStart', {
        message: 'Tournament is starting!',
        players: Object.values(room.tournamentState!.playerUsernames)
    });
    
    // Start both semifinals simultaneously after a short delay
    setTimeout(() => {
        startSemifinals(room, roomName, io, fastify);
    }, 2000);
}

/**
 * Removes a user from all active tournaments (used when joining a non-tournament game)
 */
export function cleanupUserFromTournaments(userId: number, socket: Socket): void
{
    for (const rName in rooms) {
        const r = rooms[rName];
        if (r.isTournament && r.tournamentState) {
            // Check if user is in this tournament
            let found = false;
            if (r.tournamentState.playerUserIds) {
                 for (const [sid, uid] of Object.entries(r.tournamentState.playerUserIds)) {
                     if (uid === userId) {
                         found = true;
                         delete r.tournamentState.playerUserIds[sid];
                         // Also remove from playerUsernames to be safe
                         if (r.tournamentState.playerUsernames && r.tournamentState.playerUsernames[sid]) {
                             delete r.tournamentState.playerUsernames[sid];
                         }
                         break;
                     }
                 }
            }
            
            // Force leave the socket.io room if the socket is in it
            // This prevents receiving broadcast messages like 'tournamentComplete'
            socket.leave(rName);
        }
    }
}
