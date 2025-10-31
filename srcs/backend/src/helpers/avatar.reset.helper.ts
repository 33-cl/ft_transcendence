import db from '../db.js';
import { notifyProfileUpdated } from '../socket/socketHandlers.js';

/**
 * Effectue la réinitialisation de l'avatar en base et notifie les amis.
 * Retourne l'URL utilisée.
 * Lance une erreur si la mise à jour échoue.
 */
export function performAvatarReset(userId: number, fastifyInstance: any): string
{
  const defaultAvatarUrl = './img/planet.gif';

  db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
    defaultAvatarUrl,
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    userId
  );

  // Notifier les amis du changement d'avatar (même comportement qu'avant)
  notifyProfileUpdated(userId, { avatar_url: defaultAvatarUrl }, fastifyInstance);

  return defaultAvatarUrl;
}
