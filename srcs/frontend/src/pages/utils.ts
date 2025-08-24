import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, goToMainHTML, goToProfileHTML, gameHTML, game4HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML, settingsHTML } from '../components/index.js';
import { animateDots, switchTips } from '../components/matchmaking.js';

const components = {
    landing: {id: 'landing', html: landingHTML},
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
    goToMain: {id: 'goToMain', html: goToMainHTML},
    goToProfile: {id: 'goToProfile', html: goToProfileHTML}, // stocke la fonction
    leaderboard: {id: 'leaderboard', html: leaderboardHTML},
    friendList: {id: 'friendList', html: friendListHTML},
    matchmaking: {id: 'matchmaking', html: matchmakingHTML},
    game: {id: 'game', html: gameHTML},
    game4: {id: 'game4', html: game4HTML},
    signIn: {id: 'signIn', html: signInHTML},
    signUp: {id: 'signUp', html: signUpHTML},
    gameFinished: {id: 'gameFinished', html: gameFinishedHTML},
    profile: {id: 'profile', html: profileHTML},
    contextMenu: {id: 'contextMenu', html: contextMenuHTML},
    settings: {id: 'settings', html: settingsHTML},

};

function show(pageName: keyof typeof components)
{
    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        if (typeof component.html === 'function')
            element.innerHTML = component.html();
        else
            element.innerHTML = component.html;
    }

    // Notifies each element is ready
    setTimeout(() =>
    {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

function load(pageName: string, updateHistory: boolean = true)
{
    hideAllPages();
    if (pageName === 'landing')
        show('landing');
    else if (pageName === 'mainMenu')
    {
        // Refresh user stats BEFORE showing components to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then((statsChanged: boolean) => {
                if (statsChanged) {
                    console.log('📊 User stats refreshed before main menu display');
                }
                // Show components after stats are refreshed
                show('mainMenu');
                show('friendList');
                show('leaderboard');
                show('goToProfile');
            }).catch((error: any) => {
                console.warn('Failed to refresh user stats before main menu:', error);
                // Still show components even if refresh fails
                show('mainMenu');
                show('friendList');
                show('leaderboard');
                show('goToProfile');
            });
        } else {
            // No user or refresh function available, show components directly
            show('mainMenu');
            show('friendList');
            show('leaderboard');
            show('goToProfile');
        }
    }
    else if (pageName === 'settings')
        show('settings');
    else if (pageName === 'signIn')
    {
        show('signIn');
        // show('goToMain');
    }
    else if (pageName === 'signUp')
    {
        show('signUp');
        // show('goToMain');
    }
    else if (pageName === 'game')
        show('game');
    else if (pageName === 'game4')
        show('game4');
    else if (pageName === 'matchmaking')
    {
        show('matchmaking');
        animateDots();
        switchTips();
    }
    else if (pageName === 'profile')
    {
        // Refresh user stats BEFORE showing profile to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then((statsChanged: boolean) => {
                if (statsChanged) {
                    console.log('📊 User stats refreshed before profile display');
                }
                // Show components after stats are refreshed
                show('profile');
                show('goToMain');
            }).catch((error: any) => {
                console.warn('Failed to refresh user stats before profile:', error);
                // Still show components even if refresh fails
                show('profile');
                show('goToMain');
            });
        } else {
            // No user or refresh function available, show components directly
            show('profile');
            show('goToMain');
        }
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