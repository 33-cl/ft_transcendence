import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, gameHTML, game3HTML, matchmakingHTML } from './components/index.js';
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
    landing: {id: 'landing', html: landingHTML},
    mainMenu:{id: 'mainMenu', html: mainMenuHTML},
    leaderboard: {id: 'leaderboard', html: leaderboardHTML},
    friendList: {id: 'friendList', html: friendListHTML},
	matchmaking: {id: 'matchmaking', html: matchmakingHTML},
    game: {id: 'game', html: gameHTML},
    signIn: {id: 'signIn', html: signInHTML},
    signUp: {id: 'signUp', html: signUpHTML},
	game3: {id: 'game3',html: game3HTML}
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
		if (target.id === 'guestBtn')
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
		if (target.id === 'local2p')
		{
			(window as any).setIsLocalGame(true); // Active le mode local
			await window.joinOrCreateRoom(2, true); // Room locale 1v1 (2 joueurs, mode local)
			hideAllPages();
			show('game');
		}
		if (target.id === 'local3p')
		{
			(window as any).setIsLocalGame(true); // Active le mode local
			await window.joinOrCreateRoom(3, true); // Room locale 1v1v1 (3 joueurs, mode local)
			hideAllPages();
			show('game3'); // Affiche la page 1v1v1
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
			//show ('matchmaking') se fait dans joinorcreateroom
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
        // Si mode local, on affiche directement la page de jeu
        if (window.isLocalGame) {
            hideAllPages();
            if (data.maxPlayers === 3) {
                show('game3');
            } else {
                show('game');
            }
            return;
        }
        // Toujours afficher l'écran d'attente tant que la room n'est pas pleine (mode online)
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
                // Affiche la bonne page de jeu selon le mode (2 ou 3 joueurs)
                if (data.maxPlayers === 3) {
                    show('game3');
                } else {
                    show('game');
                }
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