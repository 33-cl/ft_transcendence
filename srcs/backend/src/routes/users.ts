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
