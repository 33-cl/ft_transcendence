import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, gameHTML } from './components/index.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
    }
}

// Define all components
const components = {
    landing:
	{
        id: 'landing',
        html: landingHTML
    },
    mainMenu:
	{
        id: 'mainMenu',
        html: mainMenuHTML
    },
    leaderboard:
	{
        id: 'leaderboard',
        html: leaderboardHTML
    },
    friendList:
	{
        id: 'friendList',
        html: friendListHTML
    },
    game:
	{
        id: 'game',
        html: gameHTML
    },
    signIn:
	{
        id: 'signIn',
        html: signInHTML
    },
    signUp:
	{
        id: 'signUp',
        html: signUpHTML
    }
};

// Init components
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

function hide(pageName: keyof typeof components)
{
    const component = components[pageName];
    const element = document.getElementById(component.id);
    if (element) element.innerHTML = '';
}

function hideAllPages(): void {
    Object.keys(components).forEach(key => hide(key as keyof typeof components));
}

function initializeComponents(): void
{
	// Affiche la page d'accueil au chargement
	show('landing');

	// Ajoute la navigation SPA
	document.addEventListener('click', async (e) => {
		const target = e.target as HTMLElement;
		if (!target) return;
		if (target.id === 'guestBtn')
		{
			hideAllPages();
			show('mainMenu');
			show('friendList');
			show('leaderboard');
		}
		if (target.id === 'localGameBtn')
		{
			(window as any).setIsLocalGame(true); // Active le mode local
			await window.joinOrCreateRoom(1); // Room solo, logique 100% backend
			hideAllPages();
			show('game');
		}
		if (target.id === 'signInBtn')
		{
			hideAllPages();
			show('signIn');
		}
		if (target.id === 'signUpBtn')		
		{
			hideAllPages();
			show('signUp');
		}
		if (target.id === 'title')
		{
			if (window.socket) window.socket.emit('leaveAllRooms');
			hideAllPages();
			show('landing');
		}
		// ROOM LOGIC
		if (target.id === 'ranked1v1Btn')
		{
			(window as any).setIsLocalGame(false); // Désactive le mode local
			await window.joinOrCreateRoom(2); // 1v1
			hideAllPages();
			show('game');
		}
		if (target.id === 'customCreateBtn')
		{
			await window.joinOrCreateRoom(4); // 2v2 (exemple)
			hideAllPages();
			show('game');
		}
		if (target.id === 'customJoinBtn')
		{
			await window.joinOrCreateRoom(4); // 2v2 (exemple), a changer plus tard pour le join via code
			hideAllPages();
			show('game');
		}
		// logique pour les tournois si besoin a add plus tard
	});
}

// Init as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
    initializeComponents();
}