import { Server } from 'socket.io';
import db from '../../db.js';
import { getSocketIdForUser } from '../socketAuth.js';

interface UserBasicInfo
{
    id: number;
    username: string;
}

interface UserWithAvatar
{
    id: number;
    username: string;
    avatar_url: string | null;
}

// Get basic user info by ID
export function getUserBasicInfo(userId: number): UserBasicInfo | undefined
{
    return db
        .prepare('SELECT id, username FROM users WHERE id = ?')
        .get(userId) as UserBasicInfo | undefined;
}

// Get user info with avatar
export function getUserWithAvatar(userId: number): UserWithAvatar | undefined
{
    return db
        .prepare('SELECT id, username, avatar_url FROM users WHERE id = ?')
        .get(userId) as UserWithAvatar | undefined;
}

// Get all friends of a user (bidirectional)
export function getUserFriends(userId: number): Array<UserBasicInfo>
{
    return db.prepare(`
        SELECT DISTINCT u.id, u.username
        FROM users u
        WHERE u.id IN (
            SELECT friend_id FROM friendships WHERE user_id = ?
            UNION
            SELECT user_id FROM friendships WHERE friend_id = ?
        )
    `).all(userId, userId) as Array<UserBasicInfo>;
}

// Get user socket and emit event
export function emitToUser(
    io: Server,
    userId: number,
    eventName: string,
    data: any
): boolean
{
    const socketId = getSocketIdForUser(userId);
    if (!socketId)
        return false;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket)
        return false;

    socket.emit(eventName, data);
    return true;
}
