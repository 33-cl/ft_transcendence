import { FastifyRequest, FastifyReply } from 'fastify';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { authenticateAndGetSession } from '../../helpers/auth/session.helper.js';
import { streamToBuffer, processAvatarUpload } from '../../helpers/avatar/avatar.helper.js';
import { checkRateLimit, RATE_LIMITS } from '../../security.js';

/**
 * POST /auth/avatar/upload
 * Upload et traitement sécurisé d'un avatar temporaire
 * - Authentification JWT requise
 * - Rate limiting (5/min)
 * - Validation de taille et type de fichier
 * - Réencodage sécurisé de l'image
 * - Sauvegarde temporaire (préfixe temp_)
 */
export async function avatarUploadRoute(request: FastifyRequest, reply: FastifyReply)
{
  const jwtToken = getJwtFromRequest(request);
  const session = authenticateAndGetSession(jwtToken, reply);
  if (!session)
    return;

  // SECURITY: Rate limiting pour éviter le spam d'upload
  if (!checkRateLimit(`avatar_upload_${session.id}`, RATE_LIMITS.UPLOAD_AVATAR.max, RATE_LIMITS.UPLOAD_AVATAR.window)) {
    return reply.code(429).send({ error: 'Too many upload attempts. Please wait a moment.' });
  }

  try {
    //Récupération du fichier uploadé
    const avatarFile = await request.file();
    if (!avatarFile)
      return reply.code(400).send({ error: 'No avatar file uploaded' });

    const fileBuffer = await streamToBuffer(avatarFile.file);
    
    //Traitement complet de l'avatar (validation + traitement sécurisé + sauvegarde)
    const { tempAvatarUrl, info } = await processAvatarUpload(session.id, fileBuffer);

    //Réponse avec URL temporaire et informations
    return reply.send({ 
      ok: true, 
      message: 'Avatar uploaded securely and processed, click Save to confirm', 
      temp_avatar_url: tempAvatarUrl,
      info
    });
  } catch (error: any) {
    
    // Retourner l'erreur spécifique si elle provient de la validation
    if (error.message && error.message.includes('File too large'))
      return reply.code(400).send({ error: error.message });
    if (error.message && error.message.includes('Unable to detect file type'))
      return reply.code(400).send({ error: error.message });
    if (error.message && error.message.includes('Invalid file type'))
      return reply.code(400).send({ error: error.message });
    if (error.message && error.message.includes('Invalid or corrupted image'))
      return reply.code(400).send({ error: error.message });
    
    return reply.code(500).send({ error: 'Internal server error during upload' });
  }
}
