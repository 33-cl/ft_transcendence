import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getUserByUsername, updateUserStats } from '../../user.js';
import { broadcastUserStatusChange, broadcastLeaderboardUpdate } from '../notificationHandlers.js';
import { getGlobalIo } from '../socketHandlers.js';
import { updateMatchResult } from '../../tournament.js';
import db from '../../db.js';

// Handle tournament match end and record result
async function handleTournamentMatchEnd(
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    fastify: FastifyInstance
): Promise<void>
{
    try
    {
        if (!room.matchId || !room.tournamentId)
        {
            fastify.log.error('Tournament match end called without matchId or tournamentId');
            return;
        }

        const match = db.prepare(`
            SELECT player1_id, player2_id FROM tournament_matches 
            WHERE id = ? AND tournament_id = ?
        `).get(room.matchId, room.tournamentId) as any;

        if (!match)
        {
            fastify.log.error(`Tournament match not found: ${room.matchId}`);
            return;
        }

        const { winnerSocketId } = findSocketIdsForWinnerAndLoser(room, winner, loser);
        if (!winnerSocketId)
        {
            fastify.log.error('Could not determine winner socket');
            return;
        }

        const winnerUserId = room.playerUserIds?.[winnerSocketId];
        if (!winnerUserId)
        {
            fastify.log.error(`Could not find userId for winner socket ${winnerSocketId}`);
            return;
        }

        if (winnerUserId !== match.player1_id && winnerUserId !== match.player2_id)
        {
            fastify.log.error(`Winner userId ${winnerUserId} is not a participant of match ${room.matchId}`);
            return;
        }

        updateMatchResult(room.matchId, winnerUserId);

    }
    catch (error)
    {
        fastify.log.error(`Error recording tournament match result: ${error}`);
    }
}

// Handle local or AI game end (no DB save)
export function handleLocalGameEnd(
    room: RoomType,
    roomName: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    io: Server
): void
{
    if (room && room.players && room.players.length > 0)
    {
        const isAIGame = room.pongGame?.state?.aiConfig?.enabled || false;
        const numPlayers = room.maxPlayers || 2;
        io.to(roomName).emit('gameFinished', {
            winner,
            loser,
            mode: isAIGame ? 'ai' : 'local',
            numPlayers
        });
    }
}

// Find socketIds of winner and loser from paddle sides
export function findSocketIdsForWinnerAndLoser(
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number }
): { winnerSocketId: string | null; loserSocketId: string | null }
{
    let winnerSocketId: string | null = null;
    let loserSocketId: string | null = null;

    for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket || {}))
    {
        const controlledSides = Array.isArray(paddleSide) ? paddleSide : [paddleSide];
        
        if (controlledSides.includes(winner.side))
            winnerSocketId = socketId;
        if (controlledSides.includes(loser.side))
            loserSocketId = socketId;
    }

    return { winnerSocketId, loserSocketId };
}

// Get usernames from socketIds
export function getUsernamesFromSocketIds(
    room: RoomType,
    winnerSocketId: string | null,
    loserSocketId: string | null
): { winnerUsername: string | null; loserUsername: string | null }
{
    const winnerUsername = winnerSocketId ? (room.playerUsernames?.[winnerSocketId] ?? null) : null;
    const loserUsername = loserSocketId ? (room.playerUsernames?.[loserSocketId] ?? null) : null;
    
    return { winnerUsername, loserUsername };
}

// Record match stats in database (validates distinct players)
export function recordMatchStats(
    winnerUsername: string,
    loserUsername: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number }
): boolean
{
    if (winnerUsername === loserUsername)
        return false;
    
    const winnerUser = getUserByUsername(winnerUsername) as any;
    const loserUser = getUserByUsername(loserUsername) as any;
    
    if (winnerUser && loserUser && winnerUser.id !== loserUser.id)
    {
        updateUserStats(winnerUser.id, loserUser.id, winner.score, loser.score, 'online');
        return true;
    }
    
    return false;
}

