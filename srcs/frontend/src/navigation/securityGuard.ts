// Security Guard - Protège les fonctions sensibles contre l'exécution dans des onglets bloqués

import { isSessionBlocked } from './sessionBroadcast.js';

/**
 * Wrapper pour protéger une fonction sensible
 * Vérifie que l'onglet n'est pas bloqué avant d'exécuter la fonction
 */
export function guardFunction<T extends (...args: any[]) => any>(
    fn: T,
    functionName: string,
    requiresAuth: boolean = false
): T {
    return ((...args: any[]) => {
        // Vérifier si la session est bloquée
        if (isSessionBlocked()) {
            console.error(`Security: Blocked call to ${functionName} - Session is blocked in this tab`);
            console.trace('Call stack:');
            return Promise.reject(new Error(`Action blocked: This tab does not have an active session`));
        }
        
        // Vérifier si l'utilisateur est connecté (pour les fonctions qui nécessitent une auth)
        if (requiresAuth) {
            const currentUser = (window as any).currentUser;
            if (!currentUser) {
                console.error(`Security: Blocked call to ${functionName} - User not authenticated`);
                return Promise.reject(new Error(`Action blocked: User not authenticated`));
            }
        }
        
        // Si pas bloqué, exécuter la fonction normalement
        return fn(...args);
    }) as T;
}

/**
 * Vérifie si une action peut être exécutée dans cet onglet
 */
export function canExecuteAction(): boolean {
    const blocked = isSessionBlocked();
    if (blocked) {
        console.error('Security: Action blocked - This tab does not have an active session');
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
            console.error(`Security: Blocked event handler for ${actionName}`);
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
        const url = args[0]?.toString() || 'unknown';
        
        // Autoriser toujours les requêtes de LOGIN (pas logout depuis un onglet bloqué)
        if (url.includes('/auth/login') || 
            url.includes('/auth/register') || 
            url.includes('/auth/me') ||
            url.includes('/oauth/')) {
            return originalFetch.apply(this, args);
        }
        
        // Bloquer logout depuis un onglet bloqué (empêche de déconnecter l'autre onglet)
        if (url.includes('/auth/logout') && isSessionBlocked()) {
            console.error(`Security: Blocked logout from blocked tab`);
            return Promise.reject(new Error(`Logout blocked: This tab does not have an active session`));
        }
        
        // Vérifier si la session est bloquée pour les autres requêtes
        if (isSessionBlocked()) {
            console.error(`Security: Blocked fetch to ${url} - Session is blocked in this tab`);
            return Promise.reject(new Error(`Fetch blocked: This tab does not have an active session`));
        }
        
        // Vérifier si l'utilisateur est connecté pour les requêtes API protégées
        if (url.includes('/api/')) {
            const currentUser = (window as any).currentUser;
            if (!currentUser) {
                console.error(`Security: Blocked fetch to ${url} - No active user session`);
                return Promise.reject(new Error(`Fetch blocked: User not authenticated`));
            }
        }
        
        // Si tout est OK, exécuter normalement
        return originalFetch.apply(this, args);
    };
    
}

/**
 * Protège le socket contre les émissions non autorisées depuis un onglet bloqué
 * Doit être appelé après l'initialisation du socket
 */
export function installSocketGuard()
{
    const socket = (window as any).socket;
    if (!socket)
    {
        console.warn('Socket not found, will retry socket guard installation later');
        return false;
    }
    
    // Éviter d'installer plusieurs fois
    if ((socket as any)._guardInstalled)
        return true;
    
    // Sauvegarder la référence originale
    const originalEmit = socket.emit.bind(socket);
    
    // Événements toujours autorisés (même si bloqué)
    const allowedWhenBlocked = ['ping', 'disconnect'];
    
    // Événements sensibles qui nécessitent une session active
    const sensitiveEvents = [
        'joinRoom', 
        'leaveRoom', 
        'startGame', 
        'playerMove', 
        'sendMessage',
        'createRoom',
        'leaveAllRooms'
    ];
    
    // Remplacer emit par une version protégée
    socket.emit = function(event: string, ...args: any[]) {
        // Autoriser certains événements même si bloqué
        if (allowedWhenBlocked.includes(event)) {
            return originalEmit(event, ...args);
        }
        
        // Bloquer si session bloquée
        if (isSessionBlocked())
        {
            console.error(`Security: Blocked socket.emit('${event}') - Session is blocked in this tab`);
            return socket; // Retourner le socket pour le chaînage
        }
        
        // Vérifier auth pour les événements sensibles
        if (sensitiveEvents.includes(event)) {
            const currentUser = (window as any).currentUser;
            if (!currentUser)
            {
                console.error(`Security: Blocked socket.emit('${event}') - User not authenticated`);
                return socket;
            }
        }
        
        return originalEmit(event, ...args);
    };
    
    (socket as any)._guardInstalled = true;
    return true;
}

/**
 * Installe toutes les protections de sécurité
 * Doit être appelé au démarrage de l'application
 */
export function installAllSecurityGuards()
{
    // Fetch Guard
    installFetchGuard();
    
    // Socket Guard - on vérifie périodiquement si le socket existe
    const checkSocket = setInterval(() => {
        if (installSocketGuard()) {
            clearInterval(checkSocket);
        }
    }, 100);
    
    // Timeout après 10 secondes si le socket n'est pas trouvé
    setTimeout(() => {
        clearInterval(checkSocket);
    }, 10000);
    
}
