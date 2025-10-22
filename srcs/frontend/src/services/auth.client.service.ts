/**
 * Client-side authentication service
 * Gère les appels API pour l'authentification (register, login, logout)
 */

import { 
    markSessionActive, 
    markSessionInactive, 
    broadcastSessionCreated, 
    broadcastSessionDestroyed 
} from '../utils/sessionBroadcast.js';

/**
 * Interface pour la réponse de registration/login
 */
export interface AuthResponse {
    success: boolean;
    user?: any;
    error?: string;
    code?: string;
}

/**
 * Appelle l'API /auth/register
 * @param email - Email de l'utilisateur
 * @param username - Nom d'utilisateur
 * @param password - Mot de passe
 * @returns AuthResponse avec success: true si OK, sinon error
 */

export async function registerUser(
    email: string, 
    username: string, 
    password: string
): Promise<AuthResponse> {
    try {
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, username, password })
        });

        if (res.status === 201)
        {
            const data = await res.json().catch(() => ({} as any));
            const user = data?.user || null;

            // Stocker l'utilisateur globalement
            (window as any).currentUser = user;

            // Marquer la session comme active
            markSessionActive();

            // Vérifier la session (optionnel)
            try {
                await fetch('/auth/me', { credentials: 'include' });
            } catch {}

            // Notifier les autres onglets
            broadcastSessionCreated();

            // Reconnecter le WebSocket
            if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                (window as any).reconnectWebSocket();
            }

            return { success: true, user };
        }
        else
        {
            const data = await res.json().catch(() => ({} as any));
            return { 
                success: false, 
                error: data?.error || 'Registration error.' 
            };
        }
    } catch (e)
    {
        return { 
            success: false, 
            error: 'Cannot reach server.' 
        };
    }
}

/**
 * Appelle l'API /auth/login
 * @param login - Email ou username
 * @param password - Mot de passe
 * @returns AuthResponse avec success: true si OK, sinon error
 */
export async function loginUser(
    login: string, 
    password: string
): Promise<AuthResponse> {
    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ login, password })
        });

        const data = await res.json().catch(() => ({} as any));

        if (res.ok) {
            const user = data?.user || null;

            // Stocker l'utilisateur globalement
            (window as any).currentUser = user;

            // Vérifier la session (optionnel)
            try {
                await fetch('/auth/me', { credentials: 'include' });
            } catch {}

            // Marquer la session comme active
            markSessionActive();

            // Notifier les autres onglets
            broadcastSessionCreated();

            // Reconnecter le WebSocket
            if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                (window as any).reconnectWebSocket();
            }

            return { success: true, user };
        } else {
            return {
                success: false,
                error: data?.error || 'Login failed.',
                code: data?.code
            };
        }
    } catch (e) {
        return {
            success: false,
            error: 'Cannot reach server.'
        };
    }
}

/**
 * Appelle l'API /auth/logout
 */
export async function logoutUser(): Promise<void> {
    try {
        await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}

    // Nettoyer l'utilisateur courant
    (window as any).currentUser = null;

    // Marquer la session comme inactive
    markSessionInactive();

    // Notifier les autres onglets
    broadcastSessionDestroyed();
}
