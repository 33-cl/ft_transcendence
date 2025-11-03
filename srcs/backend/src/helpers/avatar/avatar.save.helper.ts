import path from 'path';
import fs from 'fs';

export function extractFilenameFromUrl(tempAvatarUrl: string): string
{
  const filename = tempAvatarUrl.split('/').pop();
  if (!filename)
    throw new Error('Invalid temporary avatar URL');
  return filename;
}

export function validateAvatarOwnership(tempFilename: string, userId: number): void
{
  if (!tempFilename.startsWith(`temp_${userId}_`)) throw new Error('Invalid temporary avatar URL or not owned by user');
}

export function validateTempFileExists(tempFilename: string): string
{
  const tempPath = path.join(process.cwd(), 'public', 'avatars', tempFilename);
  if (!fs.existsSync(tempPath))
    throw new Error('Temporary avatar file not found');
  return tempPath;
}

export function renameTempToFinal(tempPath: string, tempFilename: string, userId: number): { finalPath: string; finalFilename: string }
{
  const finalFilename = tempFilename.replace(`temp_${userId}_`, '');
  const finalPath = path.join(process.cwd(), 'public', 'avatars', finalFilename);
  fs.renameSync(tempPath, finalPath);
  return { finalPath, finalFilename };
}

export function generateFinalAvatarUrl(finalFilename: string): string
{
  return `/avatars/${finalFilename}`;
}
