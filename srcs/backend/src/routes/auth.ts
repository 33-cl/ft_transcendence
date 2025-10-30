import { FastifyInstance, FastifyRequest } from 'fastify';
import db from '../db.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { removeUserFromActiveList, isUserAlreadyConnected } from '../socket/socketAuth.js';
import { notifyProfileUpdated, broadcastUserStatusChange, getGlobalIo } from '../socket/socketHandlers.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { sanitizeUsername, sanitizeEmail, validateLength, checkRateLimit } from '../security.js';

// Import des services (logique métier séparée)
import { 
  createUser, 
  generateJwt, 
  storeActiveToken, 
  getJwtMaxAge,
  verifyPassword as verifyPasswordService,
  hashPassword as hashPasswordService,
  getUserByEmail,
  getUserByUsername,
  isTokenActive,
  removeActiveToken
} from '../services/auth.service.js';
import { 
  validateRegisterInput,
  isValidEmail,
  isValidUsername,
  isValidPassword
} from '../services/validation.service.js';
import { 
  checkPassword,
  checkAlreadyConnected,
  authenticateUser,
  createSafeUser,
  validateAndGetUser,
  handleLogout,
  authenticateAndGetSession,
  validateAndSanitizeProfileInput,
  verifyPasswordAndUniqueness,
  updateUserProfile
} from '../helpers/auth.helper.js';
import { 
  streamToBuffer,
  processAvatarUpload
} from '../helpers/avatar.helper.js';

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

// Alias pour les fonctions du service (pour compatibilité avec le code existant)
const hashPassword = hashPasswordService;
const verifyPassword = verifyPasswordService;

