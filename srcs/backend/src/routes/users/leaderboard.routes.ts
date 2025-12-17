import { FastifyInstance } from 'fastify';
import RankingSystem from '../../ranking.js';
import { validateId } from '../../security.js';

/**
 * Routes du leaderboard et classement
 * - GET /users/leaderboard : Classement général
 * - GET /users/:id/rank : Rang d'un utilisateur (DEAD CODE - commented out)
 * - GET /users/leaderboard/around/:rank : Classement autour d'un rang (DEAD CODE - commented out)
 */
export default async function leaderboardRoutes(fastify: FastifyInstance)
{

  // GET /users/leaderboard - Classement général
  fastify.get('/users/leaderboard', async (request, reply) => {
    try {
      //limit and offset not used because no more next page in leaderboard page
      const limit = parseInt((request.query as any)?.limit) || 10;
      const offset = parseInt((request.query as any)?.offset) || 0;
      
      // dont read too much in db
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

  // DEAD CODE: GET /users/:id/rank - Rang d'un utilisateur
  // Frontend function fetchUserRank() exists but is never called
  // fastify.get('/users/:id/rank', async (request, reply) => {
  //   try {

  //     const userId = validateId((request.params as any).id);
      
  //     if (!userId)
  //       return reply.status(400).send({ error: 'Invalid user ID' });
      
  //     const rankingInfo = RankingSystem.getUserRankingInfo(userId);
      
  //     if (!rankingInfo)
  //       return reply.status(404).send({ error: 'User not found or no ranking data' });
      
  //     return { ranking: rankingInfo };
  //   } catch (error) {
  //     return reply.status(500).send({ error: 'Failed to fetch user rank' });
  //   }
  // });

  // DEAD CODE: GET /users/leaderboard/around/:rank - Classement autour d'un rang donné
  // Frontend function fetchLeaderboardAroundRank() exists but is never called
  // fastify.get('/users/leaderboard/around/:rank', async (request, reply) => {
  //   try {
  //     // SECURITY: Validate rank parameter
  //     const rank = validateId((request.params as any).rank);
  //     const radius = parseInt((request.query as any)?.radius) || 2;
      
  //     if (!rank) {
  //       return reply.status(400).send({ error: 'Invalid rank' });
  //     }
      
  //     // SECURITY: Validate radius to prevent excessive data retrieval
  //     if (radius < 1 || radius > 50) {
  //       return reply.status(400).send({ error: 'Radius must be between 1 and 50' });
  //     }
      
  //     const leaderboard = RankingSystem.getLeaderboardAroundRank(rank, radius);
      
  //     return { 
  //       leaderboard,
  //       centerRank: rank,
  //       radius
  //     };
  //   } catch (error) {
  //     return reply.status(500).send({ error: 'Failed to fetch leaderboard around rank' });
  //   }
  // });
}
