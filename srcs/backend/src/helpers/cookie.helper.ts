/**
 * Parse les cookies depuis un header HTTP
 * @param header - Header Cookie brut
 * @returns Objet clé-valeur des cookies
 */
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(v.join('='));
  });
  
  return out;
}

/**
 * Extrait le JWT depuis les cookies d'une requête
 * @param request - Requête Fastify
 * @returns Token JWT ou undefined
 */
export function getJwtFromRequest(request: any): string | undefined {
  const cookies = parseCookies(request.headers['cookie'] as string | undefined);
  return cookies['jwt'];
}
