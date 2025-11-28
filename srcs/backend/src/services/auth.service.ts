/**
 * Service d'authentification
 * Contient toute la logique métier liée à l'authentification (création user, JWT, etc.)
 */

import db from '../db.js';
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY_DAYS = 7;

// ============================================
// Types
// ============================================

export interface UserData {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
  provider?: string;
  two_factor_enabled?: number; // 0 = disabled, 1 = enabled (SQLite boolean)
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
}

// ============================================
// Password utilities
// ============================================

/**
 * Hash un mot de passe avec scrypt
 * @param password - Le mot de passe en clair
 * @returns Le hash au format "scrypt:salt:hash"
 */
export function hashPassword(password: string): string
{
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Vérifie un mot de passe contre son hash
 * @param password - Le mot de passe en clair
 * @param stored - Le hash stocké (format "scrypt:salt:hash")
 * @returns true si le mot de passe correspond
 */
export function verifyPassword(password: string, stored: string): boolean
{
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    
    const salt = parts[1];
    const expectedHex = parts[2];
    const actualHex = scryptSync(password, salt, 64).toString('hex');
    
    const a = Buffer.from(actualHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================
// User creation
// ============================================

/**
 * Crée un utilisateur dans la base de données
 * @param input - Les données de l'utilisateur (email, username, password)
 * @returns L'utilisateur créé (sans le password_hash)
 * @throws Error si email ou username déjà utilisé
 */
export function createUser(input: CreateUserInput): UserData {
  const password_hash = hashPassword(input.password);
  
  const stmt = db.prepare(
    'INSERT INTO users (email, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)'
  );
  
  const info = stmt.run(input.email, input.username, password_hash, null);
  
  // Récupérer l'utilisateur créé
  const created = db.prepare(
    'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider, two_factor_enabled FROM users WHERE id = ?'
  ).get(info.lastInsertRowid) as UserData;
  
  return created;
}

/**
 * Récupère un utilisateur par email
 */
export function getUserByEmail(email: string): (UserData & { password_hash: string }) | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
}

/**
 * Récupère un utilisateur par username
 */
export function getUserByUsername(username: string): (UserData & { password_hash: string }) | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

/**
 * Récupère un utilisateur par ID
 */
export function getUserById(userId: number): UserData | undefined {
  return db.prepare(
    'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider, two_factor_enabled FROM users WHERE id = ?'
  ).get(userId) as UserData | undefined;
}

// ============================================
// JWT utilities
// ============================================

/**
 * Génère un JWT pour un utilisateur
 * @param user - L'utilisateur pour lequel générer le token
 * @returns Le token JWT signé
 */
export function generateJwt(user: UserData): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email
    } as JwtPayload,
    JWT_SECRET,
    { expiresIn: `${JWT_EXPIRY_DAYS}d` }
  );
}

/**
 * Vérifie et décode un JWT
 * @param token - Le token à vérifier
 * @returns Le payload décodé ou null si invalide
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Récupère la date d'expiration d'un JWT
 * @param token - Le token JWT
 * @returns La date d'expiration (timestamp Unix) ou null
 */
export function getJwtExpiry(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    return decoded?.exp || null;
  } catch {
    return null;
  }
}

/**
 * Calcule la durée de validité du JWT en secondes
 */
export function getJwtMaxAge(): number {
  return 60 * 60 * 24 * JWT_EXPIRY_DAYS; // 7 jours en secondes
}

// ============================================
// Token management (active_tokens table)
// ============================================

/**
 * Formate une date pour SQLite (YYYY-MM-DD HH:MM:SS)
 */
function formatSqliteDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Stocke un token actif pour un utilisateur
 * Supprime tous les anciens tokens de cet utilisateur avant
 * @param userId - L'ID de l'utilisateur
 * @param token - Le token JWT à stocker
 */
export function storeActiveToken(userId: number, token: string): void {
  // Invalider tous les anciens tokens de cet utilisateur
  db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(userId);
  
  // Stocker le nouveau token
  const exp = getJwtExpiry(token);
  const expiresAt = exp ? formatSqliteDate(new Date(exp * 1000)) : null;
  
  db.prepare('INSERT INTO active_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    userId,
    token,
    expiresAt
  );
}

/**
 * Vérifie si un token est actif pour un utilisateur
 * @param userId - L'ID de l'utilisateur
 * @param token - Le token à vérifier
 * @returns true si le token est actif
 */
export function isTokenActive(userId: number, token: string): boolean {
  const result = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(userId, token);
  return !!result;
}

/**
 * Supprime un token actif
 * @param token - Le token à supprimer
 */
export function removeActiveToken(token: string): void {
  db.prepare('DELETE FROM active_tokens WHERE token = ?').run(token);
}

/**
 * Supprime tous les tokens actifs d'un utilisateur
 * @param userId - L'ID de l'utilisateur
 */
export function removeAllUserTokens(userId: number): void {
  db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(userId);
}
