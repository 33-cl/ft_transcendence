export const AVATAR_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  QUALITY: 90,
  GIF_EFFORT: 7
} as const;

export interface AvatarUploadInfo {
  originalType: string;
  originalSize: number;
  processedSize: number;
  format: string;
  animated: boolean;
}
