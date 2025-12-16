import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest } from '../../helpers/http/cookie.helper.js';
import { validateId, checkRateLimit, RATE_LIMITS } from '../../security.js';
import { notifyFriendAdded } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';

/*
 Routes de gestion des demandes d'amis
 - GET /users/friend-requests/received : Liste des demandes reçues
 - POST /users/friend-requests/:requestId/accept : Accepter une demande
 - POST /users/friend-requests/:requestId/reject : Refuser une demande
*/
export default async function friendRequestsRoutes(fastify: FastifyInstance)
{
  fastify.get('/users/friend-requests/received', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId)
        return;

      const requests = db.prepare(`
        SELECT fr.id as request_id, u.id, u.username, u.avatar_url, fr.created_at
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `).all(currentUserId);

      return { requests };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch friend requests' });
    }
  });

  // POST /users/friend-requests/:requestId/accept - Accepter une demande d'ami
  fastify.post('/users/friend-requests/:requestId/accept', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      // SECURITY: Rate limiting for accepting friend requests
      const acceptRateLimitKey = `friend_accept_${currentUserId}`;
      if (!checkRateLimit(acceptRateLimitKey, RATE_LIMITS.FRIEND_ACCEPT.max, RATE_LIMITS.FRIEND_ACCEPT.window)) {
        return reply.status(429).send({ error: 'Too many accept requests. Please wait a moment.' });
      }

      // SECURITY: Validate requestId parameter
      const requestId = validateId((request.params as any).requestId);
      if (!requestId) {
        return reply.status(400).send({ error: 'Invalid request ID' });
      }
      
      // Récupérer la demande d'ami
      const friendRequest = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?').get(requestId, currentUserId, 'pending') as any;
      
      if (!friendRequest) {
        return reply.status(404).send({ error: 'Friend request not found' });
      }

      // Ajouter les deux relations d'amitié (bidirectionnelle)
      db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(currentUserId, friendRequest.sender_id);
      db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(friendRequest.sender_id, currentUserId);
      
      // Supprimer la demande au lieu de la marquer comme acceptée (nettoyage)
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
      
      // Notifier les deux utilisateurs qu'ils sont maintenant amis
      notifyFriendAdded(getGlobalIo(), currentUserId, friendRequest.sender_id, fastify);

      return { success: true, message: 'Friend request accepted' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to accept friend request' });
    }
  });

  // POST /users/friend-requests/:requestId/reject - Refuser une demande d'ami
  fastify.post('/users/friend-requests/:requestId/reject', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      // SECURITY: Rate limiting for rejecting friend requests
      const rejectRateLimitKey = `friend_reject_${currentUserId}`;
      if (!checkRateLimit(rejectRateLimitKey, RATE_LIMITS.FRIEND_REJECT.max, RATE_LIMITS.FRIEND_REJECT.window)) {
        return reply.status(429).send({ error: 'Too many reject requests. Please wait a moment.' });
      }

      // SECURITY: Validate requestId parameter
      const requestId = validateId((request.params as any).requestId);
      if (!requestId) {
        return reply.status(400).send({ error: 'Invalid request ID' });
      }
      
      // Récupérer la demande d'ami
      const friendRequest = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?').get(requestId, currentUserId, 'pending') as any;
      
      if (!friendRequest) {
        return reply.status(404).send({ error: 'Friend request not found' });
      }

      // Supprimer la demande au lieu de la marquer comme rejetée (permet de redemander plus tard)
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);

      return { success: true, message: 'Friend request rejected' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to reject friend request' });
    }
  });
}
