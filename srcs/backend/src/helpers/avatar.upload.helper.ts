import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import sharp from 'sharp';
import { AVATAR_CONFIG } from './avatar.config.js';

/**
 * Valide la taille du fichier
 * @throws Error si la taille dépasse la limite
 */
export function validateFileSize(buffer: Buffer): void {
  if (buffer.length > AVATAR_CONFIG.MAX_SIZE) {
    throw new Error('File too large (max 5MB)');
  }
}

/**
 * Détecte et valide le type MIME du fichier
 * @throws Error si le type ne peut pas être détecté ou n'est pas autorisé
 */
export async function validateFileType(buffer: Buffer): Promise<FileTypeResult> {
  const detectedType = await fileTypeFromBuffer(buffer);
  
  if (!detectedType)
    throw new Error('Unable to detect file type');

  if (!AVATAR_CONFIG.ALLOWED_TYPES.includes(detectedType.mime as any)) {
    throw new Error(
      `Invalid file type. Allowed: ${AVATAR_CONFIG.ALLOWED_TYPES.join(', ')}. Detected: ${detectedType.mime}`
    );
  }

  return detectedType;
}

/**
 * Traite l'image avec Sharp pour la sécuriser (réencodage)
 * @throws Error si le traitement échoue
 */
export async function processImageSecurely(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  try {
    const isAnimatedGif = mimeType === 'image/gif';
    const sharpPipeline = sharp(buffer, isAnimatedGif ? { animated: true } : {});

    switch (mimeType) {
      case 'image/gif':
        return await sharpPipeline
          .gif({ effort: AVATAR_CONFIG.GIF_EFFORT })
          .toBuffer();

      case 'image/png':
        return await sharpPipeline
          .png({ 
            quality: AVATAR_CONFIG.QUALITY,
            progressive: true
          })
          .toBuffer();

      case 'image/webp':
        return await sharpPipeline
          .webp({ quality: AVATAR_CONFIG.QUALITY })
          .toBuffer();

      default: // JPEG
        return await sharpPipeline
          .jpeg({ 
            quality: AVATAR_CONFIG.QUALITY,
            mozjpeg: true
          })
          .toBuffer();
    }
  } catch (sharpError) {
    console.error('Sharp processing error:', sharpError);
    throw new Error('Invalid or corrupted image file');
  }
}

/**
 * Détermine l'extension du fichier en fonction du type MIME
 */
export function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/gif': return 'gif';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'jpg';
  }
}
