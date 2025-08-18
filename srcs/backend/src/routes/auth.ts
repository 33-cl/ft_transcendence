import { FastifyInstance } from 'fastify';
import db from '../db.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

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

function setSessionCookie(reply: any, token: string, maxAgeSec: number) {
  const expires = new Date(Date.now() + maxAgeSec * 1000);
  const cookie = [
    `sid=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
    `Expires=${expires.toUTCString()}`
  ].join('; ');
  reply.header('Set-Cookie', cookie);
}

function clearSessionCookie(reply: any) {
  const cookie = [
    'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  reply.header('Set-Cookie', cookie.join('; '));
}

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

      const created = db.prepare('SELECT id, email, username, avatar_url, created_at, updated_at FROM users WHERE id = ?').get(info.lastInsertRowid) as Omit<DbUser, 'password_hash'>;
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

  // POST /auth/login { login: string, password: string }
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

    // Créer une session 7 jours
    const token = randomBytes(32).toString('hex');
    const maxAge = 60 * 60 * 24 * 7;
    const expiresAt = fmtSqliteDate(new Date(Date.now() + maxAge * 1000));
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, user.id, expiresAt);

    setSessionCookie(reply, token, maxAge);

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url ?? null,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    return reply.send({ user: safeUser });
  });

  // GET /auth/me -> utilisateur courant via cookie sid
  fastify.get('/auth/me', async (request, reply) => {
    const cookies = parseCookies(request.headers['cookie'] as string | undefined);
    const sid = cookies['sid'];
    if (!sid) return reply.code(401).send({ error: 'No session.' });

    const row = db.prepare('SELECT s.token, s.expires_at, u.id, u.email, u.username, u.avatar_url, u.created_at, u.updated_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(sid) as SessionJoinRow | undefined;
    if (!row) return reply.code(401).send({ error: 'Invalid session.' });

    // Vérifier expiration
    const now = new Date();
    if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
      clearSessionCookie(reply);
      return reply.code(401).send({ error: 'Session expired.' });
    }

    return reply.send({ user: {
      id: row.id,
      email: row.email,
      username: row.username,
      avatar_url: row.avatar_url ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }});
  });

  // POST /auth/logout -> supprime la session
  fastify.post('/auth/logout', async (request, reply) => {
    const cookies = parseCookies(request.headers['cookie'] as string | undefined);
    const sid = cookies['sid'];
    if (sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });
}
