import { FastifyInstance } from 'fastify';
import db from '../db.js';
import RankingSystem from '../ranking.js';

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/users', async (request, reply) => {
    try {
      const users = db.prepare(`
        SELECT id, username, avatar_url, wins, losses, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `).all();
      
      return { users };
    } catch (error) {
      console.error('Error fetching users:', error);
      return reply.status(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Endpoint pour le leaderboard
  fastify.get('/users/leaderboard', async (request, reply) => {
    try {
      const limit = parseInt((request.query as any)?.limit) || 10;
      const offset = parseInt((request.query as any)?.offset) || 0;
      
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
      console.error('Error fetching leaderboard:', error);
      return reply.status(500).send({ error: 'Failed to fetch leaderboard' });
    }
  });

  // Endpoint pour obtenir le rang d'un utilisateur
  fastify.get('/users/:id/rank', async (request, reply) => {
    try {
      const userId = parseInt((request.params as any).id);
      
      if (!userId) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }
      
      const rankingInfo = RankingSystem.getUserRankingInfo(userId);
      
      if (!rankingInfo) {
        return reply.status(404).send({ error: 'User not found or no ranking data' });
      }
      
      return { ranking: rankingInfo };
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return reply.status(500).send({ error: 'Failed to fetch user rank' });
    }
  });

  // Endpoint pour obtenir le classement autour d'un rang donné
  fastify.get('/users/leaderboard/around/:rank', async (request, reply) => {
    try {
      const rank = parseInt((request.params as any).rank);
      const radius = parseInt((request.query as any)?.radius) || 2;
      
      if (!rank || rank < 1) {
        return reply.status(400).send({ error: 'Invalid rank' });
      }
      
      const leaderboard = RankingSystem.getLeaderboardAroundRank(rank, radius);
      
      return { 
        leaderboard,
        centerRank: rank,
        radius
      };
    } catch (error) {
      console.error('Error fetching leaderboard around rank:', error);
      return reply.status(500).send({ error: 'Failed to fetch leaderboard around rank' });
    }
  });
}
