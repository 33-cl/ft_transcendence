import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import https from 'https';
import http from 'http';

// Cache en mémoire pour les avatars (évite les requêtes répétées à Google)
const avatarCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure en ms
const MAX_CACHE_SIZE = 100; // Maximum 100 avatars en cache

// Nettoie le cache périodiquement
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of avatarCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      avatarCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Nettoie toutes les 5 minutes

export default async function avatarProxyRoutes(fastify: FastifyInstance) {
  
  /**
   * Proxy pour les avatars externes (Google, etc.)
   * Permet de :
   * - Éviter le rate-limiting de Google
   * - Mettre en cache les images
   * - Avoir un fallback si l'URL externe est inaccessible
   */
  fastify.get('/avatar-proxy', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = request.query as { url?: string };
    
    if (!url) {
      return reply.status(400).send({ error: 'URL parameter required' });
    }

    // Valider que l'URL est une URL d'image Google autorisée
    const allowedDomains = [
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      'googleusercontent.com'
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' });
    }

    const isAllowed = allowedDomains.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return reply.status(403).send({ error: 'Domain not allowed' });
    }

    // Vérifier le cache
    const cacheKey = url;
    const cached = avatarCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      reply.header('Content-Type', cached.contentType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache navigateur 1h
      reply.header('X-Cache', 'HIT');
      return reply.send(cached.data);
    }

    // Télécharger l'image
    try {
      const imageData = await fetchImage(url);
      
      // Limiter la taille du cache
      if (avatarCache.size >= MAX_CACHE_SIZE) {
        // Supprimer l'entrée la plus ancienne
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, value] of avatarCache.entries()) {
          if (value.timestamp < oldestTime) {
            oldestTime = value.timestamp;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          avatarCache.delete(oldestKey);
        }
      }

      // Mettre en cache
      avatarCache.set(cacheKey, {
        data: imageData.data,
        contentType: imageData.contentType,
        timestamp: Date.now()
      });

      reply.header('Content-Type', imageData.contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      reply.header('X-Cache', 'MISS');
      return reply.send(imageData.data);

    } catch (error) {
      console.error('Failed to fetch avatar:', error);
      // Retourner une image par défaut ou une erreur
      return reply.status(502).send({ error: 'Failed to fetch avatar' });
    }
  });
}

/**
 * Télécharge une image depuis une URL externe
 */
function fetchImage(url: string): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { timeout: 5000 }, (res) => {
      // Suivre les redirections
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchImage(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'image/jpeg'
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
