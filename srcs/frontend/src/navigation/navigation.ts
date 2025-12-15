// navigation.ts - Gestion centralisée de la navigation et de l'historique du navigateur

import { load } from './utils.js';

/**
 * Met à jour l'historique du navigateur avec une nouvelle page
 * @param pageName - Nom de la page à ajouter à l'historique
 */
export function pushHistoryState(pageName: string): void {
    // Les pages de fin de jeu restent sur /game dans l'URL
    const gameFinishedPages = ['gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];
    const urlPath = gameFinishedPages.includes(pageName) ? 'game' : pageName;
    window.history.pushState({ page: pageName }, '', `/${urlPath}`);
}

/**
 * Remplace l'état actuel de l'historique
 * @param pageName - Nom de la page pour remplacer l'état actuel
 */
export function replaceHistoryState(pageName: string): void {
    // Les pages de fin de jeu restent sur /game dans l'URL
    const gameFinishedPages = ['gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];
    const urlPath = gameFinishedPages.includes(pageName) ? 'game' : pageName;
    window.history.replaceState({ page: pageName }, '', `/${urlPath}`);
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
    if (window._popStateListenerSet) return;
    window._popStateListenerSet = true;
    
    window.addEventListener('popstate', async function(event) {
        
        let targetPage = event.state?.page;
        
        // Si pas de state, récupérer depuis l'URL actuelle
        if (!targetPage) {
            const path = window.location.pathname.substring(1) || 'signIn'; // Remove leading /
            targetPage = path;
        }
        
        // Protection: empêcher l'accès à landing via l'historique
        if (targetPage === 'landing') {
            targetPage = window.currentUser ? 'mainMenu' : 'signIn';
        }
        
        // Protection: si connecté et tentative d'accès aux pages d'auth → rediriger
        if (window.currentUser && (targetPage === 'signIn' || targetPage === 'signUp')) {
            targetPage = 'mainMenu';
        }

        // Protection: empêcher le retour aux pages de jeu transitoires (matchmaking, game, spectate, etc.)
        if (['matchmaking', 'game', 'game4', 'spectate', 'spectate4', 'gameFinished', 'spectatorGameFinished'].includes(targetPage)) {
            targetPage = 'mainMenu';
            // Corriger l'URL pour refléter la redirection
            replaceHistoryState(targetPage);
        }
        
        // Protection critique: si pas connecté, forcer la connexion
        if (!window.currentUser && targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'landing') {
            // Forcer le retour à signIn comme dans l'ancienne logique
            pushHistoryState('signIn');
            await load('signIn', undefined, false);
            return;
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
    // Enlever le slash initial si présent
    const cleanPath = (path.startsWith('/') ? path.substring(1) : path) || 'signIn';
    
    // Handle tournament detail URLs: /tournaments/:id
    if (cleanPath.startsWith('tournaments/') && cleanPath.split('/').length === 2) {
        return cleanPath; // Return full path for tournament details
    }
    
    // For other pages, return just the page name
    return cleanPath.split('/')[0] || 'signIn';
}
