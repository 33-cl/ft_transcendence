import { FastifyInstance } from 'fastify';
import friendsRoutes from './friends.routes.js';
import friendRequestsRoutes from './friendRequests.routes.js';
import searchRoutes from './search.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import statusRoutes from './status.routes.js';

// Main entry point for all /users/* routes
export default async function usersRoutes(fastify: FastifyInstance) {
  // Friend management routes
  await fastify.register(friendsRoutes);
  
  // Friend requests routes
  await fastify.register(friendRequestsRoutes);
  
  // User search route
  await fastify.register(searchRoutes);
  
  // Leaderboard routes
  await fastify.register(leaderboardRoutes);
  
  // Friend online status route
  await fastify.register(statusRoutes);
}
