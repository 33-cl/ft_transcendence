import { FastifyInstance, FastifyRequest } from 'fastify';
import db from '../db.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { removeUserFromActiveList, isUserAlreadyConnected } from '../socket/socketAuth.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileTypeFromBuffer } from 'file-type';//detecte le vrai type d un fichier en analisant ses octets
import sharp from 'sharp';//lib de traitement d img securise (resize, reencode, strip metadata))
import { v4 as uuidv4 } from 'uuid';//genere des id unique pour les noms de fichier securises
import { pipeline } from 'stream/promises';
import { sanitizeUsername, sanitizeEmail, validateLength, checkRateLimit } from '../security.js';

// Utilitaire pour convertir un stream en buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Function to clean up old temporary avatar files (older than 1 hour)
function cleanupTempAvatars() {
  const avatarDir = path.join(process.cwd(), 'public', 'avatars');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  try {
    // Nettoyer les fichiers temporaires sur le disque
    const files = fs.readdirSync(avatarDir);
    files.filter(file => file.startsWith('temp_')).forEach(file => {
      const filePath = path.join(avatarDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime.getTime() < oneHourAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleaned up old temp avatar: ${file}`);
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Cleanup only at server startup
cleanupTempAvatars();

// Extend FastifyRequest to include user property and cookies
declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: number };
    cookies: { [key: string]: string };
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

interface RegisterBody {
  email?: string;
  username?: string;
  password?: string;
}

interface DbUser {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

interface SessionJoinRow {
  token: string;
  expires_at: string | null;
  id: number; // user id
  email: string;
  username: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

function isValidEmail(email: string): boolean {
  // Validation simple et robuste
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string): boolean {
  // 3-20 chars, lettres/chiffres/underscore uniquement
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function isValidPassword(password: string): boolean {
  // Longueur minimale 8
  return typeof password === 'string' && password.length >= 8;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  // return sous format: algo:salt:hash
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  // stored format: scrypt:salt:hash
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const expectedHex = parts[2];
	//on rehash avec le meme salt donc on compare les 2 meme choses
    const actualHex = scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(actualHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length)
		return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function fmtSqliteDate(d: Date): string {
  // YYYY-MM-DD HH:MM:SS (UTC)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// function setSessionCookie(reply: any, token: string, maxAgeSec: number) {
//   const expires = new Date(Date.now() + maxAgeSec * 1000);
//   const cookie = [
//     `sid=${token}`,
//     'Path=/',
//     'HttpOnly',
//     'Secure',
//     'SameSite=Lax',
//     `Max-Age=${maxAgeSec}`,
//     `Expires=${expires.toUTCString()}`
//   ].join('; ');
  
//   // Pour permettre plusieurs sessions simultanées, on peut utiliser un approach plus flexible
//   // En utilisant des cookies avec des noms uniques par session
//   reply.header('Set-Cookie', cookie);
// }

// function clearSessionCookie(reply: any) {
//   const cookie = 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
//   reply.header('Set-Cookie', cookie);
// }

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export default async function authRoutes(fastify: FastifyInstance) {

  // Helper to get JWT from cookies
  function getJwtFromRequest(request: any): string | undefined {
    const cookies = parseCookies(request.headers['cookie'] as string | undefined);
    return cookies['jwt'];
  }

  // Helper to get JWT expiry
  function getJwtExpiry(token: string): number | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      return decoded?.exp ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  fastify.post('/auth/register', async (request, reply) => {
    const { email, username, password } = (request.body as RegisterBody) || {};

    // SECURITY: Validate input lengths to prevent DoS
    if (!validateLength(email || '', 1, 255) || 
        !validateLength(username || '', 1, 50) || 
        !validateLength(password || '', 1, 255)) {
      return reply.code(400).send({ error: 'Input length validation failed.' });
    }

    // SECURITY: Sanitize inputs to prevent XSS
    const sanitizedEmail = sanitizeEmail(email || '');
    const sanitizedUsername = sanitizeUsername(username || '');

    // Validations
    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
      return reply.code(400).send({ error: 'Invalid email.' });
    }
    if (!sanitizedUsername || !isValidUsername(sanitizedUsername)) {
      return reply.code(400).send({ error: 'Invalid username (3-20, alphanumeric and underscore).' });
    }
    if (!password || !isValidPassword(password)) {
      return reply.code(400).send({ error: 'Password too short (min 8 characters).' });
    }

    try {
      const password_hash = hashPassword(password);
      const stmt = db.prepare(
        'INSERT INTO users (email, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)' 
      );
      const info = stmt.run(sanitizedEmail, sanitizedUsername, password_hash, null);

      const created = db.prepare('SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at FROM users WHERE id = ?').get(info.lastInsertRowid) as Omit<DbUser, 'password_hash'>;

      // Générer le JWT
      const maxAge = 60 * 60 * 24 * 7; // 7 jours
      const jwtToken = jwt.sign(
        { userId: created.id, username: created.username, email: created.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      // Invalidate previous tokens for user
      db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(created.id);
      // Store new token
      const exp = getJwtExpiry(jwtToken);
      db.prepare('INSERT INTO active_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
        created.id,
        jwtToken,
        exp ? fmtSqliteDate(new Date(exp * 1000)) : null
      );
      reply.setCookie('jwt', jwtToken, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'strict',
        maxAge: maxAge
      });

      return reply.code(201).send({ user: created });
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      if (msg.includes('UNIQUE') && msg.includes('users.email')) {
        return reply.code(409).send({ error: 'Email already in use.' });
      }
      if (msg.includes('UNIQUE') && msg.includes('users.username')) {
        return reply.code(409).send({ error: 'Username already taken.' });
      }
      request.log.error(e);
      return reply.code(500).send({ error: 'Server error.' });
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = (request.body as any) || {};
    const login: string = (body.login ?? body.username ?? body.email ?? '').toString().trim();
    const password: string = (body.password ?? '').toString();

    // SECURITY: Rate limiting to prevent brute force attacks
    const clientIp = request.ip;
    if (!checkRateLimit(`login:${clientIp}`, 5, 60 * 1000)) {
      return reply.code(429).send({ error: 'Too many login attempts. Please try again later.' });
    }

    // SECURITY: Validate input lengths
    if (!validateLength(login, 1, 255) || !validateLength(password, 1, 255)) {
      return reply.code(400).send({ error: 'Input length validation failed.' });
    }

    if (!login || !password) return reply.code(400).send({ error: 'Missing credentials.' });

    // SECURITY: Sanitize login input
    const sanitizedLogin = login.toLowerCase().replace(/<[^>]*>/g, '');

    // Récupérer l'utilisateur par email (lowercased) ou username
    const byEmail = isValidEmail(sanitizedLogin);
    const user = (byEmail
      ? db.prepare('SELECT * FROM users WHERE email = ?').get(sanitizedLogin)
      : db.prepare('SELECT * FROM users WHERE username = ?').get(sanitizedLogin)) as DbUser | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Invalid credentials.' });
    }

    // Vérifier si l'utilisateur est déjà connecté
    if (isUserAlreadyConnected(user.id)) {
      fastify.log.warn(`User ${user.username} (${user.id}) attempted to login but is already connected`);
      return reply.code(403).send({ 
        error: 'This account is already connected elsewhere.',
        code: 'USER_ALREADY_CONNECTED'
      });
    }

    // Générer le JWT
    const maxAge = 60 * 60 * 24 * 7;
    const jwtToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Invalidate previous tokens for user
    db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(user.id);
    // Store new token
    const exp = getJwtExpiry(jwtToken);
    db.prepare('INSERT INTO active_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      jwtToken,
      exp ? fmtSqliteDate(new Date(exp * 1000)) : null
    );
    reply.setCookie('jwt', jwtToken, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'strict',
      maxAge: maxAge
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url ?? null,
      wins: user.wins,
      losses: user.losses,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    return reply.send({ user: safeUser });
  });

  // GET /auth/me -> utilisateur courant via cookie sid ou JWT
  fastify.get('/auth/me', async (request, reply) => {
    const jwtToken = getJwtFromRequest(request);
    if (!jwtToken) return reply.code(401).send({ error: 'No JWT.' });
    try {
      const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number; username: string; email: string };
      // Check token presence in active_tokens
      const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
      if (!active) return reply.code(401).send({ error: 'Session expired or logged out.' });
      const user = db.prepare('SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at FROM users WHERE id = ?').get(payload.userId);
      if (!user) return reply.code(401).send({ error: 'Utilisateur non trouvé.' });
      return reply.send({ user });
    } catch (err) {
      return reply.code(401).send({ error: 'JWT invalide ou expiré.' });
    }
  });

  // POST /auth/logout -> supprime la session/JWT
  fastify.post('/auth/logout', async (request, reply) => {
    const jwtToken = getJwtFromRequest(request);
    if (jwtToken) {
      try {
        // Get user ID before deleting token
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const userId = payload.userId;
        
        // Remove user from active list to mark as offline
        removeUserFromActiveList(userId);
        console.log(`[LOGOUT] User ${userId} marked as offline`);
        
        // Remove token from active_tokens
        db.prepare('DELETE FROM active_tokens WHERE token = ?').run(jwtToken);
      } catch (err) {
        console.warn('[LOGOUT] Failed to verify JWT during logout:', err);
        // Still remove token even if JWT verification fails
        db.prepare('DELETE FROM active_tokens WHERE token = ?').run(jwtToken);
      }
    }
    reply.setCookie('jwt', '', {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'strict',
      maxAge: 0
    });
    return reply.send({ ok: true });
  });

  // Endpoint pour mettre à jour le profil utilisateur
  fastify.put('/auth/profile', async (request, reply) => {
    const jwtToken = getJwtFromRequest(request);
    let userId: number | undefined;
    if (jwtToken) {
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        // Check token presence in active_tokens
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (!active) return reply.code(401).send({ error: 'Session expired or logged out' });
        userId = payload.userId;
      } catch (err) {
        return reply.code(401).send({ error: 'JWT invalide ou expiré' });
      }
    }
    // Si pas de JWT, refuse
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }
    // Récupérer l'utilisateur
    const sessionRow = db.prepare(`
      SELECT id, email, username FROM users WHERE id = ?
    `).get(userId) as { id: number; email: string; username: string } | undefined;
    if (!sessionRow) {
      return reply.code(401).send({ error: 'Invalid or expired session/JWT' });
    }
    const { username, email, currentPassword, newPassword } = (request.body as {
      username?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    }) || {};
    
    // SECURITY: Validate input lengths
    if (username && !validateLength(username, 1, 50)) {
      return reply.code(400).send({ error: 'Username length invalid' });
    }
    if (email && !validateLength(email, 1, 255)) {
      return reply.code(400).send({ error: 'Email length invalid' });
    }
    if (currentPassword && !validateLength(currentPassword, 1, 255)) {
      return reply.code(400).send({ error: 'Password length invalid' });
    }
    if (newPassword && !validateLength(newPassword, 1, 255)) {
      return reply.code(400).send({ error: 'Password length invalid' });
    }
    
    // SECURITY: Sanitize inputs
    const sanitizedUsername = username ? sanitizeUsername(username) : undefined;
    const sanitizedEmail = email ? sanitizeEmail(email) : undefined;
    
    // Validation des données
    if (sanitizedUsername !== undefined && !isValidUsername(sanitizedUsername)) {
      return reply.code(400).send({ error: 'Invalid username (3-20, alphanumeric and underscore)' });
    }

    if (sanitizedEmail !== undefined && !isValidEmail(sanitizedEmail)) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    if (newPassword !== undefined && !isValidPassword(newPassword)) {
      return reply.code(400).send({ error: 'New password too short (min 8 characters)' });
    }

    try {
      // Si on veut changer le mot de passe, vérifier l'ancien
      if (newPassword && currentPassword) {
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(sessionRow.id) as { password_hash: string } | undefined;
        
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }

        if (!verifyPassword(currentPassword, user.password_hash)) {
          return reply.code(400).send({ error: 'Current password is incorrect' });
        }
      } 
      // else if (newPassword && !currentPassword) {
      //   return reply.code(400).send({ error: 'Current password is required to change password' });
      // }

      // Vérifier l'unicité de l'email si changé
      if (email && email !== sessionRow.email) {
        const existingEmailUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, sessionRow.id);
        if (existingEmailUser) {
          return reply.code(409).send({ error: 'Email already taken' });
        }
      }

      // Vérifier l'unicité du username si changé
      if (username && username !== sessionRow.username) {
        const existingUsernameUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, sessionRow.id);
        if (existingUsernameUser) {
          return reply.code(409).send({ error: 'Username already taken' });
        }
      }

      // Construire la requête de mise à jour dynamiquement
      const updates: string[] = [];
      const values: any[] = [];

      if (username) {
        updates.push('username = ?');
        values.push(username);
      }

      if (email) {
        updates.push('email = ?');
        values.push(email);
      }

      if (newPassword) {
        const passwordHash = hashPassword(newPassword);
        updates.push('password_hash = ?');
        values.push(passwordHash);
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));

      if (updates.length === 1) { // Seulement updated_at
        return reply.code(400).send({ error: 'No changes provided' });
      }

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      values.push(sessionRow.id); // Add user_id at the end for WHERE clause
      
      console.log('Profile update query:', query);
      console.log('Profile update values:', values);
      
      db.prepare(query).run(...values);

      return reply.send({ 
        ok: true, 
        message: 'Profile updated successfully',
        updated: {
          username: username || sessionRow.username,
          email: email || sessionRow.email,
          passwordChanged: !!newPassword
        }
      });

    } catch (error) {
      console.error('Profile update error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /auth/avatar/upload -> upload avatar sécurisé avec validation
  fastify.post('/auth/avatar/upload', async (request, reply) => {
    const jwtToken = getJwtFromRequest(request);
    let userId: number | undefined;
    if (jwtToken) {
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (!active) return reply.code(401).send({ error: 'Session expired or logged out' });
        userId = payload.userId;
      } catch (err) {
        return reply.code(401).send({ error: 'JWT invalide ou expiré' });
      }
    }
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    try {
      // Récupérer le fichier avatar
      const avatarFile = await request.file();
      if (!avatarFile) {
        return reply.code(400).send({ error: 'No avatar file uploaded' });
      }

      // Convertir le stream en buffer pour analyse
      const fileBuffer = await streamToBuffer(avatarFile.file);
      
      // Vérifications de sécurité
      
      // 1. Taille maximum (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (fileBuffer.length > maxSize) {
        return reply.code(400).send({ error: 'File too large (max 5MB)' });
      }

      // 2. Détection du type réel du fichier (pas le mimetype client)
      const detectedType = await fileTypeFromBuffer(fileBuffer);
      if (!detectedType) {
        return reply.code(400).send({ error: 'Unable to detect file type' });
      }

      // 3. Types autorisés 
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(detectedType.mime)) {
        return reply.code(400).send({ 
          error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}. Detected: ${detectedType.mime}` 
        });
      }

      // 4. Traitement sécurisé avec Sharp (decode + reencode seulement, pas de resize)
      let processedBuffer: Buffer;
      try {
        // Créer un pipeline Sharp de base - seulement pour re-encoder (sécurité)
        const sharpPipeline = sharp(fileBuffer, detectedType.mime === 'image/gif' ? { animated: true } : {});
        
        if (detectedType.mime === 'image/gif') {
          // Pour les GIFs: réencoder avec animation préservée
          processedBuffer = await sharpPipeline
            .gif({
              effort: 7 // Compression optimale
            })
            .toBuffer();
        } else if (detectedType.mime === 'image/png') {
          // Pour PNG: réencoder en PNG (préserve transparence)
          processedBuffer = await sharpPipeline
            .png({ 
              quality: 90,
              progressive: true
            })
            .toBuffer();
        } else if (detectedType.mime === 'image/webp') {
          // Pour WebP: réencoder en WebP
          processedBuffer = await sharpPipeline
            .webp({ 
              quality: 90
            })
            .toBuffer();
        } else {
          // Pour JPEG: réencoder en JPEG
          processedBuffer = await sharpPipeline
            .jpeg({ 
              quality: 90,
              mozjpeg: true
            })
            .toBuffer();
        }
      } catch (sharpError) {
        console.error('Sharp processing error:', sharpError);
        return reply.code(400).send({ error: 'Invalid or corrupted image file' });
      }

      // 5. Génération nom de fichier sécurisé avec extension correcte
      const extension = detectedType.mime === 'image/gif' ? 'gif' : 
                       detectedType.mime === 'image/png' ? 'png' :
                       detectedType.mime === 'image/webp' ? 'webp' : 'jpg';
      const secureFilename = `temp_${userId}_${uuidv4()}.${extension}`;
      const tempPath = path.join(process.cwd(), 'public', 'avatars', secureFilename);

      // 6. Sauvegarder le fichier traité
      await fs.promises.writeFile(tempPath, processedBuffer);

      // 7. Réponse avec URL temporaire
      const tempAvatarUrl = `/avatars/${secureFilename}`;
      
      console.log(`✅ Avatar uploaded securely for user ${userId}: ${secureFilename} (${detectedType.mime} -> ${extension.toUpperCase()}, ${fileBuffer.length} -> ${processedBuffer.length} bytes)`);
      
      return reply.send({ 
        ok: true, 
        message: 'Avatar uploaded securely and processed, click Save to confirm', 
        temp_avatar_url: tempAvatarUrl,
        info: {
          originalType: detectedType.mime,
          originalSize: fileBuffer.length,
          processedSize: processedBuffer.length,
          format: extension.toUpperCase(),
          animated: detectedType.mime === 'image/gif'
        }
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      return reply.code(500).send({ error: 'Internal server error during upload' });
    }
  });

  // POST /auth/avatar/save -> appliquer l'avatar temporaire sécurisé
  fastify.post('/auth/avatar/save', async (request, reply) => {
    const jwtToken = getJwtFromRequest(request);
    let userId: number | undefined;
    if (jwtToken) {
      try {
        const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
        const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
        if (!active) return reply.code(401).send({ error: 'Session expired or logged out' });
        userId = payload.userId;
      } catch (err) {
        return reply.code(401).send({ error: 'JWT invalide ou expiré' });
      }
    }
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { temp_avatar_url } = (request.body as { temp_avatar_url?: string }) || {};
    if (!temp_avatar_url) {
      return reply.code(400).send({ error: 'No temporary avatar URL provided' });
    }

    try {
      // Extraire le nom de fichier temporaire et vérifier ownership
      const tempFilename = temp_avatar_url.split('/').pop();
      if (!tempFilename || !tempFilename.startsWith(`temp_${userId}_`)) {
        return reply.code(400).send({ error: 'Invalid temporary avatar URL or not owned by user' });
      }

      // Vérifier que le fichier temp existe
      const tempPath = path.join(process.cwd(), 'public', 'avatars', tempFilename);
      if (!fs.existsSync(tempPath)) {
        return reply.code(404).send({ error: 'Temporary avatar file not found' });
      }

      // Renommer le fichier (enlever le prefix "temp_userId_")
      const finalFilename = tempFilename.replace(`temp_${userId}_`, '');
      const finalPath = path.join(process.cwd(), 'public', 'avatars', finalFilename);
      
      fs.renameSync(tempPath, finalPath);

      // Mettre à jour l'URL dans la base
      const finalAvatarUrl = `/avatars/${finalFilename}`;
      db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
        finalAvatarUrl, 
        new Date().toISOString().slice(0, 19).replace('T', ' '), 
        userId
      );
      
      console.log(`✅ Avatar saved for user ${userId}: ${finalFilename}`);
      
      return reply.send({ 
        ok: true, 
        message: 'Avatar saved successfully', 
        avatar_url: finalAvatarUrl 
      });
    } catch (error) {
      console.error('Avatar save error:', error);
      return reply.code(500).send({ error: 'Internal server error during save' });
    }
  });

  // POST /auth/avatar/reset -> réinitialiser l'avatar à la valeur par défaut
  fastify.post('/auth/avatar/reset', async (request, reply) => {
    // Vérification JWT comme les autres routes
    const jwtToken = request.cookies.jwt;
    let userId: number | undefined;
    
    try {
      const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
      const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
      if (active) {
        userId = payload.userId;
      }
    } catch (error) {
      // Invalid token
    }

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Récupérer l'ancienne URL de l'avatar
      const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId) as { avatar_url: string | null };
      
      // Mettre à jour l'URL de l'avatar dans la base de données avec l'avatar par défaut
      const defaultAvatarUrl = '/img/default-pp.jpg';
      db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
        defaultAvatarUrl, 
        new Date().toISOString().slice(0, 19).replace('T', ' '), 
        userId
      );

      return reply.send({ 
        message: 'Avatar reset successfully',
        avatar_url: defaultAvatarUrl
      });
    } catch (error) {
      console.error('Error resetting avatar:', error);
      return reply.code(500).send({ error: 'Failed to reset avatar' });
    }
  });
}
