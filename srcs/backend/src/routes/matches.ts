import { FastifyInstance } from 'fastify';
import { updateUserStats, getMatchHistory, getUserByUsername } from '../user.js';
import { validateId, sanitizeUsername, validateLength } from '../security.js';
import { verifyAuthFromRequest } from '../helpers/http/cookie.helper.js';

export default async function matchesRoutes(fastify: FastifyInstance) {
  // Enregistrer un match en utilisant les usernames
  // SECURITY: Route protégée par JWT - seuls les utilisateurs authentifiés peuvent enregistrer des matchs
  fastify.post('/matches', async (request, reply) => {
    try {
      // SECURITY: Vérifier l'authentification
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const body = request.body as any;
      const winnerUsername = body.winnerUsername;
      const loserUsername = body.loserUsername;
      const winnerScore = parseInt(body.winnerScore);
      const loserScore = parseInt(body.loserScore);
      const matchType: string = body.matchType || 'online';

      // SECURITY: Validate usernames
      if (!winnerUsername || !loserUsername) {
        return reply.status(400).send({ error: 'Missing usernames' });
      }
      
      if (!validateLength(winnerUsername, 1, 50) || !validateLength(loserUsername, 1, 50)) {
        return reply.status(400).send({ error: 'Invalid username length' });
      }
      
      const sanitizedWinner = sanitizeUsername(winnerUsername);
      const sanitizedLoser = sanitizeUsername(loserUsername);
      
      // Validation des scores
      if (isNaN(winnerScore) || isNaN(loserScore) || winnerScore < 0 || loserScore < 0) {
        return reply.status(400).send({ error: 'Invalid scores' });
      }

      if (sanitizedWinner === sanitizedLoser) {
        return reply.status(400).send({ 
          error: 'Winner and loser cannot be the same user. Use different browsers or private mode to test with different accounts.' 
        });
      }

      if (winnerScore <= loserScore) {
        return reply.status(400).send({ error: 'Winner score must be higher than loser score' });
      }

      // Chercher les utilisateurs par username
      const winnerUser = getUserByUsername(sanitizedWinner) as any;
      const loserUser = getUserByUsername(sanitizedLoser) as any;

      if (!winnerUser) {
        return reply.status(404).send({ error: `Winner user '${sanitizedWinner}' not found` });
      }

      if (!loserUser) {
        return reply.status(404).send({ error: `Loser user '${sanitizedLoser}' not found` });
      }

      // Enregistrer le match et mettre à jour les statistiques
      updateUserStats(winnerUser.id, loserUser.id, winnerScore, loserScore, matchType);

      return reply.send({ 
        success: true, 
        message: 'Match recorded successfully',
        winner: sanitizedWinner,
        loser: sanitizedLoser,
        score: `${winnerScore}-${loserScore}`
      });
    } catch (error) {
      console.error('Error recording match:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
  // Enregistrer le résultat d'un match en ligne
  // SECURITY: Route protégée par JWT - seuls les utilisateurs authentifiés peuvent enregistrer des résultats
  fastify.post('/matches/record', async (request, reply) => {
    try {
      // SECURITY: Vérifier l'authentification
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const body = request.body as any;
      
      // SECURITY: Validate IDs
      const winnerId = validateId(body.winnerId);
      const loserId = validateId(body.loserId);
      const winnerScore = parseInt(body.winnerScore);
      const loserScore = parseInt(body.loserScore);
      const matchType: string = body.matchType || 'online';

      // Validation des données
      if (!winnerId || !loserId) {
        return reply.status(400).send({ error: 'Invalid user IDs' });
      }
      
      if (isNaN(winnerScore) || isNaN(loserScore) || winnerScore < 0 || loserScore < 0) {
        return reply.status(400).send({ error: 'Invalid scores' });
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
