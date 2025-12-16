import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest } from '../../helpers/http/cookie.helper.js';
import { validateLength, checkRateLimit, RATE_LIMITS } from '../../security.js';
import { removeAngleBrackets } from '../../utils/sanitize.js';

/**
 * Route de recherche d'utilisateurs
 * - GET /users/search : Rechercher des utilisateurs par nom
 */
export default async function searchRoutes(fastify: FastifyInstance) {

  // GET /users/search - Rechercher des utilisateurs
  fastify.get('/users/search', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      // SECURITY: Rate limiting for search to prevent abuse
      const searchRateLimitKey = `search_${currentUserId}`;
      if (!checkRateLimit(searchRateLimitKey, RATE_LIMITS.SEARCH_USERS.max, RATE_LIMITS.SEARCH_USERS.window)) {
        return reply.status(429).send({ error: 'Too many search requests. Please wait a moment.' });
      }

      const query = (request.query as any)?.q || '';
      
      // SECURITY: Validate query length to prevent DoS
      if (!validateLength(query, 1, 100)) {
        return reply.status(400).send({ error: 'Query too long or too short' });
      }
      
      if (!query || query.length < 2) {
        return { users: [] };
      }

      // SECURITY: Sanitize search query to prevent injection (supprime < et >)
      const sanitizedQuery = removeAngleBrackets(query).trim();

      // Chercher des utilisateurs qui ne sont pas déjà amis et qui ne sont pas l'utilisateur actuel
      interface SearchUser {
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

      // Ajouter l'information si une demande d'ami a déjà été envoyée
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
