import { FastifyInstance } from 'fastify';
import friendsRoutes from './friends.routes.js';
import friendRequestsRoutes from './friendRequests.routes.js';
import searchRoutes from './search.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import statusRoutes from './status.routes.js';

/**
 * Point d'entrée pour toutes les routes /users/*
 * Découpage modulaire pour une meilleure lisibilité et maintenance
 */
export default async function usersRoutes(fastify: FastifyInstance) {
  // Routes de gestion des amis (GET /users, POST/DELETE /users/:id/friend)
  await fastify.register(friendsRoutes);
  
  // Routes de demandes d'amis (friend-requests/*)
  await fastify.register(friendRequestsRoutes);
  
  // Route de recherche d'utilisateurs
  await fastify.register(searchRoutes);
  
  // Routes du leaderboard et classement
  await fastify.register(leaderboardRoutes);
  
  // Route de statut en ligne des amis
  await fastify.register(statusRoutes);
}