function fmtSqliteDate(d: Date): string {
  // YYYY-MM-DD HH:MM:SS (UTC)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
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

  // Helper to get JWT from cookies
  function getJwtFromRequest(request: any): string | undefined
  {
    const cookies = parseCookies(request.headers['cookie'] as string | undefined);
    return cookies['jwt'];
  }

  // Helper to get JWT expiry
  function getJwtExpiry(token: string): number | null
  {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      return decoded?.exp ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * POST /auth/register
   * Inscription d'un nouvel utilisateur
   * 
   * Flux :
   * 1. Validation des inputs (validateRegisterInput)
   * 2. Création du user dans la DB (createUser)
   * 3. Génération du JWT (generateJwt)
   * 4. Stockage du token actif (storeActiveToken)
   * 5. Envoi du cookie + réponse
   */
  fastify.post('/auth/register', async (request, reply) => {
    // Étape 1 : Validation et sanitization des inputs
    
    const validation = validateRegisterInput(request.body as any);
    if (!validation.success)
      return reply.code(400).send({ error: validation.error });

    const { email, username, password } = validation.data;

    try {
      const user = createUser({ email, username, password });

      const jwtToken = generateJwt(user);
      storeActiveToken(user.id, jwtToken);

      reply.setCookie('jwt', jwtToken, {
        httpOnly: true,    // empeche l acces javscript, personne peut lire le cookie
        secure: true,      // https only
        path: '/',         // dispo sur tout le site
        sameSite: 'strict',// protection, evite de pouvoir s'envoyer le cookie vers un site malveillant
        maxAge: getJwtMaxAge() // 7 jours
      });

      //  Reponse avec les données du user (sans password_hash)
      return reply.code(201).send({ user });

    } catch (e: any) {
      // Gestion des erreurs d'unicité (email ou username déjà pris)
      const msg = typeof e?.message === 'string' ? e.message : '';
      
      if (msg.includes('UNIQUE') && msg.includes('users.email')) {
        return reply.code(409).send({ error: 'Email already in use.' });
      }
      if (msg.includes('UNIQUE') && msg.includes('users.username')) {
        return reply.code(409).send({ error: 'Username already taken.' });
      }
      
      // Erreur serveur inconnue
      request.log.error(e);
      return reply.code(500).send({ error: 'Server error.' });
    }
  });

  /**
   * POST /auth/login
   * Connexion d'un utilisateur
   * 
   * Flux :
   * 1. Validation, rate limiting et récupération de l'utilisateur (validateAndGetUser)
   * 2. Vérification du password (checkPassword)
   * 3. Vérification si déjà connecté (checkAlreadyConnected)
   * 4. Authentification - JWT + cookie + active_tokens (authenticateUser)
   * 5. Envoi de la réponse avec données sécurisées (createSafeUser)
   */
  fastify.post('/auth/login', async (request, reply) => {
    const body = (request.body as any) || {};
    const login: string = (body.login ?? body.username ?? body.email ?? '').toString().trim();
    const password: string = (body.password ?? '').toString();

    // Validation, rate limiting et récupération de l'utilisateur
    const user = validateAndGetUser(login, password, request.ip, reply);
    if (!user)
      return;

    // Vérification du password
    if (!checkPassword(password, user, reply))
      return;

    // Vérification si déjà connecté
    if (!checkAlreadyConnected(user.id, user.username, reply, fastify))
      return;

    // Authentification (génère JWT, stocke token, envoie cookie)
    authenticateUser(user, reply);

    // Réponse avec utilisateur sécurisé (sans password_hash)
    const safeUser = createSafeUser(user);

    return reply.send({ user: safeUser });
  });

  /**
   * GET /auth/me
   * Récupère l'utilisateur courant via JWT
   * 
   * Flux :
   * 1. Extraction du JWT depuis les cookies
   * 2. Vérification de la validité du JWT
   * 3. Vérification que le token est dans active_tokens
   * 4. Récupération et renvoi des données utilisateur
   */
  fastify.get('/auth/me', async (request, reply) => {
    // Extraction du JWT
    const jwtToken = getJwtFromRequest(request);
    if (!jwtToken)
      return reply.code(401).send({ error: 'No JWT.' });

    try {
      // Vérification et décodage du JWT
      const decodedToken = jwt.verify(jwtToken, JWT_SECRET) as { userId: number; username: string; email: string };
      
      // Vérification que le token est dans active_tokens (pas révoqué)
      const activeT = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(decodedToken.userId, jwtToken);
      if (!activeT)
        return reply.code(401).send({ error: 'Session expired or logged out.' });
      
      // Récupération de l'utilisateur
      const user = db.prepare(
        'SELECT id, email, username, avatar_url, wins, losses, created_at, updated_at, provider FROM users WHERE id = ?'
      ).get(decodedToken.userId);
      
      if (!user)
        return reply.code(401).send({ error: 'Utilisateur non trouvé.' });
      
      return reply.send({ user });
      
    } catch (err) {
      return reply.code(401).send({ error: 'JWT invalide ou expiré.' });
    }
  });

  /**
   * POST /auth/logout
   * Déconnexion d'un utilisateur
   * 
   * Flux :
   * 1. Extraction du JWT depuis les cookies
   * 2. Traitement de la déconnexion (révocation token, notification amis)
   * 3. Suppression du cookie JWT
   * 4. Réponse de confirmation
   */
  fastify.post('/auth/logout', async (request, reply) => {
    // Extraction du JWT
    const jwtToken = getJwtFromRequest(request);
    
    // Traitement de la déconnexion si un JWT existe
    if (jwtToken)
      handleLogout(jwtToken, fastify);
    
    // Suppression du cookie JWT (maxAge: 0 = expire immédiatement)
    reply.setCookie('jwt', '', {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'strict',
      maxAge: 0
    });
    
    return reply.send({ ok: true });
  });

  /**
   * PUT /auth/profile
   * Mise à jour du profil utilisateur (username, email, password)
   * 
   * Flux :
   * 1. Authentification JWT (authenticateProfileRequest)
   * 2. Récupération de la session utilisateur (getUserSession)
   * 3. Extraction du body (username, email, currentPassword, newPassword)
   * 4. Validation des longueurs des inputs (validateProfileInputLengths)
   * 5. Sanitization et validation des données (sanitizeAndValidateProfileData)
   * 6. Vérification du mot de passe actuel si changement (verifyCurrentPassword)
   * 7. Vérification unicité email si changé (checkEmailUniqueness)
   * 8. Vérification unicité username si changé (checkUsernameUniqueness)
   * 9. Construction et exécution de l'UPDATE (updateUserProfile)
   * 10. Notification WebSocket aux amis (notifyProfileUpdated)
   * 11. Réponse de confirmation
   */
  fastify.put('/auth/profile', async (request, reply) => {
    // Authentification JWT + récupération de la session utilisateur
    const jwtToken = getJwtFromRequest(request);
    const sessionRow = authenticateAndGetSession(jwtToken, reply);
    if (!sessionRow)
      return;

    // Extraction du body
    const { username, email, currentPassword, newPassword } = (request.body as {
      username?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    }) || {};

    // Validation des longueurs + sanitization et validation des données
    const sanitized = validateAndSanitizeProfileInput({ username, email, currentPassword, newPassword }, reply);
    if (!sanitized)
      return;

    const sanitizedUsername = sanitized.sanitizedUsername;
    const sanitizedEmail = sanitized.sanitizedEmail;

    try {
      // Vérification (mot de passe courant + unicité email + unicité username)
      if (!verifyPasswordAndUniqueness(newPassword, currentPassword, sanitizedEmail, sanitizedUsername, sessionRow.email, sessionRow.username, sessionRow.id, reply))
        return;

      if (!updateUserProfile({ username: sanitizedUsername, email: sanitizedEmail, newPassword }, sessionRow.id, reply))
        return;

      // Récupérer les valeurs réellement enregistrées en base pour la réponse et notifications
      const updatedRow = db.prepare('SELECT username, email, avatar_url FROM users WHERE id = ?').get(sessionRow.id) as { username: string; email: string; avatar_url: string | null } | undefined;

      if (updatedRow && updatedRow.username && updatedRow.username !== sessionRow.username)
        notifyProfileUpdated(sessionRow.id, { username: updatedRow.username, avatar_url: updatedRow.avatar_url ?? undefined }, fastify);

      return reply.send({
        ok: true,
        message: 'Profile updated successfully',
        updated: {
          username: updatedRow?.username ?? sessionRow.username,
          email: updatedRow?.email ?? sessionRow.email,
          passwordChanged: !!newPassword
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /auth/avatar/upload -> upload avatar sécurisé avec validation
  /**
   * POST /auth/avatar/upload
   * Upload et traitement sécurisé d'un avatar temporaire
   * - Authentification JWT requise
   * - Validation de taille et type de fichier
   * - Réencodage sécurisé de l'image
   * - Sauvegarde temporaire (préfixe temp_)
   */
  fastify.post('/auth/avatar/upload', async (request, reply) =>
  {
    const jwtToken = getJwtFromRequest(request);
    const session = authenticateAndGetSession(jwtToken, reply);
    if (!session)
      return;

    try {
      //Récupération du fichier uploadé
      const avatarFile = await request.file();
      if (!avatarFile)
        return reply.code(400).send({ error: 'No avatar file uploaded' });

      const fileBuffer = await streamToBuffer(avatarFile.file);
      
      //Traitement complet de l'avatar (validation + traitement sécurisé + sauvegarde)
      const { tempAvatarUrl, info } = await processAvatarUpload(session.id, fileBuffer);

      //Réponse avec URL temporaire et informations
      return reply.send({ 
        ok: true, 
        message: 'Avatar uploaded securely and processed, click Save to confirm', 
        temp_avatar_url: tempAvatarUrl,
        info
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      
      // Retourner l'erreur spécifique si elle provient de la validation
      if (error.message && error.message.includes('File too large'))
        return reply.code(400).send({ error: error.message });
      if (error.message && error.message.includes('Unable to detect file type'))
        return reply.code(400).send({ error: error.message });
      if (error.message && error.message.includes('Invalid file type'))
        return reply.code(400).send({ error: error.message });
      if (error.message && error.message.includes('Invalid or corrupted image'))
        return reply.code(400).send({ error: error.message });
      
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
      
      // Notifier les amis du changement d'avatar
      notifyProfileUpdated(userId, { avatar_url: finalAvatarUrl }, fastify);
      
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
      const defaultAvatarUrl = './img/planet.gif';
      db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?').run(
        defaultAvatarUrl, 
        new Date().toISOString().slice(0, 19).replace('T', ' '), 
        userId
      );

      // Notifier les amis du changement d'avatar
      notifyProfileUpdated(userId, { avatar_url: defaultAvatarUrl }, fastify);

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
