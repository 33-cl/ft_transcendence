import { FastifyInstance } from 'fastify';
import db from '../db.js';
import RankingSystem from '../ranking.js';
import jwt from 'jsonwebtoken';

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
      
      // Si pas d'amis, ajouter pastel comme ami
      if (friendsCount.count === 0) {
        console.log('[FRIENDS] No friends found, searching for pastel user...');
        const pastelUser = db.prepare('SELECT id FROM users WHERE username = ?').get('pastel') as { id: number } | undefined;
        
        if (pastelUser) {
          console.log(`[FRIENDS] Found pastel user with ID: ${pastelUser.id}`);
          console.log('[FRIENDS] Adding friendship...');
          db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(currentUserId, pastelUser.id);
          console.log('[FRIENDS] Friendship added!');
        } else {
          console.log('[FRIENDS] PASTEL USER NOT FOUND!');
        }
      }

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

      const query = (request.query as any)?.q || '';
      if (!query || query.length < 2) {
        return { users: [] };
      }

      console.log(`[SEARCH] Searching for users with query: ${query}`);

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
      `).all(currentUserId, `%${query}%`, currentUserId);

      console.log(`[SEARCH] Found ${searchResults.length} users:`, searchResults.map((u: any) => u.username));
      console.log('[SEARCH] === END /users/search request ===');

      return { users: searchResults };
    } catch (error) {
      console.error('Error searching users:', error);
      return reply.status(500).send({ error: 'Failed to search users' });
    }
  });

  // Endpoint pour ajouter un ami
  fastify.post('/users/:id/friend', async (request, reply) => {
    try {
      console.log('[ADD_FRIEND] === START add friend request ===');
      
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

      const friendId = parseInt((request.params as any).id);
      if (!friendId || friendId === currentUserId) {
        return reply.status(400).send({ error: 'Invalid friend ID' });
      }

      // Vérifier que l'utilisateur existe
      const friendExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(friendId);
      if (!friendExists) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Vérifier que la relation d'amitié n'existe pas déjà
      const existingFriendship = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(currentUserId, friendId);
      if (existingFriendship) {
        return reply.status(400).send({ error: 'Already friends' });
      }

      // Ajouter la relation d'amitié
      db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(currentUserId, friendId);
      
      console.log(`[ADD_FRIEND] Added friendship between ${currentUserId} and ${friendId}`);
      console.log('[ADD_FRIEND] === END add friend request ===');

      return { success: true, message: 'Friend added successfully' };
    } catch (error) {
      console.error('Error adding friend:', error);
      return reply.status(500).send({ error: 'Failed to add friend' });
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

      const friendId = parseInt((request.params as any).id);
      if (!friendId || friendId === currentUserId) {
        return reply.status(400).send({ error: 'Invalid friend ID' });
      }

      // Vérifier que la relation d'amitié existe
      const existingFriendship = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(currentUserId, friendId);
      if (!existingFriendship) {
        return reply.status(404).send({ error: 'Friendship not found' });
      }

      // Supprimer la relation d'amitié
      db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(currentUserId, friendId);
      
      console.log(`[REMOVE_FRIEND] Removed friendship between ${currentUserId} and ${friendId}`);
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
      const userId = parseInt((request.params as any).id);
      
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
      const rank = parseInt((request.params as any).rank);
      const radius = parseInt((request.query as any)?.radius) || 2;
      
      if (!rank || rank < 1) {
        return reply.status(400).send({ error: 'Invalid rank' });
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
}
