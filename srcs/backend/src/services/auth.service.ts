import db from '../db.js';
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

if (!process.env.JWT_SECRET)
  throw new Error('JWT_SECRET environment variable is not set');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY_DAYS = 7;

export interface UserData
{
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
  provider?: string;
  two_factor_enabled?: number;
}

export interface CreateUserInput
{
  email: string;
  username: string;
  password: string;
}

export interface JwtPayload
{
  userId: number;
}

// Hash password with scrypt
export function hashPassword(password: string): string
{
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

// Verify password against hash
export function verifyPassword(password: string, stored: string): boolean
{
  try
  {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt')
      return false;
    
    const salt = parts[1];
    const expectedHex = parts[2];
    const actualHex = scryptSync(password, salt, 64).toString('hex');
    
    const a = Buffer.from(actualHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    
    if (a.length !== b.length)
      return false;
    
    return timingSafeEqual(a, b);
  }
  catch
  {
    return false;
  }
}

// Create user in database
export function createUser(input: CreateUserInput): UserData
{
  const password_hash = hashPassword(input.password);
  
  const stmt = db.prepare(
    'INSERT INTO users (email, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)'
  );
  
  const info = stmt.run(input.email, input.username, password_hash, null);
  
  const created = db.prepare(
    'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider, two_factor_enabled FROM users WHERE id = ?'
  ).get(info.lastInsertRowid) as UserData;
  
  return created;
}

export function getUserByEmail(email: string): (UserData & { password_hash: string }) | undefined
{
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
}

export function getUserByUsername(username: string): (UserData & { password_hash: string }) | undefined
{
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

export function getUserById(userId: number): UserData | undefined
{
  return db.prepare(
    'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider, two_factor_enabled FROM users WHERE id = ?'
  ).get(userId) as UserData | undefined;
}

export function generateJwt(user: UserData): string
{
  return jwt.sign(
    {
      userId: user.id
    } as JwtPayload,
    JWT_SECRET,
    { expiresIn: `${JWT_EXPIRY_DAYS}d` }
  );
}

export function verifyJwt(token: string): JwtPayload | null
{
  try
  {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  }
  catch
  {
    return null;
  }
}

export function getJwtExpiry(token: string): number | null
{
  try
  {
    const decoded = jwt.decode(token) as { exp?: number };
    return decoded?.exp || null;
  }
  catch
  {
    return null;
  }
}

export function getJwtMaxAge(): number
{
  return 60 * 60 * 24 * JWT_EXPIRY_DAYS;
}

// Format date for SQLite (YYYY-MM-DD HH:MM:SS)
function formatSqliteDate(date: Date): string
{
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

//removes old tokens first
export function storeActiveToken(userId: number, token: string): void
{
  db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(userId);
  
  const exp = getJwtExpiry(token);
  const expiresAt = exp ? formatSqliteDate(new Date(exp * 1000)) : null;
  
  db.prepare('INSERT INTO active_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    userId,
    token,
    expiresAt
  );
}

export function isTokenActive(userId: number, token: string): boolean
{
  const result = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(userId, token);
  return !!result;
}

export function removeActiveToken(token: string): void
{
  db.prepare('DELETE FROM active_tokens WHERE token = ?').run(token);
}

// Remove all tokens for user
export function removeAllUserTokens(userId: number): void
{
  db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(userId);
}
