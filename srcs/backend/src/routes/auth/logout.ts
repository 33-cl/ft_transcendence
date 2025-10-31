import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getJwtFromRequest } from '../../helpers/cookie.helper.js';
import { handleLogout } from '../../helpers/auth.helper.js';

/**
 * POST /auth/logout
 * Déconnexion d'un utilisateur
 * 
 * Flux :
 * 1. Extraction du JWT depuis les cookies
 * 2. Traitement de la déconnexion (révocation token, notification amis)
 * 3. Suppression du cookie JWT
 * 4. Réponse de confirmation
 */
export async function logoutRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  
  if (jwtToken)
    handleLogout(jwtToken, fastify);
  
  reply.setCookie('jwt', '', {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: 0
  });
  
  return reply.send({ ok: true });
}
