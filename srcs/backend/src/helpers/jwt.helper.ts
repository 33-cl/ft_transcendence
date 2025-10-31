import jwt from 'jsonwebtoken';

/**
 * Récupère la date d'expiration d'un token JWT
 * @param token - Token JWT
 * @returns Timestamp d'expiration ou null si invalide
 */
export function getJwtExpiry(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    return decoded?.exp ? decoded.exp : null;
  } catch {
    return null;
  }
}
