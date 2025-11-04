import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import db from '../../db.js';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth/session.helper.js';
import { processAvatarSave } from '../../helpers/avatar/avatar.helper.js';
import { notifyProfileUpdated } from '../../socket/notificationHandlers.js';
import { getGlobalIo } from '../../socket/socketHandlers.js';

/**
 * POST /auth/avatar/save
 * Sauvegarde définitive d'un avatar temporaire
 * - Authentification JWT requise
 * - Validation de l'ownership du fichier temporaire
 * - Renommage du fichier (temp → final)
 * - Mise à jour de la base de données
 * - Notification WebSocket aux amis
 */
export async function avatarSaveRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);

  if (!session)
    return;

  // Extraction de l'URL temporaire depuis le body
  const { temp_avatar_url } = (request.body as { temp_avatar_url?: string }) || {};
  if (!temp_avatar_url)
    return reply.code(400).send({ error: 'No temporary avatar URL provided' });

  try {
    // Traitement complet de la sauvegarde (validation + renommage)
    const finalAvatarUrl = processAvatarSave(temp_avatar_url, session.id);

    db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
      finalAvatarUrl, 
      new Date().toISOString().slice(0, 19).replace('T', ' '), 
      session.id
    );
    
    notifyProfileUpdated(getGlobalIo(), session.id, { avatar_url: finalAvatarUrl }, fastify);
    
    return reply.send({ 
      ok: true, 
      message: 'Avatar saved successfully', 
      avatar_url: finalAvatarUrl 
    });
  } catch (error: any) {
    console.error('Avatar save error:', error);
    
    if (error.message && error.message.includes('Invalid temporary avatar URL'))
      return reply.code(400).send({ error: error.message });
    if (error.message && error.message.includes('not owned by user'))// si un user tente de voler l avatar d un autre
      return reply.code(400).send({ error: error.message });
    if (error.message && error.message.includes('not found'))
      return reply.code(404).send({ error: error.message });
    
    return reply.code(500).send({ error: 'Internal server error during save' });
  }
}
