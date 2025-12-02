import { FastifyInstance } from 'fastify';
import { getMatchHistory } from '../user.js';
import { validateId } from '../security.js';

export default async function matchesRoutes(fastify: FastifyInstance) {
  // Récupérer l'historique des matchs d'un utilisateur
  fastify.get('/matches/history/:userId', async (request, reply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;
      
      // SECURITY: Validate userId
      const userId = validateId(params.userId);
      if (!userId) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }
      
      const limitNum = parseInt(query.limit || '10') || 10;
      
      // SECURITY: Limit the maximum number of matches returned
      if (limitNum < 1 || limitNum > 100) {
        return reply.status(400).send({ error: 'Limit must be between 1 and 100' });
      }

      const matches = getMatchHistory(userId.toString(), limitNum);
      return reply.send({ matches });
    } catch (error) {
      console.error('Error fetching match history:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
