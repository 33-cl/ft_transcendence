import { FastifyInstance, FastifyRequest } from 'fastify';
import db from '../db.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { removeUserFromActiveList } from '../socket/socketAuth.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

// Function to clean up old temporary avatar files (older than 1 hour)
function cleanupTempAvatars() {
  const avatarDir = path.join(process.cwd(), 'public', 'avatars');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  try {
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

    // Validations
    if (!email || !isValidEmail(email)) {
      return reply.code(400).send({ error: 'Invalid email.' });
    }
    if (!username || !isValidUsername(username)) {
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
      const info = stmt.run(email.trim().toLowerCase(), username.trim(), password_hash, null);

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

    if (!login || !password) return reply.code(400).send({ error: 'Missing credentials.' });

    // Récupérer l'utilisateur par email (lowercased) ou username
    const byEmail = isValidEmail(login);
    const user = (byEmail
      ? db.prepare('SELECT * FROM users WHERE email = ?').get(login.toLowerCase())
      : db.prepare('SELECT * FROM users WHERE username = ?').get(login)) as DbUser | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Invalid credentials.' });
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
      // Remove token from active_tokens
      db.prepare('DELETE FROM active_tokens WHERE token = ?').run(jwtToken);
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
    // Validation des données
    if (username !== undefined && !isValidUsername(username)) {
      return reply.code(400).send({ error: 'Invalid username (3-20, alphanumeric and underscore)' });
    }

    if (email !== undefined && !isValidEmail(email)) {
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

  // POST /auth/avatar/upload -> upload avatar temporairement (staging)
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

    // Récupérer le fichier avatar
    const avatarFile = await request.file();
    if (!avatarFile) {
      return reply.code(400).send({ error: 'No avatar file uploaded' });
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(avatarFile.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type (jpg, png, gif, webp only)' });
    }
    // Limite de taille (10MB)
    if (avatarFile.file.truncated) {
      return reply.code(400).send({ error: 'File too large (max 10MB)' });
    }
    // Générer un nom de fichier unique avec prefix "temp_"
    const ext = avatarFile.filename.split('.').pop();
    const filename = `temp_avatar_${userId}_${Date.now()}.${ext}`;
    const savePath = path.join(process.cwd(), 'public', 'avatars', filename);
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(savePath);
      avatarFile.file.pipe(writeStream);
      avatarFile.file.on('end', resolve);
      avatarFile.file.on('error', reject);
    });
    // Ne pas mettre à jour la base, juste retourner l'URL temporaire
    const tempAvatarUrl = `/avatars/${filename}`;
    return reply.send({ ok: true, message: 'Avatar uploaded, click Save to confirm', temp_avatar_url: tempAvatarUrl });
  });

  // POST /auth/avatar/save -> appliquer l'avatar temporaire
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

    // Vérifier que le fichier temporaire existe
    const tempFilename = temp_avatar_url.split('/').pop();
    if (!tempFilename || !tempFilename.startsWith('temp_')) {
      return reply.code(400).send({ error: 'Invalid temporary avatar URL' });
    }

    const tempPath = path.join(process.cwd(), 'public', 'avatars', tempFilename);
    if (!fs.existsSync(tempPath)) {
      return reply.code(400).send({ error: 'Temporary avatar file not found' });
    }

    // Renommer le fichier (enlever le prefix "temp_")
    const finalFilename = tempFilename.replace('temp_', '');
    const finalPath = path.join(process.cwd(), 'public', 'avatars', finalFilename);
    
    try {
      fs.renameSync(tempPath, finalPath);
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to save avatar' });
    }

    // Mettre à jour l'URL dans la base
    const finalAvatarUrl = `/avatars/${finalFilename}`;
    db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(finalAvatarUrl, new Date().toISOString().slice(0, 19).replace('T', ' '), userId);
    
    return reply.send({ ok: true, message: 'Avatar saved successfully', avatar_url: finalAvatarUrl });
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
