/**
 * POST /auth/2fa/verify-oauth
 * Vérifie le code 2FA après une authentification Google OAuth
 * 
 * Cette route est nécessaire car les utilisateurs avec 2FA activée
 * doivent aussi vérifier leur code même après Google OAuth
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import db from '../../../db.js';
import { verifyTwoFactorCode } from '../../../services/twoFactor.service.js';
import { getJwtExpiry } from '../../../services/auth.service.js';
import { checkRateLimit, RATE_LIMITS } from '../../../security.js';
import { isValid2FACode } from '../../../services/validation.service.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

function fmtSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

export async function verifyOAuth2FARoute(request: FastifyRequest, reply: FastifyReply) {
  // 🔒 SÉCURITÉ : Rate limiting pour éviter le brute-force
  if (!checkRateLimit(`2fa-oauth-${request.ip}`, RATE_LIMITS.TWO_FA.max, RATE_LIMITS.TWO_FA.window)) {
    return reply.status(429).send({ error: 'Too many requests. Please try again later.' });
  }

  const body = (request.body as any) || {};
  const tempToken: string = (body.tempToken ?? '').toString().trim();
  const code: string = (body.code ?? '').toString().trim();

  if (!tempToken || !code) {
    return reply.status(400).send({ error: 'Missing tempToken or code' });
  }

  // 🔒 SÉCURITÉ : Validation du format du code 2FA (6 chiffres uniquement)
  if (!isValid2FACode(code)) {
    return reply.status(400).send({ error: 'Invalid code format. Code must be 6 digits.' });
  }

  // Vérifier le token temporaire
  let decoded: any;
  try {
    decoded = jwt.verify(tempToken, JWT_SECRET);
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid or expired temporary token' });
  }

  if (!decoded.pending2FA || !decoded.userId) {
    return reply.status(400).send({ error: 'Invalid temporary token' });
  }

  const userId = decoded.userId;

  // Vérifier le code 2FA
  const isValidCode = verifyTwoFactorCode(userId, code);
  
  if (!isValidCode) {
    return reply.status(400).send({ error: 'Invalid or expired verification code' });
  }

  // Code valide → créer le vrai JWT et connecter l'utilisateur
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }

  // Générer le JWT final
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const jwtToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Invalider les anciens tokens
  db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(user.id);

  // Stocker le nouveau token
  const exp = getJwtExpiry(jwtToken);
  db.prepare('INSERT INTO active_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    jwtToken,
    exp ? fmtSqliteDate(new Date(exp * 1000)) : null
  );

  // Définir le cookie
  reply.setCookie('jwt', jwtToken, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: maxAge
  });


  // Retourner les infos utilisateur (sans le password_hash)
  const { password_hash, ...safeUser } = user;
  
  return reply.send({ 
    message: 'Authentication successful',
    user: safeUser 
  });
}
