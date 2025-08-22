import { FastifyInstance } from 'fastify';
import { updateUserStats, getMatchHistory, getUserByUsername } from '../user.js';

export default async function matchesRoutes(fastify: FastifyInstance) {
  // Enregistrer un match en utilisant les usernames (pour test)
  fastify.post('/matches', async (request, reply) => {
    try {
      const body = request.body as any;
      const winnerUsername = body.winnerUsername;
      const loserUsername = body.loserUsername;
      const winnerScore = parseInt(body.winnerScore);
      const loserScore = parseInt(body.loserScore);
      const matchType: string = body.matchType || 'online';

      // Validation des données
      if (!winnerUsername || !loserUsername || isNaN(winnerScore) || isNaN(loserScore)) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      if (winnerUsername === loserUsername) {
        return reply.status(400).send({ 
          error: 'Winner and loser cannot be the same user. Use different browsers or private mode to test with different accounts.' 
        });
      }

      if (winnerScore <= loserScore) {
        return reply.status(400).send({ error: 'Winner score must be higher than loser score' });
      }

      // Chercher les utilisateurs par username
      const winnerUser = getUserByUsername(winnerUsername) as any;
      const loserUser = getUserByUsername(loserUsername) as any;

      if (!winnerUser) {
        return reply.status(404).send({ error: `Winner user '${winnerUsername}' not found` });
      }

      if (!loserUser) {
        return reply.status(404).send({ error: `Loser user '${loserUsername}' not found` });
      }

      // Enregistrer le match et mettre à jour les statistiques
      updateUserStats(winnerUser.id, loserUser.id, winnerScore, loserScore, matchType);

      return reply.send({ 
        success: true, 
        message: 'Match recorded successfully',
        winner: winnerUsername,
        loser: loserUsername,
        score: `${winnerScore}-${loserScore}`
      });
    } catch (error) {
      console.error('Error recording match:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
  // Enregistrer le résultat d'un match en ligne
  fastify.post('/matches/record', async (request, reply) => {
    try {
      const body = request.body as any;
      const winnerId = parseInt(body.winnerId);
      const loserId = parseInt(body.loserId);
      const winnerScore = parseInt(body.winnerScore);
      const loserScore = parseInt(body.loserScore);
      const matchType: string = body.matchType || 'online';

      // Validation des données
      if (!winnerId || !loserId || isNaN(winnerScore) || isNaN(loserScore)) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      if (winnerId === loserId) {
        return reply.status(400).send({ error: 'Winner and loser cannot be the same' });
      }

      if (winnerScore <= loserScore) {
        return reply.status(400).send({ error: 'Winner score must be higher than loser score' });
      }

      // Enregistrer le match et mettre à jour les statistiques
      updateUserStats(winnerId, loserId, winnerScore, loserScore, matchType);

      return reply.send({ success: true, message: 'Match recorded successfully' });
    } catch (error) {
      console.error('Error recording match:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Récupérer l'historique des matchs d'un utilisateur
  fastify.get('/matches/history/:userId', async (request, reply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const userId = params.userId;
      const limitNum = parseInt(query.limit || '10') || 10;

      const matches = getMatchHistory(userId, limitNum);
      return reply.send({ matches });
    } catch (error) {
      console.error('Error fetching match history:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
