import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getUserBasicInfo, emitToUser, getUserWithAvatar, getUserFriends } from './utils/friendNotifications.js';

export function notifyFriendAdded(globalIo: Server | null, user1Id: number, user2Id: number, fastify: FastifyInstance)
{
    if (!globalIo)
        return;
    
    try
    {
        const user1 = getUserBasicInfo(user1Id);
        const user2 = getUserBasicInfo(user2Id);
        
        if (!user1 || !user2)
            return;
        
        emitToUser(globalIo, user1.id, 'friendAdded', {
            friend: {
                id: user2.id,
                username: user2.username
            },
            timestamp: Date.now()
        });
        
        emitToUser(globalIo, user2.id, 'friendAdded', {
            friend: {
                id: user1.id,
                username: user1.username
            },
            timestamp: Date.now()
        });
        
    }
    catch (error)
    {
    }
}

export function notifyFriendRemoved(globalIo: Server | null, user1Id: number, user2Id: number, fastify: FastifyInstance) 
{
    if (!globalIo)
        return;
    
    try
    {
        const user1 = getUserBasicInfo(user1Id);
        const user2 = getUserBasicInfo(user2Id);
        
        if (!user1 || !user2)
            return;
        
        emitToUser(globalIo, user1.id, 'friendRemoved', {
            friendId: user2.id,
            timestamp: Date.now()
        });
        
        emitToUser(globalIo, user2.id, 'friendRemoved', {
            friendId: user1.id,
            timestamp: Date.now()
        });
        
    }
    catch (error)
    {
    }
}

export function notifyProfileUpdated(globalIo: Server | null, userId: number, updates: { username?: string; avatar_url?: string }, fastify: FastifyInstance)
{
    if (!globalIo)
        return;
    
    try
    {
        const user = getUserWithAvatar(userId);
        if (!user)
            return;
        const friends = getUserFriends(userId);
        for (const friend of friends)
        {
            emitToUser(globalIo, friend.id, 'profileUpdated', {
                userId: user.id,
                username: updates.username || user.username,
                avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
                timestamp: Date.now()
            });
        }
        
    }
    catch (error)
    {
    }
}

export function broadcastUserStatusChange(globalIo: Server | null, userId: number, status: 'online' | 'in-game' | 'in-tournament' | 'offline', fastify: FastifyInstance)
{
    if (!globalIo) 
        return;
    
    try
    {
        const user = getUserBasicInfo(userId);
        if (!user)
            return;
        
        const friends = getUserFriends(userId);
        
        for (const friend of friends)
        {
            emitToUser(globalIo, friend.id, 'friendStatusChanged', {
                username: user.username,
                status: status,
                timestamp: Date.now()
            });
        }
        
    }
    catch (error)
    {
    }
}

export function broadcastLeaderboardUpdate(globalIo: Server | null, userId: number, updates: { username?: string; avatar_url?: string }, fastify: FastifyInstance)
{
    if (!globalIo)
        return;
    
    try
    {
        if (userId === 0)
        {
            globalIo.emit('leaderboardUpdated', {
                userId: 0,
                username: null,
                avatar_url: null,
                timestamp: Date.now(),
                reason: 'match_ended'
            });
            return;
        }
        
        const user = getUserWithAvatar(userId);
        if (!user)
            return;
        
        globalIo.emit('leaderboardUpdated', {
            userId: user.id,
            username: updates.username || user.username,
            avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
            timestamp: Date.now()
        });
        
    }
    catch (error)
    {
    }
}
