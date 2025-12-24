import { FastifyInstance } from 'fastify';
import { getMatchHistory, getMatchById } from '../user.js';
import { validateId } from '../security.js';

export default async function matchesRoutes(fastify: FastifyInstance)
{
  // Get a match by its ID
  fastify.get('/matches/:matchId', async (request, reply) => {
    try {
      const params = request.params as any;
      
      const matchId = validateId(params.matchId);
      if (!matchId)
        return reply.status(400).send({ error: 'Invalid match ID' });
      
      const match = getMatchById(matchId);
      if (!match)
        return reply.status(404).send({ error: 'Match not found' });
      
      return reply.send({ match });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get usermatch history
  fastify.get('/matches/history/:userId', async (request, reply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;
      
      const userId = validateId(params.userId);
      if (!userId)
        return reply.status(400).send({ error: 'Invalid user ID' });
      
      const limitNum = parseInt(query.limit || '10') || 10;
      
      if (limitNum < 1 || limitNum > 100)
        return reply.status(400).send({ error: 'Limit must be between 1 and 100' });

      const matches = getMatchHistory(userId.toString(), limitNum);
      return reply.send({ matches });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
