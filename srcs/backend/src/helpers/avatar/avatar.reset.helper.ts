import db from '../../db.js';
import { notifyProfileUpdated } from '../../socket/socketHandlers.js';

export function performAvatarReset(userId: number, fastifyInstance: any): string
{
  const defaultAvatarUrl = './img/planet.gif';
  db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
    defaultAvatarUrl,
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    userId
  );
  notifyProfileUpdated(userId, { avatar_url: defaultAvatarUrl }, fastifyInstance);
  return defaultAvatarUrl;
}
