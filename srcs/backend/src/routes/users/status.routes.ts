import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest } from '../../helpers/http/cookie.helper.js';
import { getSocketIdForUser } from '../../socket/socketAuth.js';
import { isUsernameInGame } from '../../socket/roomManager.js';

/**
 * Route de statut en ligne des amis
 * - GET /users/friends-online : Statuts actuels des amis
 */
export default async function statusRoutes(fastify: FastifyInstance) {

  // GET /users/friends-online - Statuts en ligne des amis
  // Endpoint léger appelé UNE FOIS au chargement, ensuite les WebSocket events gèrent les mises à jour
  fastify.get('/users/friends-online', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      // Récupérer les amis de l'utilisateur
      interface FriendRow {
        id: number;
        username: string;
      }
      const friends = db.prepare(`
        SELECT u.id, u.username
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
      `).all(currentUserId) as FriendRow[];

      // Obtenir le statut en ligne des amis
      const friendsStatus = friends.map((friend: FriendRow) => {
        const socketId = getSocketIdForUser(friend.id);
        const isOnline = !!socketId;
        // Vérifier si en jeu normal (spectatable)
        const isInNormalGame = isOnline && isUsernameInGame(friend.username, true);
        // Vérifier si en jeu (tout type, y compris tournoi)
        const isInAnyGame = isOnline && isUsernameInGame(friend.username, false);
        // En tournoi = en jeu mais pas en jeu normal
        const isInTournament = isInAnyGame && !isInNormalGame;
        
        let status: string;
        if (isInNormalGame) {
          status = 'in-game';
        } else if (isInTournament) {
          status = 'in-tournament';
        } else if (isOnline) {
          status = 'online';
        } else {
          status = 'offline';
        }
        
        return {
          username: friend.username,
          status
        };
      });

      return { friendsStatus };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch friends online status' });
    }
  });
}
