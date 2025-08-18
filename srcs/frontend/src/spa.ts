import { landingHTML, signInHTML, signUpHTML, leaderboardHTML ,friendListHTML, mainMenuHTML, back2mainHTML, gameHTML, game4HTML, matchmakingHTML, gameFinishedHTML, profileHTML, contextMenuHTML } from './components/index.js';
import { animateDots, switchTips } from './components/matchmaking.js';
import { initPasswordMasking } from './utils/passwordMasking.js';
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
    mainMenu: {id: 'mainMenu', html: mainMenuHTML},
	back2main: {id: 'back2main', html: back2mainHTML},
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
	// Initialisation du masquage des mots de passe avec des astérisques
	initPasswordMasking();
	
	// Affiche la page d'accueil au chargement
	show('landing');

		
	// Ajoute la navigation SPA pour le clic gauche
	document.addEventListener('click', async (e) => {
		const target = e.target as HTMLElement;
		if (!target) return;
		
		// Vérifier si l'élément cliqué ou l'un de ses parents a l'ID profileBtn
		let currentElement: HTMLElement | null = target;
		let isProfileBtn = false;
		
		while (currentElement && !isProfileBtn) {
			if (currentElement.id === 'profileBtn') {
				isProfileBtn = true;
			} else {
				currentElement = currentElement.parentElement;
			}
		}
		
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
		if (target.id === 'local2p')
		{
			await window.joinOrCreateRoom(2, true); // Room locale 1v1 (2 joueurs, mode local)
			hideAllPages();
			show('game');
		}
		if (target.id === 'local4p')
		{
			await window.joinOrCreateRoom(4, true); // Room locale 1v1v1v1 (4 joueurs, mode local)
			hideAllPages();
			show('game4'); // Affiche la page 1v1v1v1
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
		if (target.id === 'profileBtn' || isProfileBtn)
		{
			hideAllPages();
			show('profile');
			show('back2main');
		}
		// ROOM LOGIC
		if (target.id === 'ranked1v1Btn')
		{
			await window.joinOrCreateRoom(2); // 1v1 online (pas de mode local)
			//show('matchmaking');// se fait dans joinorcreateroom
		}
		if (target.id === 'customCreateBtn')
		{
			await window.joinOrCreateRoom(4); // 2v2 (exemple)
			// L'affichage sera géré par le handler roomJoined
		}
		if (target.id === 'customJoinBtn')
		{
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
	
	// Ajoute un gestionnaire pour le clic droit (contextmenu)
	document.addEventListener('contextmenu', (e) => {
		// Empêcher le menu contextuel par défaut du navigateur
		e.preventDefault();
		
		const target = e.target as HTMLElement;
		if (!target) return;
		
		// Vérifier si l'élément cliqué ou l'un de ses parents a l'ID profileBtn
		let currentElement: HTMLElement | null = target;
		let isProfileBtn = false;
		
		while (currentElement && !isProfileBtn) {
			if (currentElement.id === 'profileBtn') {
				isProfileBtn = true;
			} else {
				currentElement = currentElement.parentElement;
			}
		}
		
		// Exemple: action spécifique pour le clic droit sur un profil
		if (isProfileBtn) {

			const menu = document.getElementById('contextMenu');
			if (menu)
			{
				show('contextMenu');

				menu.style.left = `${e.clientX}px`;
				menu.style.top = `${e.clientY}px`;

				console.log('Menu positionné à', menu.style.left, menu.style.top);
			}

		}
	});
	document.addEventListener('click', (e) => {
		const menu = document.getElementById('contextMenu');
		if (!menu) return;
	
		// Si le menu n'est pas affiché, rien à faire
		if (!menu.innerHTML.trim()) return;
	
		// Si le clic est à l'intérieur du menu, ne rien faire
		if (menu.contains(e.target as Node)) return;
	
		// Sinon, masquer le menu contextuel
		hide('contextMenu');
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
            if (data.maxPlayers === 4) {
                show('game4');
            } else {
                show('game');
            }
            return;
        }
        // Toujours afficher l'écran d'attente tant que la room n'est pas pleine
        if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
		{
            if (data.players < data.maxPlayers)
			{
                hideAllPages();
                show('matchmaking');
                animateDots();
                switchTips();
            }            else
			{
                hideAllPages();
                 // Affiche la bonne page de jeu selon le mode (2 ou 4 joueurs)
                if (data.maxPlayers === 4) {
                    show('game4');
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

export { show, hideAllPages, hide };