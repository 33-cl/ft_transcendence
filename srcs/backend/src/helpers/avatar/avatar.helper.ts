import { fileTypeFromBuffer, FileTypeResult } from 'file-type';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

import { AVATAR_CONFIG, AvatarUploadInfo } from './avatar.config.js';

import {
  validateFileSize,
  validateFileType,
  processImageSecurely,
  getFileExtension
} from './avatar.upload.helper.js';

import {
  extractFilenameFromUrl,
  validateAvatarOwnership,
  validateTempFileExists,
  renameTempToFinal,
  generateFinalAvatarUrl
} from './avatar.save.helper.js';

export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer>
{
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
  {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function generateSecureFilename(userId: number, extension: string): string
{
  return `temp_${userId}_${uuidv4()}.${extension}`;
}

export async function saveAvatarFile(userId: number, buffer: Buffer, extension: string): Promise<string>
{
  const secureFilename = generateSecureFilename(userId, extension);
  const tempPath = path.join(process.cwd(), 'public', 'avatars', secureFilename);
  await fs.promises.writeFile(tempPath, buffer);
  return`/avatars/${secureFilename}`;
}

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

export async function processAvatarUpload(userId: number, fileBuffer: Buffer): Promise<{ tempAvatarUrl: string; info: AvatarUploadInfo }>
{
  validateFileSize(fileBuffer);
  const detectedType = await validateFileType(fileBuffer);
  const processedBuffer = await processImageSecurely(fileBuffer, detectedType.mime);
  const extension = getFileExtension(detectedType.mime);
  const tempAvatarUrl = await saveAvatarFile(userId, processedBuffer, extension);
  const info = createAvatarUploadInfo(fileBuffer, processedBuffer, detectedType);
  return { tempAvatarUrl, info };
}

export function processAvatarSave(tempAvatarUrl: string, userId: number): string
{
  const tempFilename = extractFilenameFromUrl(tempAvatarUrl);
  validateAvatarOwnership(tempFilename, userId);
  const tempPath = validateTempFileExists(tempFilename);
  const { finalFilename } = renameTempToFinal(tempPath, tempFilename, userId);
  const finalAvatarUrl = generateFinalAvatarUrl(finalFilename);
  return finalAvatarUrl;
}
