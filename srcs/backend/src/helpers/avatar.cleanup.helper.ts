import path from 'path';
import fs from 'fs';

/**
 * Nettoie les fichiers avatars temporaires de plus d'1 heure
 * À appeler au démarrage du serveur
 */
export function cleanupTempAvatars(): void {
  const avatarDir = path.join(process.cwd(), 'public', 'avatars');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  try {
    const files = fs.readdirSync(avatarDir);
    
    files
      .filter(file => file.startsWith('temp_'))
      .forEach(file => {
        const filePath = path.join(avatarDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
