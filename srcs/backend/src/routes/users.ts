import { FastifyInstance } from 'fastify';
import db from '../db.js';
import RankingSystem from '../ranking.js';
import jwt from 'jsonwebtoken';
// Add import for socket authentication utilities
import { getSocketIdForUser } from '../socket/socketAuth.js';
import { getPlayerRoom, isUsernameInGame } from '../socket/roomManager.js';
import { validateLength, sanitizeUsername, validateId, checkRateLimit, RATE_LIMITS } from '../security.js';
import { removeAngleBrackets } from '../utils/sanitize.js';
import { parseCookies, getJwtFromRequest } from '../helpers/http/cookie.helper.js';
import { notifyFriendAdded, notifyFriendRemoved } from '../socket/notificationHandlers.js';
import { getGlobalIo } from '../socket/socketHandlers.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Cookie parsing is provided by helpers/cookie.helper.ts

// Helper pour notifier qu'une nouvelle demande d'ami a été reçue
function notifyFriendRequestReceived(receiverId: number, senderId: number, fastify: FastifyInstance)
{
  try {
    
    const sender = db.prepare('SELECT id, username FROM users WHERE id = ?').get(senderId) as { id: number; username: string } | undefined;
    
    if (!sender) {
      return;
    }
    
    
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
      }
    } 
  } catch (error) {
  }
}

// 🆕 Helper pour notifier un changement dans le compteur de demandes d'amis (accepté/rejeté)
function notifyFriendRequestCountChanged(userId: number, fastify: FastifyInstance) {
  try {
    const userSocketId = getSocketIdForUser(userId);
    if (userSocketId && (fastify as any).io) {
      const userSocket = (fastify as any).io.sockets.sockets.get(userSocketId);
      if (userSocket) {
        userSocket.emit('friendRequestCountChanged', {
          timestamp: Date.now()
        });
      }
    }
  } catch (error) {
  }
}

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/users', async (request, reply) => {
    try {
      
      // Récupérer le JWT depuis les cookies
      const cookies = parseCookies(request.headers['cookie'] as string | undefined);
      const jwtToken = cookies['jwt'];
      
      if (!jwtToken) {
        return { users: [] };
      }

      let currentUserId: number | null = null;
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (active) {
          currentUserId = payload.userId;
        } 
      } catch (err) {
        return { users: [] };
      }

      if (!currentUserId) {
        return { users: [] };
      }


      // Vérifier si l'utilisateur a des amis
      const friendsCount = db.prepare('SELECT COUNT(*) as count FROM friendships WHERE user_id = ?').get(currentUserId) as { count: number };
      


      // Récupérer tous les amis
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

  // Endpoint pour rechercher des utilisateurs
  fastify.get('/users/search', async (request, reply) => {
    try {
      
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

      // SECURITY: Sanitize search query to prevent injection (supprime < et >)
      const sanitizedQuery = removeAngleBrackets(query).trim();


      // Chercher des utilisateurs qui ne sont pas déjà amis et qui ne sont pas l'utilisateur actuel
      interface SearchUser {
        id: number;
        username: string;
        avatar_url: string | null;
        wins: number;
        losses: number;
      }
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
      `).all(currentUserId, `%${sanitizedQuery}%`, currentUserId) as SearchUser[];

      // Ajouter l'information si une demande d'ami a déjà été envoyée
      const usersWithRequestStatus = searchResults.map((user: SearchUser) => {
        const pendingRequest = db.prepare(
          'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?'
        ).get(currentUserId, user.id, 'pending');
        
        return {
          ...user,
          hasPendingRequest: !!pendingRequest
        };
      });


      return { users: usersWithRequestStatus };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to search users' });
    }
  });

  // Endpoint pour envoyer une demande d'ami
  fastify.post('/users/:id/friend', async (request, reply) => {
    try {
      
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
      

      return { success: true, message: 'Friend request sent' };
    } catch (error) {
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
      
      
      // Notifier les deux utilisateurs qu'ils sont maintenant amis
      notifyFriendAdded(getGlobalIo(), currentUserId, friendRequest.sender_id, fastify);
      
      // 🆕 Notifier l'utilisateur que son compteur de demandes a changé
      notifyFriendRequestCountChanged(currentUserId, fastify);

      return { success: true, message: 'Friend request accepted' };
    } catch (error) {
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
      
      
      // 🆕 Notifier l'utilisateur que son compteur de demandes a changé
      notifyFriendRequestCountChanged(currentUserId, fastify);

      return { success: true, message: 'Friend request rejected' };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to reject friend request' });
    }
  });

  // Endpoint pour supprimer un ami
  fastify.delete('/users/:id/friend', async (request, reply) => {
    try {
      
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


      // Notifier les deux utilisateurs en temps réel
      notifyFriendRemoved(getGlobalIo(), currentUserId, friendId, fastify);
      

      return { success: true, message: 'Friend removed successfully' };
    } catch (error) {
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
        const isInGame = isOnline && isUsernameInGame(friend.username);
        
        return {
          username: friend.username,
          status: isInGame ? 'in-game' : (isOnline ? 'online' : 'offline')
        };
      });

      return { friendsStatus };
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch friends online status' });
    }
  });
}
