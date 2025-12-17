// navigation.ts - Gestion centralisée de la navigation et de l'historique du navigateur

import { load } from './utils.js';

/**
 * Met à jour l'historique du navigateur avec une nouvelle page
 * @param pageName - Nom de la page à ajouter à l'historique
 */
export function pushHistoryState(pageName: string): void {
    // Les pages de fin de jeu restent sur /game dans l'URL
    const gameFinishedPages = ['gameFinished', 'spectatorGameFinished', 'tournamentSemifinalFinished', 'tournamentFinalFinished'];
    if (pageName === 'gameStats') {
        const matchId = (window as any).selectedMatchData?.id;
        const urlPath = matchId ? `gameStats/${matchId}` : 'gameStats';
        window.history.pushState({ page: pageName, matchId }, '', `/${urlPath}`);
        return;
    }
    if (pageName === 'profile') {
        const username = (window as any).selectedProfileUser?.username || (window as any).currentUser?.username;
        const urlPath = username ? `profile/${username}` : 'profile';
        window.history.pushState({ page: pageName, username }, '', `/${urlPath}`);
        return;
    }
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
    if (pageName === 'gameStats') {
        // Prefer explicit matchId from selectedMatchData; if not available (e.g. on reload),
        // try to extract it from the current URL to avoid removing it when replacing history
        let matchId = (window as any).selectedMatchData?.id;
        if (!matchId) {
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts[0] && parts[0].toLowerCase() === 'gamestats' && parts[1]) {
                const parsed = Number(parts[1]);
                if (!Number.isNaN(parsed)) matchId = parsed;
            }
        }
        const urlPath = matchId ? `gameStats/${matchId}` : 'gameStats';
        window.history.replaceState({ page: pageName, matchId }, '', `/${urlPath}`);
        return;
    }
    if (pageName === 'profile') {
        // If we have an explicitly selected profile use it. Otherwise, prefer keeping any
        // username already present in the URL (to avoid overwriting /profile/otheruser on reload).
        let username = (window as any).selectedProfileUser?.username;
        if (!username) {
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts[0] === 'profile' && parts[1]) username = parts[1];
        }
        if (!username) username = (window as any).currentUser?.username;
        const urlPath = username ? `profile/${username}` : 'profile';
        window.history.replaceState({ page: pageName, username }, '', `/${urlPath}`);
        return;
    }
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
        
        // Normalize target page from state or URL; use getPageFromURL to handle unknown paths
        let targetPage = event.state?.page || getPageFromURL();
        
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
        // Exception: allow viewing the 404 page without being authenticated
        if (!window.currentUser && targetPage !== 'signIn' && targetPage !== 'signUp' && targetPage !== 'landing' && targetPage !== 'notFound') {
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

    // Handle gameStats detail URLs: /gameStats/:matchId (and legacy lowercase /gamestats/:matchId)
    // Some users type URLs manually; normalize to the canonical casing.
    const lowered = cleanPath.toLowerCase();
    if ((lowered.startsWith('gamestats/') || lowered.startsWith('gamestats/')) && cleanPath.split('/').length === 2) {
        const parts = cleanPath.split('/');
        const matchId = parts[1];
        // Normalize URL to /gameStats/:id (without triggering a navigation)
        window.history.replaceState(window.history.state, '', `/gameStats/${matchId}`);
        return 'gameStats';
    }
    if (cleanPath.startsWith('gameStats/') && cleanPath.split('/').length === 2) {
        return 'gameStats';
    }

    // Handle profile detail URLs: /profile/:username
    if (cleanPath.startsWith('profile/') && cleanPath.split('/').length === 2) {
        return 'profile';
    }
    
    // For other pages, check against known pages; otherwise return 'notFound'
    const candidate = cleanPath.split('/')[0] || 'signIn';
    const knownPages = new Set([
        'signIn','signUp','landing','mainMenu','leaderboard','friendList','addFriends','matchmaking','game','game4','spectate','spectate4','twoFactor','gameFinished','tournamentSemifinalFinished','tournamentFinalFinished','spectatorGameFinished','profileDashboard','profileWinRateHistory','contextMenu','settings','gameConfig','aiConfig','tournaments','rules','goToMain'
    ]);
    if (knownPages.has(candidate)) return candidate;
    // Unknown path -> show 404
    return 'notFound';
}
