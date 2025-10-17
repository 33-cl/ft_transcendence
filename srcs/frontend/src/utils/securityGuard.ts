// Security Guard - Protège les fonctions sensibles contre l'exécution dans des onglets bloqués

import { isSessionBlocked } from './sessionBroadcast.js';

/**
 * Wrapper pour protéger une fonction sensible
 * Vérifie que l'onglet n'est pas bloqué avant d'exécuter la fonction
 */
export function guardFunction<T extends (...args: any[]) => any>(
    fn: T,
    functionName: string
): T {
    return ((...args: any[]) => {
        // Vérifier si la session est bloquée
        if (isSessionBlocked()) {
            console.error(`🚫 Security: Blocked call to ${functionName} - Session is blocked in this tab`);
            console.trace('Call stack:');
            return Promise.reject(new Error(`Action blocked: This tab does not have an active session`));
        }
        
        // Si pas bloqué, exécuter la fonction normalement
        console.log(`✅ Security: Allowing call to ${functionName}`);
        return fn(...args);
    }) as T;
}

/**
 * Vérifie si une action peut être exécutée dans cet onglet
 */
export function canExecuteAction(): boolean {
    const blocked = isSessionBlocked();
    if (blocked) {
        console.error('🚫 Security: Action blocked - This tab does not have an active session');
    }
    return !blocked;
}

/**
 * Wrapper pour les event handlers
 * Empêche l'exécution si la session est bloquée
 */
export function guardEventHandler<T extends Event>(
    handler: (event: T) => void,
    actionName: string
): (event: T) => void {
    return (event: T) => {
        if (isSessionBlocked()) {
            console.error(`🚫 Security: Blocked event handler for ${actionName}`);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        handler(event);
    };
}

/**
 * Intercepte et protège toutes les requêtes fetch
 * Doit être appelé au démarrage de l'application
 */
export function installFetchGuard() {
    const originalFetch = window.fetch;
    
    window.fetch = function(...args: Parameters<typeof fetch>): Promise<Response> {
        // Vérifier si la session est bloquée
        if (isSessionBlocked()) {
            const url = args[0]?.toString() || 'unknown';
            
            // Autoriser seulement les requêtes d'authentification
            if (url.includes('/auth/login') || url.includes('/auth/register')) {
                console.log(`✅ Security: Allowing auth request to ${url}`);
                return originalFetch.apply(this, args);
            }
            
            console.error(`🚫 Security: Blocked fetch to ${url} - Session is blocked in this tab`);
            return Promise.reject(new Error(`Fetch blocked: This tab does not have an active session`));
        }
        
        // Si pas bloqué, exécuter normalement
        return originalFetch.apply(this, args);
    };
    
    console.log('🛡️ Fetch guard installed');
}
