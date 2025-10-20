import { FastifyInstance } from 'fastify';
import db from '../db.js';
import jwt from 'jsonwebtoken';
import { sanitizeUsername } from '../security.js';
import { isValidUsername } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Helper function to get JWT expiry timestamp
function getJwtExpiry(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    return decoded?.exp || null;
  } catch {
    return null;
  }
}

// Helper function to format date for SQLite
function fmtSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// Helper function to parse and sanitize username from email
function parseUsernameFromEmail(email: string): string {
  // Extract the part before @
  const rawUsername = email.split('@')[0];
  
  // Remove all non-alphanumeric and non-underscore characters
  let cleaned = rawUsername.replace(/[^a-zA-Z0-9_]/g, '');
  
  // If empty after cleaning, use a default
  if (!cleaned) {
    cleaned = 'user';
  }
  
  // Truncate to max 10 characters
  if (cleaned.length > 10) {
    cleaned = cleaned.substring(0, 10);
  }
  
  // If less than 3 characters, pad with random numbers
  while (cleaned.length < 3) {
    cleaned += Math.floor(Math.random() * 10).toString();
  }
  
  // Sanitize for extra security
  const sanitized = sanitizeUsername(cleaned);
  
  // Final validation
  if (!isValidUsername(sanitized)) {
    // Fallback: generate a simple valid username
    return 'user' + Math.floor(Math.random() * 1000000);
  }
  
  return sanitized;
}

export default async function oauthRoutes(app: FastifyInstance) {
  // Google redirects here after authentication
  app.get('/auth/google/callback', async (request, reply) => {
    try {
      // Get access token from the authorization code
      const token = await (app as any).google.getAccessTokenFromAuthorizationCodeFlow(request);
      
      app.log.info({ tokenKeys: Object.keys(token), token }, 'Token reçu de Google - structure complète');

      // Use access_token to get user info from Google
      // We need to use the access_token, not id_token
      const accessToken = token.access_token || token.token?.access_token;
      if (!accessToken) {
        app.log.error({ token }, 'No access_token found in token object');
        throw new Error('No access_token in response from Google');
      }

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        app.log.error({ errorText, status: userInfoResponse.status }, 'Failed to get user info from Google');
        throw new Error('Failed to retrieve user info from Google');
      }

      const googleUser = await userInfoResponse.json() as {
        id: string;
        email: string;
        name: string;
        picture: string;
      };
      
      app.log.info({ userId: googleUser.id, email: googleUser.email }, 'Utilisateur Google authentifié');

      
      // Search for a user in the database with this Google ID
      let user = db.prepare(
        'SELECT * FROM users WHERE google_id = ?'
      ).get(googleUser.id) as any;

      // Create if it doesn't exist
      if (!user) {
        // Parse username from email with same validation as standard auth
        const baseUsername = parseUsernameFromEmail(googleUser.email);
        let username = baseUsername;
        let counter = 1;

        // Check username uniqueness
        while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
          // If username exists, append counter (keeping it under 10 chars)
          const maxBaseLength = 10 - counter.toString().length;
          username = baseUsername.substring(0, maxBaseLength) + counter;
          counter++;
        }

        // Creates the user
        const result = db.prepare(
          `INSERT INTO users (username, email, display_name, avatar_url, google_id, provider) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(username, googleUser.email, googleUser.name, googleUser.picture, googleUser.id, 'google') as any;

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as any;
        app.log.info({ userId: user.id }, 'Nouvel utilisateur créé via Google OAuth');
      } else {
        // If exists, update infos
        db.prepare(
          `UPDATE users 
           SET display_name = ?, avatar_url = ?, email = ? 
           WHERE id = ?`
        ).run(googleUser.name, googleUser.picture, googleUser.email, user.id);
        app.log.info({ userId: user.id }, 'Utilisateur existant connecté via Google OAuth');
      }

      // Generate JWT token like normal login
      const maxAge = 60 * 60 * 24 * 7; // 7 days
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
      
      // Set JWT cookie
      reply.setCookie('jwt', jwtToken, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'strict',
        maxAge: maxAge
      });

      console.log('User authenticated successfully with Google:', user);

      // Redirect to frontend if success
      // Redirect to root - the SPA will check the session and load mainMenu
      return reply.redirect('https://localhost:3000/');

    } catch (err) {
      app.log.error(err, 'Erreur pendant le callback Google OAuth');
      // Redirect to a failure page on the front
      return reply.redirect('https://localhost:3000/?error=oauth_failed');
    }
  });
}
