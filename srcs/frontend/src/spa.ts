import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, back2mainHTML, gameHTML, matchmakingHTML, gameFinishedHTML } from './components/index.js';
import { animateDots, switchTips } from './components/matchmaking.js';
// import { waitForSocketConnection } from './utils/socketLoading.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
        _roomJoinedHandlerSet?: boolean;
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
	back2main:
	{
		id: 'back2main',
		html: back2mainHTML
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
	matchmaking:
	{
		id: 'matchmaking',
		html: matchmakingHTML
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
    },
	gameFinished:
	{
		id: 'gameFinished',
		html: gameFinishedHTML
	},
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

function hideAllPages(): void
{
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
		if (target.id === 'mainMenuBtn' || target.id === 'back2main')
		{
			// if (!window.socket || !window.socket.connected)
			// {
			// 	waitForSocketConnection(window.socket, () =>
			// 	{
			// 		hideAllPages();
			// 		show('mainMenu');
			// 		show('friendList');
			// 		show('leaderboard');
			// 	});
			// 	return;
			// }
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
			show('back2main');
		}
		if (target.id === 'signUpBtn')		
		{
			hideAllPages();
			show('signUp');
			show('back2main');
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
			//show('matchmaking');// se fait dans joinorcreateroom
		}
		if (target.id === 'customCreateBtn')
		{
			(window as any).setIsLocalGame(false);
			await window.joinOrCreateRoom(4); // 2v2 (exemple)
			// L'affichage sera géré par le handler roomJoined
		}
		if (target.id === 'customJoinBtn')
		{
			(window as any).setIsLocalGame(false);
			await window.joinOrCreateRoom(4); // 2v2 (exemple), à changer plus tard pour le join via code
			// L'affichage sera géré par le handler roomJoined
		}
		if (target.id === 'cancelSearchBtn')
		{
			if (window.socket) window.socket.emit('leaveAllRooms');
			hideAllPages();
			show('mainMenu');
			show('leaderboard');
			show('friendList');
		}
		// Test de l'ecran de chargement sur le bouton Join de tournoi
		if (target.id === 'tournamentJoinBtn')
		{
			hideAllPages();
			show('matchmaking');
			animateDots();
			switchTips();
		}
	});
}

// Handler global pour l'event roomJoined (affichage matchmaking/game)
function setupRoomJoinedHandler()
{
    if (!window.socket)
		return;
    if (window._roomJoinedHandlerSet)
		return;
    window._roomJoinedHandlerSet = true;
    window.socket.on('roomJoined', (data: any) =>
	{
        console.log('[DEBUG FRONT] Event roomJoined reçu', data);
        // Toujours afficher l'écran d'attente tant que la room n'est pas pleine
        if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
		{
            if (data.players < data.maxPlayers)
			{
                hideAllPages();
                show('matchmaking');
                animateDots();
                switchTips();
            }
			else
			{
                hideAllPages();
                show('game');
            }
        }
    });
}



// top level statemetn ( s'execute des que le fichier est importe)
// --> manipuler le dom quúne fois qu'il est pret
if (document.readyState === 'loading')
{
    document.addEventListener('DOMContentLoaded', () =>
	{
        initializeComponents();
        setupRoomJoinedHandler();
    });
}
else
{
    initializeComponents();
    setupRoomJoinedHandler();
}

export { show, hideAllPages, hide };