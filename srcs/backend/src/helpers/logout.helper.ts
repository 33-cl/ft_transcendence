import { FastifyInstance } from 'fastify';
import { verifyJwt } from '../services/auth.service.js';
import { removeActiveToken } from '../services/auth.service.js';
import { removeUserFromActiveList } from '../socket/socketAuth.js';
import { getGlobalIo, broadcastUserStatusChange } from '../socket/socketHandlers.js';

/**
 * Gère la déconnexion d'un utilisateur
 * - Vérifie et décode le JWT
 * - Marque l'utilisateur comme offline (activeUsers)
 * - Notifie les amis via WebSocket
 * - Supprime le token de active_tokens
 * 
 * @param jwtToken - Le token JWT à révoquer
 * @param fastify - Instance Fastify pour les logs et notifications
 */
export function handleLogout(jwtToken: string, fastify: FastifyInstance): void {
  try {
    // Vérifier et décoder le JWT pour obtenir le userId
    const decodedToken = verifyJwt(jwtToken);
    
    if (decodedToken)
    {
      // Marquer l'utilisateur comme offline
      removeUserFromActiveList(decodedToken.userId);
      
      // Notifier les amis via WebSocket
      const io = getGlobalIo();
      if (io)
        broadcastUserStatusChange(decodedToken.userId, 'offline', io, fastify);
    }
    
    // Supprimer le token de active_tokens (même si JWT invalide)
    removeActiveToken(jwtToken);
    
  } catch (err) {
    // En cas d'erreur, supprimer quand même le token
    fastify.log.warn('[LOGOUT] Failed to verify JWT during logout');
    removeActiveToken(jwtToken);
  }
}
