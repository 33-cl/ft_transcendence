import { FastifyInstance } from 'fastify';
import db from '../db.js';
import RankingSystem from '../ranking.js';
import jwt from 'jsonwebtoken';
// Add import for socket authentication utilities
import { getSocketIdForUser } from '../socket/socketAuth.js';
import { getPlayerRoom, isUsernameInGame } from '../socket/roomManager.js';
import { validateLength, sanitizeUsername, validateId, checkRateLimit, RATE_LIMITS } from '../security.js';
import { removeAngleBrackets } from '../utils/sanitize.js';
import { parseCookies, getJwtFromRequest } from '../helpers/http/cookie.helper.js';
import { notifyFriendAdded, notifyFriendRemoved } from '../socket/notificationHandlers.js';
import { getGlobalIo } from '../socket/socketHandlers.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

function notifyFriendRequestReceived(receiverId: number, senderId: number, fastify: FastifyInstance)
{
  try { 
    const sender = db.prepare('SELECT id, username FROM users WHERE id = ?').get(senderId) as { id: number; username: string } | undefined;
    
    if (!sender)
      return;
    
    const receiverSocketId = getSocketIdForUser(receiverId);
    
    if (receiverSocketId && (fastify as any).io)
    {
      const receiverSocket = (fastify as any).io.sockets.sockets.get(receiverSocketId);
      
      if (receiverSocket)
      {
        receiverSocket.emit('friendRequestReceived', {
          sender: {
            id: sender.id,
            username: sender.username
          },
          timestamp: Date.now()
        });
      }
    } 
  } catch (error) {
  }
}

