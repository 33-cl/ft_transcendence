import { FastifyInstance } from 'fastify';
import { verifyJwt } from '../../services/auth.service.js';
import { removeActiveToken } from '../../services/auth.service.js';
import { removeUserFromActiveList } from '../../socket/socketAuth.js';
import { getGlobalIo, broadcastUserStatusChange } from '../../socket/socketHandlers.js';

export function handleLogout(jwtToken: string, fastify: FastifyInstance): void
{
  try {
    const decodedToken = verifyJwt(jwtToken);
    if (decodedToken)
    {
      removeUserFromActiveList(decodedToken.userId);
      const io = getGlobalIo();
      if (io) broadcastUserStatusChange(decodedToken.userId, 'offline', io, fastify);
    }
    removeActiveToken(jwtToken);
  } catch (err) {
    fastify.log.warn('[LOGOUT] Failed to verify JWT during logout');
    removeActiveToken(jwtToken);
  }
}
