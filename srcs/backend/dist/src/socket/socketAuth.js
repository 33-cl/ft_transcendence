// Socket authentication utilities
import db from '../db.js';
// Map to store authenticated socket users
const socketUsers = new Map();
// Parse cookies from socket handshake
function parseCookiesFromSocket(socket) {
    const cookies = {};
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader)
        return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const [key, ...values] = cookie.trim().split('=');
        if (key && values.length > 0) {
            cookies[key] = decodeURIComponent(values.join('='));
        }
    });
    return cookies;
}
// Authenticate socket connection using session cookie
export function authenticateSocket(socket) {
    try {
        const cookies = parseCookiesFromSocket(socket);
        const sessionToken = cookies['sid'];
        if (!sessionToken) {
            return null;
        }
        // Query database to get user from session
        const sessionQuery = db.prepare(`
      SELECT u.id, u.username, u.email 
      FROM sessions s 
      JOIN users u ON u.id = s.user_id 
      WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
    `);
        const user = sessionQuery.get(sessionToken);
        if (user) {
            // Store user info for this socket
            socketUsers.set(socket.id, user);
            return user;
        }
        return null;
    }
    catch (error) {
        console.error('Socket authentication error:', error);
        return null;
    }
}
// Get authenticated user for a socket
export function getSocketUser(socketId) {
    return socketUsers.get(socketId) || null;
}
// Remove user info when socket disconnects
export function removeSocketUser(socketId) {
    socketUsers.delete(socketId);
}
// Check if socket is authenticated
export function isSocketAuthenticated(socketId) {
    return socketUsers.has(socketId);
}
