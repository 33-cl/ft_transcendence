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
function show(pageName) {
    // Clear all components first
    Object.values(components).forEach(component => {
        const element = document.getElementById(component.id);
        if (element)
            element.innerHTML = '';
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
function hide(pageName) {
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element)
        element.innerHTML = '';
}
function hideAllPages() {
    Object.keys(components).forEach(key => hide(key));
}
function initializeComponents() {
    // Affiche la page d'accueil au chargement
    show('landing');
    // Ajoute la navigation SPA
    document.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target)
            return;
        if (target.id === 'guestBtn') {
            hideAllPages();
            show('mainMenu');
        }
        if (target.id === 'localGameBtn') {
            hideAllPages();
            show('game');
        }
        if (target.id === 'signInBtn') {
            hideAllPages();
            show('signIn');
        }
        if (target.id === 'signUpBtn') {
            hideAllPages();
            show('signUp');
        }
        if (target.id === 'title') {
            hideAllPages();
            show('landing');
        }
        // --- ROOM LOGIC ---
        if (target.id === 'ranked1v1Btn') {
            await window.joinOrCreateRoom(2); // 1v1
        }
        if (target.id === 'customCreateBtn') {
            await window.joinOrCreateRoom(4); // 2v2 (exemple)
        }
        if (target.id === 'customJoinBtn') {
            await window.joinOrCreateRoom(4); // 2v2 (exemple)
        }
        // Ajoute ici la logique pour les tournois si besoin
    });
}
// Init as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
}
else {
    initializeComponents();
}
//# sourceMappingURL=spa.js.map