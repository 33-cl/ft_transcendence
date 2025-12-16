// Security Guard - Protège les fonctions sensibles contre l'exécution dans des onglets bloqués

import { isSessionBlocked } from './sessionBroadcast.js';

/**
 * Installe un handler global pour les rejets de Promise non gérés
 * Évite les "Uncaught (in promise)" dans la console
 */
export function installUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        // Si c'est une erreur de sécurité connue, on la gère silencieusement
        const errorMessage = event.reason?.message || event.reason || '';
        
        if (typeof errorMessage === 'string' && (
            errorMessage.includes('Action blocked') ||
            errorMessage.includes('Fetch blocked') ||
            errorMessage.includes('not have an active session')
        )) {
            // Empêcher l'affichage dans la console
            event.preventDefault();
            // Log discret pour le debug (optionnel)
            // console.debug('[Security] Blocked action:', errorMessage);
            return;
        }
        
        // Pour les autres erreurs, on les laisse s'afficher normalement
        // mais on les marque comme gérées pour éviter le "Uncaught"
        // Note: on peut choisir de les afficher proprement
        console.warn('[Unhandled Promise]', errorMessage);
        event.preventDefault();
    });
}

/**
 * Bloque tous les inputs, boutons et liens quand la session est bloquée
 * Utilise un MutationObserver pour bloquer aussi les éléments ajoutés dynamiquement
 */
export function installInputBlocker() {
    // Fonction qui bloque un élément
    const blockElement = (el: HTMLElement) => {
        if (el instanceof HTMLInputElement || 
            el instanceof HTMLButtonElement || 
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement) {
            el.disabled = true;
            el.style.pointerEvents = 'none';
        }
        if (el instanceof HTMLAnchorElement) {
            el.style.pointerEvents = 'none';
        }
    };

    // Fonction qui bloque tous les éléments interactifs
    const blockAllInteractiveElements = () => {
        if (!isSessionBlocked()) return;
        
        document.querySelectorAll('input, button, textarea, select, a').forEach(el => {
            blockElement(el as HTMLElement);
        });
    };

    // Observer pour les nouveaux éléments ajoutés au DOM
    const observer = new MutationObserver((mutations) => {
        if (!isSessionBlocked()) return;
        
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    // Bloquer l'élément lui-même s'il est interactif
                    blockElement(node);
                    // Bloquer ses enfants interactifs
                    node.querySelectorAll('input, button, textarea, select, a').forEach(el => {
                        blockElement(el as HTMLElement);
                    });
                }
            });
        });
    });

    // Démarrer l'observation
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Bloquer les éléments existants
    blockAllInteractiveElements();
    
    // Vérifier périodiquement (au cas où)
    setInterval(blockAllInteractiveElements, 500);
}

/**
 * Wrapper pour protéger une fonction sensible
 * Vérifie que l'onglet n'est pas bloqué avant d'exécuter la fonction
 */
export function guardFunction<T extends (...args: any[]) => any>(
    fn: T,
    _functionName: string,
    requiresAuth: boolean = false
): T {
    return ((...args: any[]) => {
        // Vérifier si la session est bloquée
        if (isSessionBlocked()) {
            console.trace('Call stack:');
            return Promise.reject(new Error(`Action blocked: This tab does not have an active session`));
        }
        
        // Vérifier si l'utilisateur est connecté (pour les fonctions qui nécessitent une auth)
        if (requiresAuth) {
            const currentUser = window.currentUser;
            if (!currentUser) {
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

    return !blocked;
}

/**
 * Wrapper pour les event handlers
 * Empêche l'exécution si la session est bloquée
 */
export function guardEventHandler<T extends Event>(
    handler: (event: T) => void,
    _actionName: string
): (event: T) => void {
    return (event: T) => {
        if (isSessionBlocked()) {
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
    const originalFetch = window.fetch.bind(window);
    
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input?.toString() || 'unknown';
        
        // Si session bloquée, tout bloquer sauf /auth/me (pour vérifier l'état)
        if (isSessionBlocked()) {
            // Seul /auth/me est autorisé pour vérifier l'état de la session
            if (url.includes('/auth/me')) {
                return originalFetch(input, init);
            }
            // Tout le reste est bloqué
            return Promise.reject(new Error(`Action blocked: This tab does not have an active session`));
        }
        
        // Vérifier si l'utilisateur est connecté pour les requêtes API protégées
        if (url.includes('/api/')) {
            const currentUser = window.currentUser;
            if (!currentUser) {
                return Promise.reject(new Error(`Fetch blocked: User not authenticated`));
            }
        }
        
        // Si tout est OK, exécuter normalement
        return originalFetch(input, init);
    };
    
}

/**
 * Protège le socket contre les émissions non autorisées depuis un onglet bloqué
 * Doit être appelé après l'initialisation du socket
 */
export function installSocketGuard()
{
    const socket = window.socket;
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
    
    // Événements toujours autorisés (même si bloqué - heartbeat)
    const allowedWhenBlocked = ['ping', 'disconnect'];
    
    // Remplacer emit par une version protégée
    socket.emit = function(event: string, ...args: any[]) {
        // Autoriser certains événements même si bloqué (heartbeat)
        if (allowedWhenBlocked.includes(event)) {
            return originalEmit(event, ...args);
        }
        
        // Bloquer TOUT si session bloquée (sauf ping/disconnect)
        if (isSessionBlocked())
        {
            return socket; // Retourner le socket pour le chaînage
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
    // Handler global pour les Promise rejections non gérées
    installUnhandledRejectionHandler();
    
    // Fetch Guard - bloque les requêtes HTTP
    installFetchGuard();
    
    // Input Blocker - bloque les inputs si session bloquée
    installInputBlocker();
    
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
