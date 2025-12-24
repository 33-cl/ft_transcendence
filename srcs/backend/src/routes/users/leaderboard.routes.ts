import { FastifyInstance } from 'fastify';
import RankingSystem from '../../ranking.js';
import { validateId } from '../../security.js';

// Leaderboard routes
export default async function leaderboardRoutes(fastify: FastifyInstance)
{
  // Get global leaderboard
  fastify.get('/users/leaderboard', async (request, reply) => {
    try {
      const limit = parseInt((request.query as any)?.limit) || 10;
      const offset = parseInt((request.query as any)?.offset) || 0;
      
      // Prevent excessive DB reads
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
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch leaderboard' });
    }
  });
}
