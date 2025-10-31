import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Import des configurations et types
import { AVATAR_CONFIG, AvatarUploadInfo } from './avatar.config.js';

// Import des fonctions d'upload
import {
  validateFileSize,
  validateFileType,
  processImageSecurely,
  getFileExtension
} from './avatar.upload.helper.js';

// Import des fonctions de sauvegarde
import {
  extractFilenameFromUrl,
  validateAvatarOwnership,
  validateTempFileExists,
  renameTempToFinal,
  generateFinalAvatarUrl
} from './avatar.save.helper.js';

/**
 * Utilitaire pour convertir un stream en buffer
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Génère un nom de fichier sécurisé avec extension
 */
export function generateSecureFilename(userId: number, extension: string): string {
  return `temp_${userId}_${uuidv4()}.${extension}`;
}

/**
 * Sauvegarde le buffer d'image dans le système de fichiers
 */
export async function saveAvatarFile(
  userId: number,
  buffer: Buffer,
  extension: string
): Promise<string> {
  const secureFilename = generateSecureFilename(userId, extension);
  const tempPath = path.join(process.cwd(), 'public', 'avatars', secureFilename);
  
  await fs.promises.writeFile(tempPath, buffer);
  
  return `/avatars/${secureFilename}`;
}

/**
 * Crée l'objet d'information sur l'upload
 */
export function createAvatarUploadInfo(
  originalBuffer: Buffer,
  processedBuffer: Buffer,
  detectedType: FileTypeResult
): AvatarUploadInfo {
  return {
    originalType: detectedType.mime,
    originalSize: originalBuffer.length,
    processedSize: processedBuffer.length,
    format: getFileExtension(detectedType.mime).toUpperCase(),
    animated: detectedType.mime === 'image/gif'
  };
}

// ============================================================================
// ORCHESTRATEURS PRINCIPAUX
// ============================================================================

/**
 * Traite l'upload complet d'un avatar
 * Orchestre toutes les étapes de validation et traitement
 */
export async function processAvatarUpload(
  userId: number,
  fileBuffer: Buffer
): Promise<{ tempAvatarUrl: string; info: AvatarUploadInfo }> {
  // 1. Validation de la taille
  validateFileSize(fileBuffer);

  // 2. Validation du type MIME
  const detectedType = await validateFileType(fileBuffer);

  // 3. Traitement sécurisé avec Sharp
  const processedBuffer = await processImageSecurely(fileBuffer, detectedType.mime);

  // 4. Sauvegarde du fichier temporaire
  const extension = getFileExtension(detectedType.mime);
  const tempAvatarUrl = await saveAvatarFile(userId, processedBuffer, extension);

  // 5. Création des statistiques
  const info = createAvatarUploadInfo(fileBuffer, processedBuffer, detectedType);

  return { tempAvatarUrl, info };
}

/**
 * Traite la sauvegarde complète d'un avatar temporaire
 * Orchestre toutes les étapes de validation et renommage
 */
export function processAvatarSave(tempAvatarUrl: string, userId: number): string
{
  const tempFilename = extractFilenameFromUrl(tempAvatarUrl);
  
  validateAvatarOwnership(tempFilename, userId);
  
  const tempPath = validateTempFileExists(tempFilename);
  
  const { finalFilename } = renameTempToFinal(tempPath, tempFilename, userId);
  
  const finalAvatarUrl = generateFinalAvatarUrl(finalFilename);
  
  return finalAvatarUrl;
}
