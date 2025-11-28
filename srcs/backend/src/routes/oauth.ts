import { FastifyInstance } from 'fastify';
import db from '../db.js';
import jwt from 'jsonwebtoken';
import { sanitizeUsername } from '../security.js';
import { isValidUsername } from '../services/validation.service.js';
import { getJwtExpiry } from '../services/auth.service.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Format date for SQLite
function fmtSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function parseUsernameFromEmail(email: string): string {
  
    const rawUsername = email.split('@')[0];
  
    let cleaned = rawUsername.replace(/[^a-zA-Z0-9_]/g, '');
    
    if (!cleaned) {
        cleaned = 'user';
    }
    
    if (cleaned.length > 10) {
        cleaned = cleaned.substring(0, 10);
    }
    
    while (cleaned.length < 3) {
        cleaned += Math.floor(Math.random() * 10).toString();
    }
    
    const sanitized = sanitizeUsername(cleaned);
    
    if (!isValidUsername(sanitized)) {
        return 'user' + Math.floor(Math.random() * 1000000);
    }
    
    return sanitized;
}

export default async function oauthRoutes(app: FastifyInstance) {

    app.get('/auth/google/callback', async (request, reply) => {
        try {
        const token = await (app as any).google.getAccessTokenFromAuthorizationCodeFlow(request);

        app.log.info({ tokenKeys: Object.keys(token), token }, 'Token received from Google');

        const accessToken = token.access_token || token.token?.access_token;
        if (!accessToken) {
            app.log.error({ token }, 'No access_token found in token object');
            throw new Error('No access_token in response from Google');
        }

        // Fetch user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
            'Authorization': `Bearer ${accessToken}`
            }
        });

        // Handle non-OK responses
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

        // 1. Chercher par google_id
        let user = db.prepare(
            'SELECT * FROM users WHERE google_id = ?'
        ).get(googleUser.id) as any;

        if (!user) {
            // 2. Créer un nouveau compte Google
            const baseUsername = parseUsernameFromEmail(googleUser.email);
            let username = baseUsername;
            let counter = 1;

            while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
                const maxBaseLength = 10 - counter.toString().length;
                username = baseUsername.substring(0, maxBaseLength) + counter;
                counter++;
            }

            // 🔒 SÉCURITÉ : Si l'email existe déjà, générer un email unique temporaire
            // Cela évite les conflits et les problèmes de sécurité (account takeover)
            let email = googleUser.email;
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            
            if (emailExists) {
                // Email déjà pris → générer un email unique avec le google_id
                // L'utilisateur pourra le changer dans les settings
                email = `google_${googleUser.id}@oauth.local`;
                app.log.warn({ 
                    originalEmail: googleUser.email, 
                    generatedEmail: email 
                }, '⚠️ Email already taken, using generated email. User can update in settings.');
            }

            const result = db.prepare(
                `INSERT INTO users (username, email, display_name, avatar_url, google_id, provider) 
                VALUES (?, ?, ?, ?, ?, ?)`
            ).run(username, email, googleUser.name, googleUser.picture, googleUser.id, 'google') as any;

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as any;
            app.log.info({ userId: user.id, emailSet: !!email }, '✨ Nouvel utilisateur créé via Google OAuth');
        } else {
            // 3. Utilisateur Google existant : mettre à jour les infos
            db.prepare(
                `UPDATE users 
                SET display_name = ?, avatar_url = ?
                WHERE id = ?`
            ).run(googleUser.name, googleUser.picture, user.id);
            app.log.info({ userId: user.id }, '✅ Utilisateur Google existant reconnecté');
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

        reply.setCookie('jwt', jwtToken, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'strict',
            maxAge: maxAge
        });

        console.log('User authenticated successfully with Google:', user);

        // Close Window
        return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Successful</title>
            </head>
            <body>
                <script>
                    window.close();
                </script>
            </body>
            </html>
        `);

        } catch (err) {
        app.log.error(err, 'Erreur pendant le callback Google OAuth');
        
        // Close Window
        return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Successful</title>
            </head>
            <body>
                <script>
                    window.close();
                </script>
            </body>
            </html>
        `);
        }
    });
}
