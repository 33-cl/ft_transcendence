// navigation.ts - Gestion centralisée de la navigation et de l'historique du navigateur

import { load } from '../pages/utils.js';

/**
 * Met à jour l'historique du navigateur avec une nouvelle page
 * @param pageName - Nom de la page à ajouter à l'historique
 */
export function pushHistoryState(pageName: string): void {
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
    replaceHistoryState('signin');
    pushHistoryState('signin');
    
    window.addEventListener('popstate', function preventBack() {
        if (!window.currentUser) {
            // Forcer le retour à signin
            pushHistoryState('signin');
            load('signIn');
        }
    });
}

/**
 * Gestionnaire principal de l'événement popstate (boutons précédent/suivant du navigateur)
 * Gère la navigation dans l'historique et protège l'accès aux pages d'authentification
 */
export function setupPopStateHandler(): void {
    window.addEventListener('popstate', async function(event) {
        let targetPage = event.state?.page || 'signIn';
        
        // Protection: si connecté et tentative d'accès aux pages d'auth → rediriger
        if (window.currentUser && (targetPage === 'signIn' || targetPage === 'signUp')) {
            targetPage = 'mainMenu';
        }
        
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
    // Enlever le slash initial et utiliser la première partie du chemin
    const pageName = path.replace(/^\//, '') || 'signIn';
    return pageName;
}