export default async function usersRoutes(fastify: FastifyInstance)
{
  fastify.get('/users', async (request, reply) => {
    try {  
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return { users: [] };

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      } catch (err) {
        return { users: [] };
      }

      if (!currentUserId)
        return { users: [] };

      const friendsCount = db.prepare('SELECT COUNT(*) as count FROM friendships WHERE user_id = ?').get(currentUserId) as { count: number };
      
      const friends = db.prepare(`
        SELECT u.id, u.username, u.avatar_url, u.wins, u.losses, f.created_at 
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 10
      `).all(currentUserId);
      
      
      return { users: friends };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch friends' });
    }
  });

  fastify.get('/users/search', async (request, reply) => {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const searchRateLimitKey = `search_${currentUserId}`;
      if (!checkRateLimit(searchRateLimitKey, RATE_LIMITS.SEARCH_USERS.max, RATE_LIMITS.SEARCH_USERS.window))
        return reply.status(429).send({ error: 'Too many search requests. Please wait a moment.' });

      const query = (request.query as any)?.q || '';
      
      if (!validateLength(query, 1, 100))
        return reply.status(400).send({ error: 'Query too long or too short' });
      
      if (!query || query.length < 2)
        return { users: [] };

      const sanitizedQuery = removeAngleBrackets(query).trim();

      interface SearchUser
      {
        id: number;
        username: string;
        avatar_url: string | null;
        wins: number;
        losses: number;
      }
      const searchResults = db.prepare(`
        SELECT DISTINCT u.id, u.username, u.avatar_url, u.wins, u.losses
        FROM users u
        WHERE u.id != ? 
          AND LOWER(u.username) LIKE LOWER(?)
          AND u.id NOT IN (
            SELECT f.friend_id 
            FROM friendships f 
            WHERE f.user_id = ?
          )
        ORDER BY u.username
        LIMIT 10
      `).all(currentUserId, `%${sanitizedQuery}%`, currentUserId) as SearchUser[];

      const usersWithRequestStatus = searchResults.map((user: SearchUser) =>
      {
        const pendingRequest = db.prepare(
          'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
        ).get(currentUserId, user.id, 'pending');
        
        return {
          ...user,
          hasPendingRequest: !!pendingRequest
        };
      });

      return { users: usersWithRequestStatus };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to search users' });
    }
  });

  fastify.get('/users/friend-requests/received', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const requests = db.prepare(`
        SELECT fr.id as request_id, u.id, u.username, u.avatar_url, fr.created_at
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `).all(currentUserId);

      return { requests };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to fetch friend requests' });
    }
  });

  fastify.post('/users/friend-requests/:requestId/accept', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const acceptRateLimitKey = `friend_accept_${currentUserId}`;
      if (!checkRateLimit(acceptRateLimitKey, RATE_LIMITS.FRIEND_ACCEPT.max, RATE_LIMITS.FRIEND_ACCEPT.window))
        return reply.status(429).send({ error: 'Too many accept requests. Please wait a moment.' });

      const requestId = validateId((request.params as any).requestId);
      if (!requestId)
        return reply.status(400).send({ error: 'Invalid request ID' });
      
      const friendRequest = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?').get(requestId, currentUserId, 'pending') as any;
      
      if (!friendRequest)
        return reply.status(404).send({ error: 'Friend request not found' });

      db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(currentUserId, friendRequest.sender_id);
      db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(friendRequest.sender_id, currentUserId);
      
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
      
      notifyFriendAdded(getGlobalIo(), currentUserId, friendRequest.sender_id, fastify);
      
      return { success: true, message: 'Friend request accepted' };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to accept friend request' });
    }
  });

  fastify.post('/users/friend-requests/:requestId/reject', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const rejectRateLimitKey = `friend_reject_${currentUserId}`;
      if (!checkRateLimit(rejectRateLimitKey, RATE_LIMITS.FRIEND_REJECT.max, RATE_LIMITS.FRIEND_REJECT.window))
        return reply.status(429).send({ error: 'Too many reject requests. Please wait a moment.' });

      const requestId = validateId((request.params as any).requestId);
      if (!requestId)
        return reply.status(400).send({ error: 'Invalid request ID' });
      
      const friendRequest = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?').get(requestId, currentUserId, 'pending') as any;
      
      if (!friendRequest)
        return reply.status(404).send({ error: 'Friend request not found' });

      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);

      return { success: true, message: 'Friend request rejected' };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to reject friend request' });
    }
  });

  fastify.post('/users/:id/friend', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const friendRequestRateLimitKey = `friend_request_${currentUserId}`;
      if (!checkRateLimit(friendRequestRateLimitKey, RATE_LIMITS.FRIEND_REQUEST.max, RATE_LIMITS.FRIEND_REQUEST.window))
        return reply.status(429).send({ error: 'Too many friend requests. Please wait a moment.' });

      const friendId = validateId((request.params as any).id);
      if (!friendId)
        return reply.status(400).send({ error: 'Invalid friend ID' });
      
      if (friendId === currentUserId)
        return reply.status(400).send({ error: 'Cannot add yourself as a friend' });

      const friendExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(friendId);
      if (!friendExists)
        return reply.status(404).send({ error: 'User not found' });

      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      if (existingFriendship)
        return reply.status(400).send({ error: 'Already friends' });

      const existingRequest = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(currentUserId, friendId, 'pending');
      if (existingRequest)
        return reply.status(400).send({ error: 'Friend request already sent' });

      db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)').run(currentUserId, friendId, 'pending');
      
      notifyFriendRequestReceived(friendId, currentUserId, fastify);
      
      return { success: true, message: 'Friend request sent' };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to send friend request' });
    }
  });

  fastify.delete('/users/:id/friend', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      const removeRateLimitKey = `friend_remove_${currentUserId}`;
      if (!checkRateLimit(removeRateLimitKey, RATE_LIMITS.FRIEND_REMOVE.max, RATE_LIMITS.FRIEND_REMOVE.window))
        return reply.status(429).send({ error: 'Too many remove requests. Please wait a moment.' });

      const friendId = validateId((request.params as any).id);
      if (!friendId)
        return reply.status(400).send({ error: 'Invalid friend ID' });
      
      if (friendId === currentUserId)
        return reply.status(400).send({ error: 'Cannot remove yourself' });

      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      
      if (!existingFriendship)
        return reply.status(404).send({ error: 'Friendship not found' });

      db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );
      
      db.prepare('DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );

      notifyFriendRemoved(getGlobalIo(), currentUserId, friendId, fastify);
      
      return { success: true, message: 'Friend removed successfully' };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to remove friend' });
    }
  });

  fastify.get('/users/leaderboard', async (request, reply) =>
  {
    try
    {
      const limit = parseInt((request.query as any)?.limit) || 10;
      const offset = parseInt((request.query as any)?.offset) || 0;
      
      if (limit < 1 || limit > 100)
        return reply.status(400).send({ error: 'Limit must be between 1 and 100' });
      
      if (offset < 0 || offset > 10000)
        return reply.status(400).send({ error: 'Offset must be between 0 and 10000' });
      
      const leaderboard = RankingSystem.getLeaderboard({ limit, offset });
      const stats = RankingSystem.getLeaderboardStats();
      
      return { 
        leaderboard,
        stats,
        pagination: {
          limit,
          offset,
          total: stats.totalPlayers
        }
      };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to fetch leaderboard' });
    }
  });

  fastify.get('/users/:id/rank', async (request, reply) =>
  {
    try
    {
      const userId = validateId((request.params as any).id);
      
      if (!userId)
        return reply.status(400).send({ error: 'Invalid user ID' });
      
      const rankingInfo = RankingSystem.getUserRankingInfo(userId);
      
      if (!rankingInfo)
        return reply.status(404).send({ error: 'User not found or no ranking data' });
      
      return { ranking: rankingInfo };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to fetch user rank' });
    }
  });

  fastify.get('/users/leaderboard/around/:rank', async (request, reply) =>
  {
    try
    {
      const rank = validateId((request.params as any).rank);
      const radius = parseInt((request.query as any)?.radius) || 2;
      
      if (!rank)
        return reply.status(400).send({ error: 'Invalid rank' });
      
      if (radius < 1 || radius > 50)
        return reply.status(400).send({ error: 'Radius must be between 1 and 50' });
      
      const leaderboard = RankingSystem.getLeaderboardAroundRank(rank, radius);
      
      return { 
        leaderboard,
        centerRank: rank,
        radius
      };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to fetch leaderboard around rank' });
    }
  });

  fastify.get('/users/friends-online', async (request, reply) =>
  {
    try
    {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return reply.status(401).send({ error: 'Not authenticated' });

      let currentUserId: number | null = null;
      try
      {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      }
      catch (err)
      {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId)
        return reply.status(401).send({ error: 'Not authenticated' });

      interface FriendRow
      {
        id: number;
        username: string;
      }
      const friends = db.prepare(`
        SELECT u.id, u.username
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
      `).all(currentUserId) as FriendRow[];

      const friendsStatus = friends.map((friend: FriendRow) =>
      {
        const socketId = getSocketIdForUser(friend.id);
        const isOnline = !!socketId;
        const isInNormalGame = isOnline && isUsernameInGame(friend.username, true);
        const isInAnyGame = isOnline && isUsernameInGame(friend.username, false);
        const isInTournament = isInAnyGame && !isInNormalGame;
        
        let status: string;
        if (isInNormalGame)
          status = 'in-game';
        else if (isInTournament)
          status = 'in-tournament';
        else if (isOnline)
          status = 'online';
        else
          status = 'offline';
        
        return {
          username: friend.username,
          status
        };
      });

      return { friendsStatus };
    }
    catch (error)
    {
      return reply.status(500).send({ error: 'Failed to fetch friends online status' });
    }
  });
}
