import { initPasswordMasking } from '../utils/passwordMasking.js';
import { show, load , hideAllPages, hide } from './utils.js';
import { checkSessionOnce } from './auth.js'; // <- import moved function
// import { waitForSocketConnection } from './utils/socketLoading.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
        _roomJoinedHandlerSet?: boolean;
        // ... do not redeclare currentUser/logout here; defined in global.d.ts
    }
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
            load('mainMenu');
        if (target.id === 'local2p')
        {
            await window.joinOrCreateRoom(2, true);
            load('game'); 
        }
        if (target.id === 'local3p')
        {
            await window.joinOrCreateRoom(3, true);
            load('game3');
        }
        if (target.id === 'signInBtn')
            load('signIn');
        if (target.id === 'signUpBtn')        
            load('signUp');
        if (target.id === 'profileBtn' || isProfileBtn)
            load('profile');

        // MULTIPLAYER
        if (target.id === 'ranked1v1Btn')
            await window.joinOrCreateRoom(2);
        if (target.id === 'customCreateBtn')
            await window.joinOrCreateRoom(4);
        if (target.id === 'customJoinBtn')
            await window.joinOrCreateRoom(4);
        if (target.id === 'cancelSearchBtn')
        {
            if (window.socket) window.socket.emit('leaveAllRooms');
            load('mainMenu');
        }

        // TEST
        if (target.id === 'tournamentJoinBtn')
        {
            load('matchmaking');
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
            if (data.maxPlayers === 3) {
                show('game3');
            } else {
                show('game');
            }
            return;
        }
        // Toujours afficher l'écran d'attente tant que la room n'est pas pleine
        if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
        {
            if (data.players < data.maxPlayers)
                load('matchmaking');
            else
            {
                if (data.maxPlayers === 3) {
                    load('game3');
                } else {
                    load('game');
                }
            }
        }
    });
}


window.addEventListener('popstate', function(event) {
    if (event.state?.page) {
        // Charge la page sans mettre à jour l'historique
        load(event.state.page, false);
    } else {
        // Page par défaut si aucun état n'est sauvegardé
        load('landing', false);
    }
});

// // top level statemetn ( s'execute des que le fichier est importe)
// // --> manipuler le dom quúne fois qu'il est pret
if (document.readyState === 'loading')
{
    document.addEventListener('DOMContentLoaded', async () =>
    {
        await checkSessionOnce();
        initializeComponents();
        setupRoomJoinedHandler();
    });
}
else
{
    (async () => {
        await checkSessionOnce();
        initializeComponents();
        setupRoomJoinedHandler();
    })();
}

export { show, hideAllPages, hide };