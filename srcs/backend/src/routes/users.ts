import { FastifyInstance } from 'fastify';
import db from '../db.js';

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
      const leaderboard = db.prepare(`
        SELECT id, username, avatar_url, wins, losses 
        FROM users 
        ORDER BY wins DESC, losses ASC 
        LIMIT 10
      `).all();
      
      return { leaderboard };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return reply.status(500).send({ error: 'Failed to fetch leaderboard' });
    }
  });
}