// Notify players and spectators of game end
export function notifyPlayersAndSpectators(
    room: RoomType,
    roomName: string,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    displayWinnerUsername: string,
    displayLoserUsername: string,
    io: Server
): void
{
    if (!room || !room.players || room.players.length === 0)
        return;
    
    const connectedSockets = Array.from(io.sockets.adapter.rooms.get(roomName) || []) as string[];
    const spectators = connectedSockets.filter(socketId => !room.players.includes(socketId));
    const numPlayers = room.maxPlayers || 2;
    
    for (const socketId of room.players)
    {
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket)
        {
            playerSocket.emit('gameFinished', {
                winner: { ...winner, username: displayWinnerUsername },
                loser: { ...loser, username: displayLoserUsername },
                isPlayer: true,
                numPlayers
            });
        }
    }
    
    for (const socketId of spectators)
    {
        const spectatorSocket = io.sockets.sockets.get(socketId);
        if (spectatorSocket)
        {
            if (numPlayers === 4)
            {
                spectatorSocket.emit('gameFinished', {
                    winner: { ...winner, username: displayWinnerUsername },
                    loser: { ...loser, username: displayLoserUsername },
                    isSpectator: true,
                    numPlayers
                });
            }
            else
            {
                spectatorSocket.emit('spectatorGameFinished', {
                    winner: { ...winner, username: displayWinnerUsername },
                    loser: { ...loser, username: displayLoserUsername },
                    isSpectator: true,
                    numPlayers
                });
            }
        }
    }
}

// Notify friends that players are no longer in game
export function notifyFriendsGameEnded(room: RoomType, fastify: FastifyInstance): void
{
    if (!room.playerUsernames)
        return;

    for (const [socketId, username] of Object.entries(room.playerUsernames))
    {
        if (room.players.includes(socketId))
        {
            const user = getUserByUsername(username) as any;
            if (user)
                broadcastUserStatusChange(getGlobalIo(), user.id, 'online', fastify);
        }
    }
}

// Main entry point for game end handling
export async function handleGameEnd(
    roomName: string,
    room: RoomType,
    winner: { side: string; score: number },
    loser: { side: string; score: number },
    fastify: FastifyInstance,
    io: Server
): Promise<void>
{
    if (room.isLocalGame)
    {
        handleLocalGameEnd(room, roomName, winner, loser, io);
        return;
    }
    
    if (room.tournamentId && room.matchId)
    {
        await handleTournamentMatchEnd(room, winner, loser, fastify);
    }
    
    if (!room.playerUsernames || !room.paddleBySocket)
        return;

    const { winnerSocketId, loserSocketId } = findSocketIdsForWinnerAndLoser(room, winner, loser);
    const { winnerUsername, loserUsername } = getUsernamesFromSocketIds(room, winnerSocketId, loserSocketId);
    
    const displayWinnerUsername = winnerUsername || winner.side;
    const displayLoserUsername = loserUsername || loser.side;

    if (winnerUsername && loserUsername)
    {
        const statsRecorded = recordMatchStats(winnerUsername, loserUsername, winner, loser);
        
        const isTournamentMatch = room.tournamentId && room.matchId;
        
        fastify.log.info(`[LEADERBOARD DEBUG] statsRecorded=${statsRecorded}, maxPlayers=${room.maxPlayers}, isTournament=${!!isTournamentMatch}`);
        
        if (statsRecorded && room.maxPlayers === 2 && !isTournamentMatch)
        {
            fastify.log.info(`[LEADERBOARD] Broadcasting leaderboard update after 1v1 match`);
            broadcastLeaderboardUpdate(io, 0, {}, fastify);
        }
    }

    notifyPlayersAndSpectators(room, roomName, winner, loser, displayWinnerUsername, displayLoserUsername, io);
    notifyFriendsGameEnded(room, fastify);
}
