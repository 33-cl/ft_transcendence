/**
 * Service de gestion de l'authentification à deux facteurs (2FA) par email
 */

import nodemailer from 'nodemailer';
import db from '../db.js';
import { randomInt } from 'crypto';

// Configuration du transporteur d'emails avec Gmail
// Les credentials doivent être définis dans les variables d'environnement

// creation du transporteur une foi sau demarrage du server

if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  console.warn('⚠️ WARNING: EMAIL_USER or EMAIL_APP_PASSWORD not set. 2FA emails will not work!');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});


export interface TwoFactorCode {
  id: number;
  user_id: number;
  code: string;
  expires_at: string;
  created_at: string;
}

export function generateTwoFactorCode(): string
{
  // Génère un nombre cryptographiquement sécurisé entre 100000 et 999999
  const code = randomInt(100000, 1000000);
  return code.toString();
}

export function storeTwoFactorCode(userId: number, code: string, expiryMinutes: number = 5): void
{
  db.prepare('DELETE FROM two_factor_codes WHERE user_id = ?').run(userId);
  
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const expiresAtStr = formatSqliteDate(expiresAt);
  
  db.prepare('INSERT INTO two_factor_codes (user_id, code, expires_at) VALUES (?, ?, ?)').run(
    userId,
    code,
    expiresAtStr
  );
}

export function verifyTwoFactorCode(userId: number, code: string): boolean
{
  const now = formatSqliteDate(new Date());
  
  // Debug: Afficher tous les codes pour cet utilisateur
  const allCodes = db.prepare(`
    SELECT * FROM two_factor_codes WHERE user_id = ?
  `).all(userId);
  console.log(`🔍 2FA Debug - User ${userId}, Input code: "${code}", Now: "${now}"`);
  console.log(`🔍 2FA Debug - Stored codes:`, allCodes);
  
  const result = db.prepare(`
    SELECT * FROM two_factor_codes 
    WHERE user_id = ? AND code = ? AND expires_at > ?
  `).get(userId, code, now) as TwoFactorCode | undefined;
  
  console.log(`🔍 2FA Debug - Query result:`, result);
  
  if (result)
  {
    // Code valide, on le supprime pour qu'il ne soit utilisable qu'une fois
    db.prepare('DELETE FROM two_factor_codes WHERE id = ?').run(result.id);
    console.log(`✅ 2FA Debug - Code verified successfully`);
    return true;
  }
  
  console.log(`❌ 2FA Debug - Code verification failed`);
  return false;
}

export function cleanupExpiredCodes(): void
{
  const now = formatSqliteDate(new Date());
  db.prepare('DELETE FROM two_factor_codes WHERE expires_at <= ?').run(now);
}


export async function sendTwoFactorEmail(email: string, username: string, code: string): Promise<void>
{
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD)
    throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_APP_PASSWORD environment variables.');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: '🔐 Your Two-Factor Authentication Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background-color: #f9f9f9;
          }
          .code {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
            text-align: center;
            padding: 20px;
            background-color: #fff;
            border-radius: 5px;
            letter-spacing: 5px;
          }
          .warning {
            color: #d32f2f;
            font-size: 14px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🔐 Two-Factor Authentication</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>You requested to enable Two-Factor Authentication or to log in to your account.</p>
          <p>Your verification code is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in <strong>5 minutes</strong>.</p>
          <p class="warning">⚠️ If you did not request this code, please ignore this email and secure your account immediately.</p>
          <p>Thanks,<br>The ft_transcendence Team</p>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${username},

You requested to enable Two-Factor Authentication or to log in to your account.

Your verification code is: ${code}

This code will expire in 5 minutes.

⚠️ If you did not request this code, please ignore this email and secure your account immediately.

Thanks,
The ft_transcendence Team
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('❌ Error sending 2FA email:', error);
    throw new Error('Failed to send 2FA code. Please try again later.');
  }
}

export function enableTwoFactor(userId: number): void
{
  db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(userId);
}


export function disableTwoFactor(userId: number): void
{
  db.prepare('UPDATE users SET two_factor_enabled = 0 WHERE id = ?').run(userId);
  // Supprimer tous les codes en attente
  db.prepare('DELETE FROM two_factor_codes WHERE user_id = ?').run(userId);
}

export function isTwoFactorEnabled(userId: number): boolean
{
  const result = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(userId) as { two_factor_enabled: number } | undefined;
  return result?.two_factor_enabled === 1;
}


function formatSqliteDate(date: Date): string
{
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

// Cleanup automatique des codes expirés toutes les 10 minutes
setInterval(() => {
  cleanupExpiredCodes();
}, 10 * 60 * 1000);
