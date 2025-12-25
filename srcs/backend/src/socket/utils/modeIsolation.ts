import db from '../../db.js';
import { rooms } from '../roomManager.js';
import { getSocketUser } from '../socketAuth.js';
import { Socket } from 'socket.io';

interface ActiveTournament
{
    id: string;
    name: string;
    status: string;
}

interface OnlineGameInfo
{
    roomName: string;
    isTournamentRoom: boolean;
}

// Check if user is registered in active tournament
export function getUserActiveTournament(userId: number): ActiveTournament | null
{
    try
    {
        const result = db.prepare(`
            SELECT t.id, t.name, t.status
            FROM tournaments t
            JOIN tournament_participants tp ON t.id = tp.tournament_id
            WHERE tp.user_id = ?
            AND t.status IN ('registration', 'active')
            LIMIT 1
        `).get(userId) as ActiveTournament | undefined;

        return result || null;
    }
    catch (error)
    {
        return null;
    }
}

// Check if user is in tournament match
export function isUserInTournamentMatch(userId: number): boolean
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        if (room.tournamentId && room.playerUsernames)
        {
            for (const [socketId, username] of Object.entries(room.playerUsernames))
            {
                const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
                if (user && user.id === userId && room.pongGame)
                    return true;
            }
        }
    }
    return false;
}

// Check if user is in online game (non-tournament)
export function getUserOnlineGame(userId: number): OnlineGameInfo | null
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        if (room.tournamentId || room.isLocalGame)
            continue;

        if (room.playerUsernames)
        {
            for (const [socketId, username] of Object.entries(room.playerUsernames))
            {
                const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
                if (user && user.id === userId)
                {
                    return {
                        roomName,
                        isTournamentRoom: false
                    };
                }
            }
        }
    }
    return null;
}

// Check if user is in active online game (game started)
export function isUserInActiveOnlineGame(userId: number): boolean
{
    const gameInfo = getUserOnlineGame(userId);
    if (!gameInfo)
        return false;

    const room = rooms[gameInfo.roomName];
    return room && !!room.pongGame && room.pongGame.state.running;
}

// Check if socket can join online game (blocks if in active tournament)
export function canSocketJoinOnlineGame(socket: Socket): { allowed: boolean; reason?: string; tournament?: ActiveTournament }
{
    const user = getSocketUser(socket.id);
    if (!user)
        return { allowed: true };

    const activeTournament = getUserActiveTournament(user.id);
    if (activeTournament)
    {
        return {
            allowed: false,
            reason: `You are registered in an active tournament "${activeTournament.name}". Please complete or leave the tournament before joining online games.`,
            tournament: activeTournament
        };
    }

    return { allowed: true };
}

// Check if user can join tournament (blocks if in active online game)
export function canUserJoinTournament(userId: number): { allowed: boolean; reason?: string }
{
    const onlineGame = getUserOnlineGame(userId);
    if (onlineGame)
    {
        return {
            allowed: false,
            reason: 'You are currently in an online game. Please finish your game before joining a tournament.'
        };
    }

    const activeTournament = getUserActiveTournament(userId);
    if (activeTournament)
    {
        return {
            allowed: false,
            reason: `You are already registered in tournament "${activeTournament.name}". You can only be in one active tournament at a time.`
        };
    }

    return { allowed: true };
}

// Check if room is tournament room
export function isTournamentRoom(roomName: string): boolean
{
    const room = rooms[roomName];
    return room ? !!room.tournamentId : roomName.startsWith('tournament-');
}

// Cleanup user isolation state on disconnect
export function cleanupUserIsolationState(userId: number): void
{
    console.log(`[Isolation] Cleanup state for user ${userId}`);
}
