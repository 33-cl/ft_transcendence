import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, initializeFriendSearch, mainMenuHTML, goToMainHTML, goToProfileHTML, gameHTML, game4HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML, settingsHTML } from '../components/index.html.js';
import { animateDots, switchTips } from '../components/matchmaking.html.js';

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

async function show(pageName: keyof typeof components)
{
    // Show the requested component
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) {
        if (typeof component.html === 'function') {
            let htmlResult;
            
            // Cas spécial pour le profil - passer l'utilisateur sélectionné
            if (pageName === 'profile') {
                const selectedUser = (window as any).selectedProfileUser;
                htmlResult = component.html(selectedUser);
                // Nettoyer après utilisation
                (window as any).selectedProfileUser = null;
            } else {
                htmlResult = component.html();
            }
            
            if (htmlResult instanceof Promise) {
                element.innerHTML = await htmlResult;
            } else {
                element.innerHTML = htmlResult;
            }
        } else {
            element.innerHTML = component.html;
        }
    }

    // Notifies each element is ready
    setTimeout(() =>
    {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}

async function load(pageName: string, updateHistory: boolean = true)
{   
    hideAllPages();
    if (pageName === 'landing')
        await show('landing');
    else if (pageName === 'mainMenu')
    {
         if ((window as any).aiMode) {
            (window as any).aiMode = false; //Retour au menu - reset du flag IA 🤖 
            console.log('🏠 Retour au menu principal - Mode IA désactivé, contrôles W/S réactivés');
         } 
        // Refresh user stats BEFORE showing components to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then(async (statsChanged: boolean) => {
                if (statsChanged)
                    console.log('📊 User stats refreshed before main menu display');
                // Show components after stats are refreshed
                await show('mainMenu');
                await show('friendList');
                initializeFriendSearch(); // Initialiser la recherche d'amis
                await show('leaderboard');
                await show('goToProfile');
            }).catch(async (error: any) => {
                console.warn('Failed to refresh user stats before main menu:', error);
                // Still show components even if refresh fails
                await show('mainMenu');
                await show('friendList');
                initializeFriendSearch(); // Initialiser la recherche d'amis
                await show('leaderboard');
                await show('goToProfile');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('mainMenu');
            await show('friendList');
            initializeFriendSearch(); // Initialiser la recherche d'amis
            await show('leaderboard');
            await show('goToProfile');
        }
    }
    else if (pageName === 'settings')
        await show('settings');
    else if (pageName === 'signIn')
    {
        await show('signIn');
        // show('goToMain');
    }
    else if (pageName === 'signUp')
    {
        await show('signUp');
        // show('goToMain');
    }
    else if (pageName === 'game')
        await show('game');
    else if (pageName === 'game4')
        await show('game4');
    else if (pageName === 'matchmaking')
    {
        await show('matchmaking');
        animateDots();
        switchTips();
    }
    else if (pageName === 'profile')
    {
        // Refresh user stats BEFORE showing profile to ensure displayed data is current
        if (window.currentUser && (window as any).refreshUserStats) {
            (window as any).refreshUserStats().then(async (statsChanged: boolean) => {
                if (statsChanged) {
                    console.log('📊 User stats refreshed before profile display');
                }
                // Show components after stats are refreshed
                await show('profile');
                await show('goToMain');
            }).catch(async (error: any) => {
                console.warn('Failed to refresh user stats before profile:', error);
                // Still show components even if refresh fails
                await show('profile');
                await show('goToMain');
            });
        } else {
            // No user or refresh function available, show components directly
            await show('profile');
            await show('goToMain');
        }
    }
    else if (pageName === 'gameFinished')
        await show('gameFinished');
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