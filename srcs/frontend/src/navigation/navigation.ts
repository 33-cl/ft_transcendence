// navigation.ts - Gestion centralisée de la navigation et de l'historique du navigateur

import { load } from './utils.js';

/**
 * Met à jour l'historique du navigateur avec une nouvelle page
 * @param pageName - Nom de la page à ajouter à l'historique
 */
export function pushHistoryState(pageName: string): void {
    console.log(`📝 Pushing history state: ${pageName} → /${pageName}`);
    window.history.pushState({ page: pageName }, '', `/${pageName}`);
}

/**
 * Remplace l'état actuel de l'historique
 * @param pageName - Nom de la page pour remplacer l'état actuel
 */
export function replaceHistoryState(pageName: string): void {
    window.history.replaceState({ page: pageName }, '', `/${pageName}`);
}

/**
 * Empêche la navigation arrière après la déconnexion
 * Redirige automatiquement vers la page de connexion si l'utilisateur n'est pas connecté
 */
export function preventBackNavigationAfterLogout(): void {
    replaceHistoryState('signIn');
    pushHistoryState('signIn');
    // Note: La protection est maintenant gérée dans setupPopStateHandler()
}

/**
 * Gestionnaire principal de l'événement popstate (boutons précédent/suivant du navigateur)
 * Gère la navigation dans l'historique et protège l'accès aux pages d'authentification
 */
export function setupPopStateHandler(): void {
    // Vérifier si le listener n'est pas déjà ajouté
    if ((window as any)._popStateListenerSet) return;
    (window as any)._popStateListenerSet = true;
    
    window.addEventListener('popstate', async function(event) {
        console.log('🔄 PopState event triggered!', {
            state: event.state,
            pathname: window.location.pathname,
            href: window.location.href
        });
        
        let targetPage = event.state?.page;
        
        // Si pas de state, récupérer depuis l'URL actuelle
        if (!targetPage) {
            const path = window.location.pathname.substring(1) || 'signIn'; // Remove leading /
            targetPage = path;
            console.log(`📍 No state found, using URL path: ${targetPage}`);
        } else {
            console.log(`📍 Using state page: ${targetPage}`);
        }
        
        // Protection: empêcher l'accès à landing via l'historique
        if (targetPage === 'landing') {
            targetPage = window.currentUser ? 'mainMenu' : 'signIn';
            console.log(`🚫 Landing blocked, redirecting to: ${targetPage}`);
        }
        
        // Protection: si connecté et tentative d'accès aux pages d'auth → rediriger
        if (window.currentUser && (targetPage === 'signIn' || targetPage === 'signUp')) {
            targetPage = 'mainMenu';
            console.log(`🚫 Auth page blocked (user connected), redirecting to: ${targetPage}`);
        }

        // Protection: empêcher le retour aux pages de jeu transitoires (matchmaking, game, etc.)
        if (['matchmaking', 'game', 'game4', 'gameFinished'].includes(targetPage)) {
            targetPage = 'mainMenu';
            console.log(`🚫 Game flow page blocked in history, redirecting to: ${targetPage}`);
        }
        
        // Protection critique: si pas connecté, forcer la connexion
        if (!window.currentUser && targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'landing') {
            console.log(`🚫 Protected page blocked (no user), forcing signIn`);
            // Forcer le retour à signIn comme dans l'ancienne logique
            pushHistoryState('signIn');
            await load('signIn', undefined, false);
            return;
        }
        
        console.log(`🎯 Final navigation target: ${targetPage}`);
        await load(targetPage, undefined, false);
    });
}

/**
 * Initialise la gestion de la navigation au chargement de la page
 * @param callback - Fonction de callback à exécuter après l'initialisation DOM
 */
export function initNavigationOnLoad(callback: () => void | Promise<void>): void {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await callback();
        });
    } else {
        // Le DOM est déjà chargé, exécuter immédiatement
        (async () => {
            await callback();
        })();
    }
}

/**
 * Vérifie si le DOM est prêt
 * @returns true si le DOM est complètement chargé
 */
export function isDOMReady(): boolean {
    return document.readyState !== 'loading';
}

/**
 * Obtient le nom de la page depuis l'URL actuelle
 * @returns Le nom de la page (ex: 'mainMenu', 'profile', etc.) ou 'signIn' par défaut
 */
export function getPageFromURL(): string {
    const path = window.location.pathname;
    // Enlever le slash initial
    const cleanPath = path.replace(/^\//, '') || 'signIn';
    
    // Handle tournament detail URLs: /tournaments/:id
    if (cleanPath.startsWith('tournaments/') && cleanPath.split('/').length === 2) {
        return cleanPath; // Return full path for tournament details
    }
    
    // For other pages, return just the page name
    return cleanPath.split('/')[0] || 'signIn';
}
