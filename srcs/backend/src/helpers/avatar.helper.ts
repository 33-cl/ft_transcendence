import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

/**
 * Configuration pour l'upload d'avatar
 */
const AVATAR_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  QUALITY: 90,
  GIF_EFFORT: 7
} as const;

/**
 * Résultat du traitement d'image
 */
export interface ProcessedImageResult {
  buffer: Buffer;
  extension: string;
  detectedType: string;
}

/**
 * Information sur l'avatar uploadé
 */
export interface AvatarUploadInfo {
  originalType: string;
  originalSize: number;
  processedSize: number;
  format: string;
  animated: boolean;
}

/**
 * Utilitaire pour convertir un stream en buffer
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream){
    chunks.push(Buffer.from(chunk));// convertit chaque morceau en Buffer et l'ajoute au tableau
  }
  return Buffer.concat(chunks);
}

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
export async function validateFileType(buffer: Buffer): Promise<FileTypeResult>
{
  const detectedType = await fileTypeFromBuffer(buffer);
  
  if (!detectedType)
    throw new Error('Unable to detect file type');

  if (!AVATAR_CONFIG.ALLOWED_TYPES.includes(detectedType.mime as any)){
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
): Promise<Buffer>
{
  try {
    const isAnimatedGif = mimeType === 'image/gif';
    const sharpPipeline = sharp(buffer, isAnimatedGif ? { animated: true } : {});

    switch (mimeType)
    {
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

/*
 Génère un nom de fichier sécurisé avec extension
 */
export function generateSecureFilename(userId: number, extension: string): string {
  return `temp_${userId}_${uuidv4()}.${extension}`;
}

/*
  Sauvegarde le buffer d'image dans le système de fichiers
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

/*
  Crée l'objet d'information sur l'upload
 */
export function createAvatarUploadInfo(originalBuffer: Buffer, processedBuffer: Buffer, detectedType: FileTypeResult): AvatarUploadInfo
{
  return {
    originalType: detectedType.mime,
    originalSize: originalBuffer.length,
    processedSize: processedBuffer.length,
    format: getFileExtension(detectedType.mime).toUpperCase(),
    animated: detectedType.mime === 'image/gif'
  };
}

/*
  Traite l'upload complet d'un avatar
  Orchestre toutes les étapes de validation et traitement
 */
export async function processAvatarUpload(
  userId: number,
  fileBuffer: Buffer
): Promise<{ tempAvatarUrl: string; info: AvatarUploadInfo }>
{
  validateFileSize(fileBuffer);

  const detectedType = await validateFileType(fileBuffer);

  const processedBuffer = await processImageSecurely(fileBuffer, detectedType.mime);

  const extension = getFileExtension(detectedType.mime);
  const tempAvatarUrl = await saveAvatarFile(userId, processedBuffer, extension);

  const info = createAvatarUploadInfo(fileBuffer, processedBuffer, detectedType);

  return { tempAvatarUrl, info };
}
