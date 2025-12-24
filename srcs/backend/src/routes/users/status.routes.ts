import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest } from '../../helpers/http/cookie.helper.js';
import { getSocketIdForUser } from '../../socket/socketAuth.js';
import { isUsernameInGame } from '../../socket/roomManager.js';

// Friend online status route
export default async function statusRoutes(fastify: FastifyInstance) {

  // Get friends online status
  fastify.get('/users/friends-online', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

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

      const friendsStatus = friends.map((friend: FriendRow) => {
        const socketId = getSocketIdForUser(friend.id);
        const isOnline = !!socketId;
        // Check if in normal game (spectatable)
        const isInNormalGame = isOnline && isUsernameInGame(friend.username, true);
        // Check if in any game (including tournament)
        const isInAnyGame = isOnline && isUsernameInGame(friend.username, false);
        // In tournament = in game but not in normal game
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
