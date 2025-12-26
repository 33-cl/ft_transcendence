import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import https from 'https';
import http from 'http';

// In-memory cache for avatars (avoids repeated requests to Google)
const avatarCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms
const MAX_CACHE_SIZE = 100; // Maximum 100 avatars in cache

// Periodically cleans the cache
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of avatarCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      avatarCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleans every 5 minutes

export default async function avatarProxyRoutes(fastify: FastifyInstance) {
  
  /**
   * Proxy for external avatars (Google, etc.)
   * Allows to:
   * - Avoid Google rate-limiting
   * - Cache images
   * - Provide a fallback if the external URL is unreachable
   */
  fastify.get('/avatar-proxy', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = request.query as { url?: string };
    
    if (!url) {
      return reply.status(400).send({ error: 'URL parameter required' });
    }

    // Validate that the URL is an allowed Google image URL
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

    // Check the cache
    const cacheKey = url;
    const cached = avatarCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      reply.header('Content-Type', cached.contentType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Browser cache 1h
      reply.header('X-Cache', 'HIT');
      return reply.send(cached.data);
    }

    // Download the image
    try {
      const imageData = await fetchImage(url);
      
      // Limit cache size
      if (avatarCache.size >= MAX_CACHE_SIZE) {
        // Remove the oldest entry
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

      // Store in cache
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
      // Return a default image or an error
      return reply.status(502).send({ error: 'Failed to fetch avatar' });
    }
  });
}

/**
 * Downloads an image from an external URL
 */
function fetchImage(url: string): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { timeout: 5000 }, (res) => {
      // Follow redirects
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
