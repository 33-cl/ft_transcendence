import path from 'path';
import fs from 'fs';

/**
 * Extrait le nom de fichier depuis l'URL temporaire
 * @throws Error si l'URL est invalide
 */
export function extractFilenameFromUrl(tempAvatarUrl: string): string {
  const filename = tempAvatarUrl.split('/').pop();
  if (!filename)
    throw new Error('Invalid temporary avatar URL');
  return filename;
}

/**
 * Vérifie que le fichier temporaire appartient bien à l'utilisateur
 * @throws Error si l'ownership est invalide
 */
export function validateAvatarOwnership(tempFilename: string, userId: number): void
{
  if (!tempFilename.startsWith(`temp_${userId}_`))
    throw new Error('Invalid temporary avatar URL or not owned by user');
}

/**
 * Vérifie que le fichier temporaire existe sur le disque
 * @throws Error si le fichier n'existe pas
 */
export function validateTempFileExists(tempFilename: string): string
{
  const tempPath = path.join(process.cwd(), 'public', 'avatars', tempFilename);
  
  if (!fs.existsSync(tempPath))
    throw new Error('Temporary avatar file not found');
  
  return tempPath;
}

/**
 * Renomme le fichier temporaire en fichier définitif
 * Enlève le préfixe "temp_userId_" du nom de fichier
 */
export function renameTempToFinal(
  tempPath: string,
  tempFilename: string,
  userId: number
): { finalPath: string; finalFilename: string }
{
  const finalFilename = tempFilename.replace(`temp_${userId}_`, '');
  const finalPath = path.join(process.cwd(), 'public', 'avatars', finalFilename);
  
  fs.renameSync(tempPath, finalPath);
  
  return { finalPath, finalFilename };
}

/**
 * Génère l'URL finale de l'avatar pour la base de données
 */
export function generateFinalAvatarUrl(finalFilename: string): string
{
  return `/avatars/${finalFilename}`;
}
