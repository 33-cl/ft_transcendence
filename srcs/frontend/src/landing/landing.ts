// landing.ts - Gestion de la page landing

import { load } from '../navigation/utils.js';

// Initialiser les handlers de la page landing
export function initLandingHandlers(): void {
    const landingElement = document.getElementById('landing');
    
    if (!landingElement) return;
    
    // Vérifier si déjà initialisé pour éviter les listeners multiples
    if ((landingElement as any)._landingListenersSet) return;
    (landingElement as any)._landingListenersSet = true;
    
    // Ajouter un gestionnaire de clic sur toute la page landing
    const handleLandingClick = async (event: MouseEvent) => {
        event.preventDefault();
        // Rediriger vers la page de connexion
        await load('signIn');
    };
    
    // Ajouter un gestionnaire pour la touche Entrée ou Espace
    const handleLandingKeypress = async (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            await load('signIn');
        }
    };
    
    landingElement.addEventListener('click', handleLandingClick);
    document.addEventListener('keypress', handleLandingKeypress);
    
    // Nettoyer les event listeners si on quitte la page
    const cleanup = () => {
        landingElement.removeEventListener('click', handleLandingClick);
        document.removeEventListener('keypress', handleLandingKeypress);
        (landingElement as any)._landingListenersSet = false;
    };
    
    // Stocker la fonction de nettoyage
    window.cleanupLandingHandlers = cleanup;
}

// Initialiser automatiquement quand les composants sont prêts
document.addEventListener('componentsReady', () => {
    const landingElement = document.getElementById('landing');
    if (landingElement && landingElement.innerHTML !== '') {
        initLandingHandlers();
    }
});
