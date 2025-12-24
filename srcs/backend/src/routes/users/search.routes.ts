import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest } from '../../helpers/http/cookie.helper.js';
import { validateLength, checkRateLimit, RATE_LIMITS } from '../../security.js';
import { removeAngleBrackets } from '../../utils/sanitize.js';

interface UserRow {
  id: number;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
}

interface SearchUser {
  id: number;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
}

// User search routes
export default async function searchRoutes(fastify: FastifyInstance)
{
  // Get user by username
  fastify.get('/users/by-username/:username', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const params = request.params as any;
      const username = params.username;

      // Validate username format (alphanumeric, 3-20 chars)
      if (!username || typeof username !== 'string' || !validateLength(username, 3, 20))
        return reply.status(400).send({ error: 'Invalid username' });

      const user = db.prepare(`
        SELECT id, username, avatar_url, wins, losses
        FROM users
        WHERE username = ?
      `).get(username) as UserRow | undefined;

      if (!user)
        return reply.status(404).send({ error: 'User not found' });

      return { user };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch user' });
    }
  });

  // Search users
  fastify.get('/users/search', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId)
        return;

      const searchRateLimitKey = `search_${currentUserId}`;
      if (!checkRateLimit(searchRateLimitKey, RATE_LIMITS.SEARCH_USERS.max, RATE_LIMITS.SEARCH_USERS.window))
        return reply.status(429).send({ error: 'Too many search requests. Please wait a moment.' });
      

      const query = (request.query as any)?.q || '';
      
      if (!validateLength(query, 1, 100))
        return reply.status(400).send({ error: 'Query too long or too short' });
      
      if (!query || query.length < 2)
        return { users: [] };

      // Sanitize search query to prevent injection
      const sanitizedQuery = removeAngleBrackets(query).trim();

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

      // Add pending friend request status
      const usersWithRequestStatus = searchResults.map((user: SearchUser) => {
        const pendingRequest = db.prepare(
          'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
        ).get(currentUserId, user.id, 'pending');
        
        return {
          ...user,
          hasPendingRequest: !!pendingRequest
        };
      });

      return { users: usersWithRequestStatus };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to search users' });
    }
  });
}
