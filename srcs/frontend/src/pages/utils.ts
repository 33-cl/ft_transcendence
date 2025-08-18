import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, goToMainHTML, gameHTML, game3HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML } from '../components/index.js';
import { animateDots, switchTips } from '../components/matchmaking.js';
import { cleanupGameState } from '../game/gameCleanup.js';

const components = {
    landing: {id: 'landing', html: landingHTML},
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
    back2main: {id: 'back2main', html: goToMainHTML},
    leaderboard: {id: 'leaderboard', html: leaderboardHTML},
    friendList: {id: 'friendList', html: friendListHTML},
    matchmaking: {id: 'matchmaking', html: matchmakingHTML},
    game: {id: 'game', html: gameHTML},
    game3: {id: 'game3', html: game3HTML},
    signIn: {id: 'signIn', html: signInHTML},
    signUp: {id: 'signUp', html: signUpHTML},
    gameFinished: {id: 'gameFinished', html: gameFinishedHTML},
    profile: {id: 'profile', html: profileHTML},
    contextMenu: {id: 'contextMenu', html: contextMenuHTML},
};

function show(pageName: keyof typeof components)
{
    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element)
        element.innerHTML = component.html;

    // Notifies each element is ready
    setTimeout(() =>
    {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

function load(pageName: string, updateHistory: boolean = true)
{
    // OPTIMISÉ: Nettoyer l'état du jeu seulement si nécessaire
    // et éviter les nettoyages inutiles qui ralentissent l'interface
    if (pageName !== 'game' && pageName !== 'game3' && pageName !== 'matchmaking') {
        // Ne nettoyer que si on a vraiment besoin (éviter les appels inutiles)
        if ((window as any).socket || (window as any).controlledPaddle || (window as any).isLocalGame) {
            cleanupGameState();
        }
    }
    
    hideAllPages();
    if (pageName === 'landing')
        show('landing');
    else if (pageName === 'mainMenu')
    {
        show('mainMenu');
        show('friendList');
        show('leaderboard');
    }
    else if (pageName === 'signIn')
    {
        show('signIn');
        show('back2main');
    }
    else if (pageName === 'signUp')
    {
        show('signUp');
        show('back2main');
    }
    else if (pageName === 'game')
        show('game');
    else if (pageName === 'game3')
        show('game3');
    else if (pageName === 'matchmaking')
    {
        show('matchmaking');
        animateDots();
        switchTips();
    }
    else if (pageName === 'profile')
    {
        show('profile');
        show('back2main');
    }
    else if (pageName === 'gameFinished')
        show('gameFinished');
    else
        console.warn(`Page ${pageName} not found`);

    if (updateHistory)
        window.history.pushState({ page: pageName }, '', `/${pageName}`);
}

function hide(pageName: keyof typeof components)
{
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) element.innerHTML = '';
}

function hideAllPages(): void
{
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

export { show, load, hideAllPages, hide };