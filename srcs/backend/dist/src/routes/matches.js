import { updateUserStats, getMatchHistory } from '../user.js';
export default async function matchesRoutes(fastify) {
    // Enregistrer le résultat d'un match en ligne
    fastify.post('/matches/record', async (request, reply) => {
        try {
            const body = request.body;
            const winnerId = parseInt(body.winnerId);
            const loserId = parseInt(body.loserId);
            const winnerScore = parseInt(body.winnerScore);
            const loserScore = parseInt(body.loserScore);
            const matchType = body.matchType || 'online';
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
        }
        catch (error) {
            console.error('Error recording match:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
    // Récupérer l'historique des matchs d'un utilisateur
    fastify.get('/matches/history/:userId', async (request, reply) => {
        try {
            const params = request.params;
            const query = request.query;
            const userId = params.userId;
            const limitNum = parseInt(query.limit || '10') || 10;
            const matches = getMatchHistory(userId, limitNum);
            return reply.send({ matches });
        }
        catch (error) {
            console.error('Error fetching match history:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
