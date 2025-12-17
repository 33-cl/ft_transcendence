import { FastifyInstance } from 'fastify';
import db from '../../db.js';
import { verifyAuthFromRequest, parseCookies } from '../../helpers/http/cookie.helper.js';
import { validateId, checkRateLimit, RATE_LIMITS } from '../../security.js';
import { notifyFriendAdded, notifyFriendRemoved } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';
import { getSocketIdForUser } from '../../socket/socketAuth.js';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET)
{
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Helper pour notifier qu'une nouvelle demande d'ami a été reçue
function notifyFriendRequestReceived(receiverId: number, senderId: number, fastify: FastifyInstance)
{
  try { 
    const sender = db.prepare('SELECT id, username FROM users WHERE id = ?').get(senderId) as { id: number; username: string } | undefined;
    
    if (!sender)
      return;
    
    const receiverSocketId = getSocketIdForUser(receiverId);
    
    if (receiverSocketId && (fastify as any).io)
    {
      const receiverSocket = (fastify as any).io.sockets.sockets.get(receiverSocketId);
      
      if (receiverSocket)
      {
        receiverSocket.emit('friendRequestReceived', {
          sender: {
            id: sender.id,
            username: sender.username
          },
          timestamp: Date.now()
        });
      }
    } 
  } catch (error) {
  }
}

/**
 * Routes de gestion des amis
 * - GET /users : Liste des amis de l'utilisateur connecté
 * - POST /users/:id/friend : Envoyer une demande d'ami
 * - DELETE /users/:id/friend : Supprimer un ami
 */
export default async function friendsRoutes(fastify: FastifyInstance)
{
  
  // GET /users - Liste des amis
  fastify.get('/users', async (request, reply) => {
    try {

      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken)
        return { users: [] };

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active)
          currentUserId = payload.userId;
      } catch (err) {
        return { users: [] };
      }

      if (!currentUserId)
        return { users: [] };

      // Récupérer les 10 derniers amis
      const friends = db.prepare(`
        SELECT u.id, u.username, u.avatar_url, u.wins, u.losses, f.created_at 
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 10
      `).all(currentUserId);
      
      return { users: friends };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch friends' });
    }
  });

  // POST /users/:id/friend - Envoyer une demande d'ami
  fastify.post('/users/:id/friend', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId)
        return;

      const friendRequestRateLimitKey = `friend_request_${currentUserId}`;
      if (!checkRateLimit(friendRequestRateLimitKey, RATE_LIMITS.FRIEND_REQUEST.max, RATE_LIMITS.FRIEND_REQUEST.window))
        return reply.status(429).send({ error: 'Too many friend requests. Please wait a moment.' });

      const friendId = validateId((request.params as any).id);
      if (!friendId)
        return reply.status(400).send({ error: 'Invalid friend ID' });
      
      if (friendId === currentUserId)
        return reply.status(400).send({ error: 'Cannot add yourself as a friend' });

      // Vérifier que l'utilisateur existe
      const friendExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(friendId);
      if (!friendExists)
        return reply.status(404).send({ error: 'User not found' });

      // est on deja amis? dans les deux sens
      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      if (existingFriendship)
        return reply.status(400).send({ error: 'Already friends' });

      // la demande existe deja?
      const existingRequest = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(currentUserId, friendId, 'pending');
      if (existingRequest)
        return reply.status(400).send({ error: 'Friend request already sent' });

      // Envoyer la demande d'ami
      db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)').run(currentUserId, friendId, 'pending');
      
      notifyFriendRequestReceived(friendId, currentUserId, fastify);

      return { success: true, message: 'Friend request sent' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to send friend request' });
    }
  });

  // DELETE /users/:id/friend - Supprimer un ami
  fastify.delete('/users/:id/friend', async (request, reply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId)
        return;

      const removeRateLimitKey = `friend_remove_${currentUserId}`;
      if (!checkRateLimit(removeRateLimitKey, RATE_LIMITS.FRIEND_REMOVE.max, RATE_LIMITS.FRIEND_REMOVE.window))
        return reply.status(429).send({ error: 'Too many remove requests. Please wait a moment.' });

      const friendId = validateId((request.params as any).id);
      if (!friendId)
        return reply.status(400).send({ error: 'Invalid friend ID' });
      
      if (friendId === currentUserId)
        return reply.status(400).send({ error: 'Cannot remove yourself' });

      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      
      if (!existingFriendship)
        return reply.status(404).send({ error: 'Friendship not found' });

      // delete friendship in both directions
      db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );
      
      //delete friendrequest in both directions
      db.prepare('DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );

      notifyFriendRemoved(getGlobalIo(), currentUserId, friendId, fastify);

      return { success: true, message: 'Friend removed successfully' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to remove friend' });
    }
  });
}
