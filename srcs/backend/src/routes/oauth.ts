import { FastifyInstance } from 'fastify';
import db from '../db.js';
import jwt from 'jsonwebtoken';
import { sanitizeUsername } from '../security.js';
import { keepAlphanumericAndUnderscore } from '../utils/sanitize.js';
import { isValidUsername } from '../services/validation.service.js';
import { getJwtExpiry } from '../services/auth.service.js';
import { isTwoFactorEnabled, generateTwoFactorCode, storeTwoFactorCode, sendTwoFactorEmail } from '../services/twoFactor.service.js';

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

    // Keep only alphanumeric characters and underscores
    let cleaned = keepAlphanumericAndUnderscore(rawUsername);
    
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

    app.get('/auth/google/callback', async (request: any, reply: any) => {
        try {
        const token = await (app as any).google.getAccessTokenFromAuthorizationCodeFlow(request);

        const accessToken = token.access_token || token.token?.access_token;
        if (!accessToken) {
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
            throw new Error('Failed to retrieve user info from Google');
        }

        const googleUser = await userInfoResponse.json() as {
            id: string;
            email: string;
            name: string;
            picture: string;
        };
   
        // 1. Search by google_id
        let user = db.prepare(
            'SELECT * FROM users WHERE google_id = ?'
        ).get(googleUser.id) as any;

        if (!user) {
            // 2. Create a new Google account
            const baseUsername = parseUsernameFromEmail(googleUser.email);
            let username = baseUsername;
            let counter = 1;

            while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
                const maxBaseLength = 10 - counter.toString().length;
                username = baseUsername.substring(0, maxBaseLength) + counter;
                counter++;
            }

            // SECURITY: If the email already exists, generate a unique temporary email
            // This avoids conflicts and security issues (account takeover)
            let email = googleUser.email;
            const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            
            if (emailExists) {
                // Email already taken → generate a unique email with google_id
                // The user can change it in the settings
                email = `google_${googleUser.id}@oauth.local`;
            }

            const result = db.prepare(
                `INSERT INTO users (username, email, display_name, avatar_url, google_id, provider) 
                VALUES (?, ?, ?, ?, ?, ?)`
            ).run(username, email, googleUser.name, googleUser.picture, googleUser.id, 'google') as any;

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as any;
        } else {
            // 3. Existing Google user: update info
            db.prepare(
                `UPDATE users 
                SET display_name = ?, avatar_url = ?
                WHERE id = ?`
            ).run(googleUser.name, googleUser.picture, user.id);
        }

        // SECURITY: 2FA check if enabled for the user
        // IMPORTANT: Even for Google OAuth, we check 2FA to avoid bypass
        const has2FA = isTwoFactorEnabled(user.id);
        
        if (has2FA) {
            // User has enabled 2FA → send a code instead of connecting directly
            try {
                const twoFactorCode = generateTwoFactorCode();
                storeTwoFactorCode(user.id, twoFactorCode, 5);
                await sendTwoFactorEmail(user.email, user.username, twoFactorCode);

                // Temporarily store the user ID in a session
                // To allow 2FA verification afterwards
                const tempToken = jwt.sign(
                    { userId: user.id, pending2FA: true },
                    JWT_SECRET,
                    { expiresIn: '10m' } // Temporary token for 10 minutes
                );

                // SPA COMPLIANCE: Close the popup and communicate with the parent window
                // The SPA will display the 2FA form, not the backend
                return reply.type('text/html').send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Two-Factor Authentication Required</title>
                    </head>
                    <body>
                        <script>
                            // Send the message to the parent window (SPA)
                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'oauth-2fa-required',
                                    tempToken: '${tempToken}'
                                }, window.location.origin);
                            }
                            // Immediately close the popup
                            window.close();
                        </script>
                    </body>
                    </html>
                `);
            } catch (error) {
                return reply.type('text/html').send(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Error</title></head>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'oauth-error',
                                    error: 'Failed to send verification code'
                                }, window.location.origin);
                            }
                            window.close();
                        </script>
                    </body>
                    </html>
                `);
            }
        }

        // Generate JWT token like normal login
        const maxAge = 60 * 60 * 24 * 7; // 7 days
        const jwtToken = jwt.sign(
            { userId: user.id },
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

        // Close Window and notify parent
        return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Successful</title>
            </head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'oauth-success' }, 'https://localhost:3000');
                    }
                    window.close();
                </script>
            </body>
            </html>
        `);

        } catch (err) {
        // Close Window and notify parent of error
        return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Error</title>
            </head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'oauth-error', error: 'Authentication failed' }, 'https://localhost:3000');
                    }
                    window.close();
                </script>
            </body>
            </html>
        `);
        }
    });
}
