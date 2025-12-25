import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getUserByUsername, updateUserStats } from '../../user.js';
import { broadcastUserStatusChange } from '../notificationHandlers.js';
import { updateMatchResult } from '../../tournament.js';

// Get disconnected player info
export function getDisconnectedPlayerInfo(
    room: RoomType,
    socketId: string
): { username: string; paddleSide: string } | null
{
    const username = room.playerUsernames?.[socketId];
    const paddleSide = room.paddleBySocket?.[socketId];
    
    if (!username || !paddleSide)
        return null;
    
    return { username, paddleSide };
}

// Get player score from paddle side
export function getPlayerScore(room: RoomType, paddleSide: string): number
{
    const paddles = room.pongGame!.state.paddles;
    const paddle = paddles.find((p: { side: string; score: number }) => p.side === paddleSide);
    return paddle?.score || 0;
}

// Find winner after forfeit (highest score among remaining players)
export function findWinnerAfterForfeit(
    room: RoomType,
    disconnectedSocketId: string
): { side: string; score: number; username: string } | null
{
    const numPlayers = room.maxPlayers || 2;
    
    if (numPlayers === 4)
    {
        const scores: number[] = [];
        
        for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {}))
        {
            if (room.playerUsernames?.[socketId])
            {
                const score = getPlayerScore(room, paddle as string);
                scores.push(score);
            }
        }
        
        const allEqual = scores.every(score => score === scores[0]);
        if (allEqual)
            return null;
    }
    
    let winningSide: string | null = null;
    let winningScore = -1;
    let winnerUsername: string | null = null;
    
    for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {}))
    {
        if (socketId !== disconnectedSocketId && room.playerUsernames?.[socketId])
        {
            const score = getPlayerScore(room, paddle as string);
            if (score > winningScore)
            {
                winningScore = score;
                winningSide = paddle as string;
                winnerUsername = room.playerUsernames[socketId];
            }
        }
    }
    
    if (!winningSide || !winnerUsername)
        return null;
    
    return {
        side: winningSide,
        score: winningScore,
        username: winnerUsername
    };
}

// Record forfeit match in database
export function recordForfeitMatch(
    winnerUsername: string,
    loserUsername: string,
    winnerScore: number,
    loserScore: number
): boolean
{
    const winnerUser = getUserByUsername(winnerUsername) as { id: number } | undefined;
    const loserUser = getUserByUsername(loserUsername) as { id: number } | undefined;
    
    if (!winnerUser || !loserUser || winnerUser.id === loserUser.id)
        return false;
    
    updateUserStats(winnerUser.id, loserUser.id, winnerScore, loserScore, 'online');
    return true;
}

// Record tournament forfeit result and update bracket
export function recordTournamentForfeit(
    room: RoomType,
    winnerSocketId: string,
    fastify: FastifyInstance
): boolean
{
    if (!room.tournamentId || !room.matchId)
        return false;
    
    const winnerUserId = room.playerUserIds?.[winnerSocketId];
    if (!winnerUserId)
        return false;
    
    try
    {
        updateMatchResult(room.matchId, winnerUserId);
        return true;
    }
    catch (error)
    {
        return false;
    }
}

// Find winner socketId after forfeit
export function findWinnerSocketId(
    room: RoomType,
    disconnectedSocketId: string
): string | null
{
    for (const [socketId, paddle] of Object.entries(room.paddleBySocket || {}))
    {
        if (socketId !== disconnectedSocketId && room.playerUsernames?.[socketId])
            return socketId;
    }
    return null;
}

// Send gameFinished event with forfeit message
export function notifyGameForfeit(
    io: Server,
    roomName: string,
    winner: { side: string; score: number; username: string },
    loser: { side: string; score: number; username: string }
): void
{
    io.to(roomName).emit('gameFinished', {
        winner,
        loser,
        forfeit: true,
        forfeitMessage: `${loser.username} a quitté la partie - Victoire par forfait !`
    });
}

// Notify friends of status change after forfeit
export function notifyFriendsForfeit(
    globalIo: Server | null,
    winnerUsername: string,
    loserUsername: string,
    loserIsOffline: boolean,
    fastify: FastifyInstance
): void
{
    const winnerUser = getUserByUsername(winnerUsername) as { id: number } | undefined;
    const loserUser = getUserByUsername(loserUsername) as { id: number } | undefined;
    
    if (!winnerUser || !loserUser)
        return;
    
    broadcastUserStatusChange(globalIo, winnerUser.id, 'online', fastify);
    
    const loserStatus = loserIsOffline ? 'offline' : 'online';
    broadcastUserStatusChange(globalIo, loserUser.id, loserStatus, fastify);
}

// Handle complete forfeit (disconnect during active game)
export function handleForfeit(
    room: RoomType,
    roomName: string,
    socketId: string,
    io: Server,
    globalIo: Server | null,
    loserIsOffline: boolean,
    fastify: FastifyInstance
): void
{
    const disconnectedPlayer = getDisconnectedPlayerInfo(room, socketId);
    if (!disconnectedPlayer)
        return;
    
    const disconnectedScore = getPlayerScore(room, disconnectedPlayer.paddleSide);
    
    const winner = findWinnerAfterForfeit(room, socketId);
    
    const numPlayers = room.maxPlayers || 2;
    
    if (!winner)
    {
        io.to(roomName).emit('gameFinished', {
            winner: { isDraw: true, username: 'DRAW', side: 'DRAW', score: 0 },
            loser: { isDraw: true, username: 'DRAW', side: 'DRAW', score: 0 },
            forfeit: true,
            draw: true,
            forfeitMessage: `${disconnectedPlayer.username} left the game - Draw (equal scores)`,
            numPlayers
        });
        
        if (room.playerUsernames)
        {
            for (const [sid, username] of Object.entries(room.playerUsernames))
            {
                if (sid !== socketId)
                {
                    const user = getUserByUsername(username) as { id: number } | undefined;
                    if (user)
                        broadcastUserStatusChange(globalIo, user.id, 'online', fastify);
                }
            }
        }
        
        const loserUser = getUserByUsername(disconnectedPlayer.username) as { id: number } | undefined;
        if (loserUser)
        {
            const loserStatus = loserIsOffline ? 'offline' : 'online';
            broadcastUserStatusChange(globalIo, loserUser.id, loserStatus, fastify);
        }
        
        if (room.pongGame)
            room.pongGame.stop();
        
        return;
    }
    
    if (room.tournamentId && room.matchId)
    {
        const winnerSocketId = findWinnerSocketId(room, socketId);
        if (winnerSocketId)
            recordTournamentForfeit(room, winnerSocketId, fastify);
    }
    
    recordForfeitMatch(
        winner.username,
        disconnectedPlayer.username,
        winner.score,
        disconnectedScore
    );
    
    const loser = {
        side: disconnectedPlayer.paddleSide,
        score: disconnectedScore,
        username: disconnectedPlayer.username
    };
    
    notifyGameForfeit(io, roomName, winner, loser);
    
    notifyFriendsForfeit(
        globalIo,
        winner.username,
        disconnectedPlayer.username,
        loserIsOffline,
        fastify
    );
    
    if (room.pongGame)
        room.pongGame.stop();
}
