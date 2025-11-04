import { FastifyInstance } from 'fastify';
import { verifyJwt } from '../../services/auth.service.js';
import { removeActiveToken } from '../../services/auth.service.js';
import { removeUserFromActiveList } from '../../socket/socketAuth.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';
import { broadcastUserStatusChange } from '../../socket/notificationHandlers.js';

export function handleLogout(jwtToken: string, fastify: FastifyInstance): void
{
  try {
    const decodedToken = verifyJwt(jwtToken);
    if (decodedToken)
    {
      removeUserFromActiveList(decodedToken.userId);
      const io = getGlobalIo();
      if (io) broadcastUserStatusChange(io, decodedToken.userId, 'offline', fastify);
    }
    removeActiveToken(jwtToken);
  } catch (err) {
    fastify.log.warn('[LOGOUT] Failed to verify JWT during logout');
    removeActiveToken(jwtToken);
  }
}
