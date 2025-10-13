import { FastifyInstance } from 'fastify';
import db from '../db.js';
import RankingSystem from '../ranking.js';
import jwt from 'jsonwebtoken';
// Add import for socket authentication utilities
import { getSocketIdForUser } from '../socket/socketAuth.js';
import { getPlayerRoom, isUsernameInGame } from '../socket/roomManager.js';
import { validateLength, sanitizeUsername, validateId, checkRateLimit, RATE_LIMITS } from '../security.js';
import { notifyFriendAdded, notifyFriendRemoved } from '../socket/socketHandlers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Helper pour extraire les cookies
function parseCookies(cookieString?: string): { [key: string]: string } {
  const out: { [key: string]: string } = {};
  if (!cookieString) return out;
  for (const cookie of cookieString.split(';')) {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
}

// Helper pour notifier qu'une nouvelle demande d'ami a été reçue
function notifyFriendRequestReceived(receiverId: number, senderId: number, fastify: FastifyInstance) {
  try {
    const sender = db.prepare('SELECT id, username FROM users WHERE id = ?').get(senderId) as { id: number; username: string } | undefined;
    
    if (!sender) return;
    
    const receiverSocketId = getSocketIdForUser(receiverId);
    if (receiverSocketId && (fastify as any).io) {
      const receiverSocket = (fastify as any).io.sockets.sockets.get(receiverSocketId);
      if (receiverSocket) {
        receiverSocket.emit('friendRequestReceived', {
          sender: {
            id: sender.id,
            username: sender.username
          },
          timestamp: Date.now()
        });
        console.log(`✅ Notified user ${receiverId} about friend request from ${sender.username}`);
      }
    }
  } catch (error) {
    console.error('Error notifying friend request received:', error);
  }
}

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/users', async (request, reply) => {
    try {
      console.log('[FRIENDS] === START /users request ===');
      
      // Récupérer le JWT depuis les cookies
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        console.log('[FRIENDS] No JWT token found');
        return { users: [] };
      }

      console.log('[FRIENDS] JWT token found');
      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        console.log(`[FRIENDS] JWT payload: ${JSON.stringify(payload)}`);
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        console.log(`[FRIENDS] Active token check result: ${JSON.stringify(active)}`);
        if (active) {
          currentUserId = payload.userId;
          console.log(`[FRIENDS] User authenticated: ${currentUserId}`);
        } else {
          console.log('[FRIENDS] Token not found in active_tokens');
        }
      } catch (err) {
        console.log(`[FRIENDS] JWT verification failed: ${err}`);
        return { users: [] };
      }

      if (!currentUserId) {
        console.log('[FRIENDS] No current user ID');
        return { users: [] };
      }

      console.log(`[FRIENDS] Getting friends for user ${currentUserId}`);

      // Vérifier si l'utilisateur a des amis
      const friendsCount = db.prepare('SELECT COUNT(*) as count FROM friendships WHERE user_id = ?').get(currentUserId) as { count: number };
      console.log(`[FRIENDS] Current friends count: ${friendsCount.count}`);
      


      // Récupérer tous les amis
      console.log('[FRIENDS] Fetching friends...');
      const friends = db.prepare(`
        SELECT u.id, u.username, u.avatar_url, u.wins, u.losses, f.created_at 
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 10
      `).all(currentUserId);
      
      console.log(`[FRIENDS] Found ${friends.length} friends:`, friends.map((f: any) => f.username));
      console.log('[FRIENDS] === END /users request ===');
      
      return { users: friends };
    } catch (error) {
      console.error('Error fetching friends:', error);
      return reply.status(500).send({ error: 'Failed to fetch friends' });
    }
  });

  // Endpoint pour rechercher des utilisateurs
  fastify.get('/users/search', async (request, reply) => {
    try {
      console.log('[SEARCH] === START /users/search request ===');
      
      // Récupérer le JWT depuis les cookies
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        console.log('[SEARCH] No JWT token found');
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // SECURITY: Rate limiting for search to prevent abuse
      const searchRateLimitKey = `search_${currentUserId}`;
      if (!checkRateLimit(searchRateLimitKey, RATE_LIMITS.SEARCH_USERS.max, RATE_LIMITS.SEARCH_USERS.window)) {
        return reply.status(429).send({ error: 'Too many search requests. Please wait a moment.' });
      }

      const query = (request.query as any)?.q || '';
      
      // SECURITY: Validate query length to prevent DoS
      if (!validateLength(query, 1, 100)) {
        return reply.status(400).send({ error: 'Query too long or too short' });
      }
      
      if (!query || query.length < 2) {
        return { users: [] };
      }

      // SECURITY: Sanitize search query to prevent SQL injection (additional protection)
      const sanitizedQuery = query.replace(/[<>]/g, '').trim();

      console.log(`[SEARCH] Searching for users with query: ${sanitizedQuery}`);

      // Chercher des utilisateurs qui ne sont pas déjà amis et qui ne sont pas l'utilisateur actuel
      const searchResults = db.prepare(`
        SELECT DISTINCT u.id, u.username, u.avatar_url, u.wins, u.losses
        FROM users u
        WHERE u.id != ? 
          AND LOWER(u.username) LIKE LOWER(?)
          AND u.id NOT IN (
            SELECT f.friend_id 
            FROM friendships f 
            WHERE f.user_id = ?
          )
        ORDER BY u.username
        LIMIT 10
      `).all(currentUserId, `%${sanitizedQuery}%`, currentUserId) as any[];

      // Ajouter l'information si une demande d'ami a déjà été envoyée
      const usersWithRequestStatus = searchResults.map((user: any) => {
        const pendingRequest = db.prepare(
          'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
        ).get(currentUserId, user.id, 'pending');
        
        return {
          ...user,
          hasPendingRequest: !!pendingRequest
        };
      });

      console.log(`[SEARCH] Found ${usersWithRequestStatus.length} users:`, usersWithRequestStatus.map((u: any) => `${u.username} (pending: ${u.hasPendingRequest})`));
      console.log('[SEARCH] === END /users/search request ===');

      return { users: usersWithRequestStatus };
    } catch (error) {
      console.error('Error searching users:', error);
      return reply.status(500).send({ error: 'Failed to search users' });
    }
  });

  // Endpoint pour envoyer une demande d'ami
  fastify.post('/users/:id/friend', async (request, reply) => {
    try {
      console.log('[SEND_FRIEND_REQUEST] === START send friend request ===');
      
      // Récupérer le JWT depuis les cookies
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // SECURITY: Rate limiting for friend requests to prevent spam
      const friendRequestRateLimitKey = `friend_request_${currentUserId}`;
      if (!checkRateLimit(friendRequestRateLimitKey, RATE_LIMITS.FRIEND_REQUEST.max, RATE_LIMITS.FRIEND_REQUEST.window)) {
        return reply.status(429).send({ error: 'Too many friend requests. Please wait a moment.' });
      }

      // SECURITY: Validate ID parameter
      const friendId = validateId((request.params as any).id);
      if (!friendId) {
        return reply.status(400).send({ error: 'Invalid friend ID' });
      }
      
      if (friendId === currentUserId) {
        return reply.status(400).send({ error: 'Cannot add yourself as a friend' });
      }

      // Vérifier que l'utilisateur existe
      const friendExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(friendId);
      if (!friendExists) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Vérifier que la relation d'amitié n'existe pas déjà (dans les deux sens)
      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      if (existingFriendship) {
        return reply.status(400).send({ error: 'Already friends' });
      }

      // Vérifier qu'il n'y a pas déjà une demande en attente
      const existingRequest = db.prepare('SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(currentUserId, friendId, 'pending');
      if (existingRequest) {
        return reply.status(400).send({ error: 'Friend request already sent' });
      }

      // Envoyer la demande d'ami
      db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)').run(currentUserId, friendId, 'pending');
      
      // Notifier le destinataire de la demande d'ami
      notifyFriendRequestReceived(friendId, currentUserId, fastify);
      
      console.log(`[SEND_FRIEND_REQUEST] Sent friend request from ${currentUserId} to ${friendId}`);
      console.log('[SEND_FRIEND_REQUEST] === END send friend request ===');

      return { success: true, message: 'Friend request sent' };
    } catch (error) {
      console.error('Error sending friend request:', error);
      return reply.status(500).send({ error: 'Failed to send friend request' });
    }
  });

  // Endpoint pour obtenir les demandes d'amis reçues
  fastify.get('/users/friend-requests/received', async (request, reply) => {
    try {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Récupérer toutes les demandes d'amis reçues en attente
      const requests = db.prepare(`
        SELECT fr.id as request_id, u.id, u.username, u.avatar_url, fr.created_at
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `).all(currentUserId);

      return { requests };
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      return reply.status(500).send({ error: 'Failed to fetch friend requests' });
    }
  });

  // Endpoint pour accepter une demande d'ami
  fastify.post('/users/friend-requests/:requestId/accept', async (request, reply) => {
    try {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

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
      
      console.log(`[ACCEPT_FRIEND_REQUEST] Accepted friend request ${requestId} and created friendship`);
      
      // Notifier les deux utilisateurs qu'ils sont maintenant amis
      notifyFriendAdded(currentUserId, friendRequest.sender_id, fastify);

      return { success: true, message: 'Friend request accepted' };
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return reply.status(500).send({ error: 'Failed to accept friend request' });
    }
  });

  // Endpoint pour refuser une demande d'ami
  fastify.post('/users/friend-requests/:requestId/reject', async (request, reply) => {
    try {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

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
      
      console.log(`[REJECT_FRIEND_REQUEST] Rejected and deleted friend request ${requestId}`);

      return { success: true, message: 'Friend request rejected' };
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return reply.status(500).send({ error: 'Failed to reject friend request' });
    }
  });

  // Endpoint pour supprimer un ami
  fastify.delete('/users/:id/friend', async (request, reply) => {
    try {
      console.log('[REMOVE_FRIEND] === START remove friend request ===');
      
      // Récupérer le JWT depuis les cookies
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // SECURITY: Rate limiting for removing friends
      const removeRateLimitKey = `friend_remove_${currentUserId}`;
      if (!checkRateLimit(removeRateLimitKey, RATE_LIMITS.FRIEND_REMOVE.max, RATE_LIMITS.FRIEND_REMOVE.window)) {
        return reply.status(429).send({ error: 'Too many remove requests. Please wait a moment.' });
      }

      // SECURITY: Validate ID parameter
      const friendId = validateId((request.params as any).id);
      if (!friendId) {
        return reply.status(400).send({ error: 'Invalid friend ID' });
      }
      
      if (friendId === currentUserId) {
        return reply.status(400).send({ error: 'Cannot remove yourself' });
      }

      // Vérifier que la relation d'amitié existe (dans un sens ou l'autre)
      const existingFriendship = db.prepare(
        'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(currentUserId, friendId, friendId, currentUserId);
      
      if (!existingFriendship) {
        return reply.status(404).send({ error: 'Friendship not found' });
      }

      // Supprimer la relation d'amitié dans les deux sens
      db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );
      
      // Supprimer également toutes les demandes d'amis en attente entre ces deux utilisateurs
      db.prepare('DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)').run(
        currentUserId, friendId, friendId, currentUserId
      );
      
      console.log(`[REMOVE_FRIEND] Removed friendship and pending requests between ${currentUserId} and ${friendId} (both directions)`);
      
      // Notifier les deux utilisateurs en temps réel
      notifyFriendRemoved(currentUserId, friendId, fastify);
      
      console.log('[REMOVE_FRIEND] === END remove friend request ===');

      return { success: true, message: 'Friend removed successfully' };
    } catch (error) {
      console.error('Error removing friend:', error);
      return reply.status(500).send({ error: 'Failed to remove friend' });
    }
  });

  // Endpoint pour le leaderboard
  fastify.get('/users/leaderboard', async (request, reply) => {
    try {
      const limit = parseInt((request.query as any)?.limit) || 10;
      const offset = parseInt((request.query as any)?.offset) || 0;
      
      // SECURITY: Validate limit and offset to prevent DoS
      if (limit < 1 || limit > 100) {
        return reply.status(400).send({ error: 'Limit must be between 1 and 100' });
      }
      
      if (offset < 0 || offset > 10000) {
        return reply.status(400).send({ error: 'Offset must be between 0 and 10000' });
      }
      
      const leaderboard = RankingSystem.getLeaderboard({ limit, offset });
      const stats = RankingSystem.getLeaderboardStats();
      
      return { 
        leaderboard,
        stats,
        pagination: {
          limit,
          offset,
          total: stats.totalPlayers
        }
      };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return reply.status(500).send({ error: 'Failed to fetch leaderboard' });
    }
  });

  // Endpoint pour obtenir le rang d'un utilisateur
  fastify.get('/users/:id/rank', async (request, reply) => {
    try {
      // SECURITY: Validate ID parameter
      const userId = validateId((request.params as any).id);
      
      if (!userId) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }
      
      const rankingInfo = RankingSystem.getUserRankingInfo(userId);
      
      if (!rankingInfo) {
        return reply.status(404).send({ error: 'User not found or no ranking data' });
      }
      
      return { ranking: rankingInfo };
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return reply.status(500).send({ error: 'Failed to fetch user rank' });
    }
  });

  // Endpoint pour obtenir le classement autour d'un rang donné
  fastify.get('/users/leaderboard/around/:rank', async (request, reply) => {
    try {
      // SECURITY: Validate rank parameter
      const rank = validateId((request.params as any).rank);
      const radius = parseInt((request.query as any)?.radius) || 2;
      
      if (!rank) {
        return reply.status(400).send({ error: 'Invalid rank' });
      }
      
      // SECURITY: Validate radius to prevent excessive data retrieval
      if (radius < 1 || radius > 50) {
        return reply.status(400).send({ error: 'Radius must be between 1 and 50' });
      }
      
      const leaderboard = RankingSystem.getLeaderboardAroundRank(rank, radius);
      
      return { 
        leaderboard,
        centerRank: rank,
        radius
      };
    } catch (error) {
      console.error('Error fetching leaderboard around rank:', error);
      return reply.status(500).send({ error: 'Failed to fetch leaderboard around rank' });
    }
  });

  // 🚀 NOUVEAU : Endpoint léger pour obtenir les statuts actuels des amis (appelé UNE FOIS au chargement)
  // Ensuite les WebSocket events gèrent les mises à jour en temps réel
  fastify.get('/users/friends-online', async (request, reply) => {
    try {
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        }
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (!currentUserId) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      // Récupérer les amis de l'utilisateur
      const friends = db.prepare(`
        SELECT u.id, u.username
        FROM friendships f
        JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ?
      `).all(currentUserId);

      // Obtenir le statut en ligne des amis
      const friendsStatus = friends.map((friend: any) => {
        const socketId = getSocketIdForUser(friend.id);
        const isOnline = !!socketId;
        const isInGame = isOnline && isUsernameInGame(friend.username);
        
        return {
          username: friend.username,
          status: isInGame ? 'in-game' : (isOnline ? 'online' : 'offline')
        };
      });

      return { friendsStatus };
    } catch (error) {
      console.error('Error fetching friends online status:', error);
      return reply.status(500).send({ error: 'Failed to fetch friends online status' });
    }
  });
}
