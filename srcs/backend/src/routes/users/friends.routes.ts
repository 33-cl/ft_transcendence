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

// Check if mutual friend request exists and auto-accept if both users want to be friends
function tryAutoAcceptMutualRequest(
  currentUserId: number,
  friendId: number,
  fastify: FastifyInstance
): boolean
{
  const reverseRequest = db.prepare(
    'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
  ).get(friendId, currentUserId, 'pending') as { id: number } | undefined;

  if (!reverseRequest)
    return false;

  // Delete reverse request
  db.prepare('DELETE FROM friend_requests WHERE id = ?').run(reverseRequest.id);

  // Create bidirectional friendship
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(currentUserId, friendId);
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(friendId, currentUserId);

  // Notify both users that friendship is created
  notifyFriendAdded(getGlobalIo(), currentUserId, friendId, fastify);

  return true;
}

// Notify user that they received a new friend request
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

// Friend management routes list friends, send request, remove friend
export default async function friendsRoutes(fastify: FastifyInstance)
{
  
  // Get friends list
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

      // Get last 10 friends
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

  // Send friend request
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

      // Check if user exists
      const friendExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(friendId);
      if (!friendExists)
        return reply.status(404).send({ error: 'User not found' });

      // Check if already friends
      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      if (existingFriendship)
        return reply.status(400).send({ error: 'Already friends' });

      // Check if request already exists
      const existingRequest = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(currentUserId, friendId, 'pending');
      if (existingRequest)
        return reply.status(400).send({ error: 'Friend request already sent' });

      // Auto-accept if mutual request exists
      if (tryAutoAcceptMutualRequest(currentUserId, friendId, fastify))
        return { success: true, message: 'Friend request auto-accepted (mutual request)' };

      // Send friend request
      db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)').run(currentUserId, friendId, 'pending');
      
      notifyFriendRequestReceived(friendId, currentUserId, fastify);

      return { success: true, message: 'Friend request sent' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to send friend request' });
    }
  });

  // Remove friend
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

      // Delete friendship in both directions
      db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );
      
      // Delete friend request in both directions
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
