import db from '../../db.js';
import { notifyProfileUpdated } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';
import { FastifyInstance } from 'fastify';

export function performAvatarReset(userId: number, fastifyInstance: FastifyInstance): string
{
  const defaultAvatarUrl = '/img/planet.gif';
  db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
    defaultAvatarUrl,
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    userId
  );
  notifyProfileUpdated(getGlobalIo(), userId, { avatar_url: defaultAvatarUrl }, fastifyInstance);
  return defaultAvatarUrl;
}
