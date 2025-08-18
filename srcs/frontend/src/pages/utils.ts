import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, back2mainHTML, gameHTML, game3HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML } from '../components/index.js';
import { animateDots, switchTips } from '../components/matchmaking.js';
import { cleanupGameState } from '../game/gameCleanup.js';

const components = {
    landing: {id: 'landing', html: landingHTML},
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
    back2main: {id: 'back2main', html: back2mainHTML},
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
    console.log(`[UTILS] Navigation vers la page: ${pageName}`);
    
    // IMPORTANT: Nettoyer l'état du jeu avant chaque navigation
    // SAUF si on navigue vers une page de jeu ou de matchmaking (pour éviter de casser le jeu en cours)
    if (pageName !== 'game' && pageName !== 'game3' && pageName !== 'matchmaking') {
        console.log(`[UTILS] Nettoyage de l'état du jeu car navigation vers ${pageName}`);
        cleanupGameState();
    } else {
        console.log(`[UTILS] Pas de nettoyage car navigation vers une page de jeu: ${pageName}`);
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