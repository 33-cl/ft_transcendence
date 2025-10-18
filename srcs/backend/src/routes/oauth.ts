import { FastifyInstance } from 'fastify';
import db from '../db.js';

export default async function oauthRoutes(app: FastifyInstance) {
  // Google redirects here after authentication
  app.get('/auth/google/callback', async (request, reply) => {
    try {
      // Get access token from the authorization code
      const token = await (app as any).google.getAccessTokenFromAuthorizationCodeFlow(request);

      // Requests user information from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`
        }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to retrieve user info from Google');
      }

      const googleUser = await userInfoResponse.json() as { 
        sub: string,
        name: string, 
        email: string, 
        picture: string 
      };
      
      app.log.info({ googleUser }, 'Utilisateur Google authentifié');

      
      // Search for a user in the database with this Google ID
      let user = db.prepare(
        'SELECT * FROM users WHERE google_id = ?'
      ).get(googleUser.sub) as any;

      // Create if it doesn't exist
      if (!user) {
        // Generate a unique username based on email or name
        const baseUsername = googleUser.email.split('@')[0] || googleUser.name.replace(/\s+/g, '_').toLowerCase();
        let username = baseUsername;
        let counter = 1;

        // Check username uniqueness
        while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        // Creates the user
        const result = db.prepare(
          `INSERT INTO users (username, email, display_name, avatar_url, google_id, provider) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(username, googleUser.email, googleUser.name, googleUser.picture, googleUser.sub, 'google') as any;

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

      // Create a session with cookis
      (reply as any).setCookie('user_id', user.id.toString(), {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });

      (reply as any).setCookie('username', user.username, {
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60
      });

      // Redirect to frontend if success
      return reply.redirect('https://localhost:3000/mainMenu');

    } catch (err) {
      app.log.error(err, 'Erreur pendant le callback Google OAuth');
      // Redirect to a failure page on the front
      return reply.redirect('https://localhost:3000/#/login?error=oauth_failed');
    }
  });
}
