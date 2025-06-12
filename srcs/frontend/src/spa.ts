import { landingHTML, signInHTML, signUpHTML, mainMenuHTML, gameHTML } from './components/index.js';

// Define all components
const components = {
    landing: {
        id: 'landing',
        html: landingHTML
    },
    mainMenu: {
        id: 'mainMenu',
        html: mainMenuHTML
    },
    game: {
        id: 'game',
        html: gameHTML
    },
    signIn: {
        id: 'signIn',
        html: signInHTML
    },
    signUp: {
        id: 'signUp',
        html: signUpHTML
    }
};

// Init components
function show(pageName: keyof typeof components) {
    // Clear all components first
    Object.values(components).forEach(component => {
        const element = document.getElementById(component.id);
        if (element) element.innerHTML = '';
    });

    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        element.innerHTML = component.html;
    }

    // Notifies each element is ready
    setTimeout(() => {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

function hide(pageName: keyof typeof components) {
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) element.innerHTML = '';
}

function hideAllPages(): void {
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

function initializeComponents(): void {
    // Affiche la page d'accueil au chargement
    show('landing');

    // Ajoute la navigation SPA
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target && target.id === 'guestBtn') {
            hideAllPages();
            show('mainMenu');
        }
        if (target && target.id === 'localGameBtn') {
            hideAllPages();
            show('game');
        }
        if (target && target.id === 'signInBtn') {
            hideAllPages();
            show('signIn');
        }
        if (target && target.id === 'signUpBtn') {
            hideAllPages();
            show('signUp');
        }
        if (target && target.id === 'title') {
            hideAllPages();
            show('landing');
        }
    });
}

// Init as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
    initializeComponents();
}