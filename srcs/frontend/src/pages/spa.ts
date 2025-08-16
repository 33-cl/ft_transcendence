import { initPasswordMasking } from '../utils/passwordMasking.js';
import { show, load , hideAllPages, hide } from './utils.js';
// import { waitForSocketConnection } from './utils/socketLoading.js';

// Declare global interface for Window
declare global {
    interface Window {
        socket?: any;
        _roomJoinedHandlerSet?: boolean;
        // ... do not redeclare currentUser/logout here; defined in global.d.ts
    }
}

// Helper simple et lisible pour valider un email (pas RFC, juste basique)
function isValidEmailSimple(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    if (email.includes(' ')) return false;
    const at = email.indexOf('@');
    if (at <= 0 || at !== email.lastIndexOf('@')) return false; // une seule @ et pas en 1ère position
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot <= 0 || dot === domain.length - 1) return false; // au moins un . dans le domaine, pas en fin
    return true;
}

async function checkSessionOnce() {
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            window.currentUser = data?.user || null;
        } else {
            window.currentUser = null;
        }
    } catch {
        window.currentUser = null;
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

// Handler d'inscription (léger, indépendant du jeu)
document.addEventListener('componentsReady', () => {
    const btn = document.getElementById('signUpSubmit');
    if (!btn || (btn as any)._bound) return;
    (btn as any)._bound = true;

    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const ensureMsg = () => {
        let el = document.getElementById('signUpMsg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'signUpMsg';
            el.style.marginTop = '8px';
            const container = document.getElementById('signUpSubmit')?.parentElement;
            container?.appendChild(el);
        }
        return el!;
    };

    btn.addEventListener('click', async () => {
        const username = getEl('username')?.value?.trim() || '';
        const email = getEl('email')?.value?.trim() || '';
        const password = getEl('password')?.value || '';
        const confirm = getEl('confirmPassword')?.value || '';
        const msg = ensureMsg();
        
        // Validations simples
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            msg.textContent = 'Invalid username (3-20, alphanumeric and underscore).';
            msg.style.color = 'orange';
            return;
        }
        if (!isValidEmailSimple(email)) {
            msg.textContent = 'Invalid email.';
            msg.style.color = 'orange';
            return;
        }
        if (password.length < 8) {
            msg.textContent = 'Password too short (min 8).';
            msg.style.color = 'orange';
            return;
        }
        if (password !== confirm) {
            msg.textContent = 'Passwords do not match.';
            msg.style.color = 'orange';
            return;
        }

        try {
            const res = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });
            if (res.status === 201) {
                msg.textContent = 'Registration successful. You can sign in.';
                msg.style.color = 'lightgreen';
                // Optionnel: rediriger vers Sign in
                // load('signIn');
            } else {
                const data = await res.json().catch(() => ({} as any));
                msg.textContent = data?.error || 'Registration error.';
                msg.style.color = 'orange';
            }
        } catch (e) {
            msg.textContent = 'Cannot reach server.';
            msg.style.color = 'orange';
        }
    });
});

// Handler de connexion (Sign in)
document.addEventListener('componentsReady', () => {
    const btn = document.getElementById('signIn');
    if (!btn || (btn as any)._bound) return;
    (btn as any)._bound = true;

    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const ensureMsg = () => {
        let el = document.getElementById('signInMsg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'signInMsg';
            el.style.marginTop = '8px';
            const container = (document.getElementById('signIn') as HTMLElement)?.parentElement;
            container?.appendChild(el);
        }
        return el!;
    };

    btn.addEventListener('click', async () => {
        const login = getEl('username')?.value?.trim() || '';
        const password = getEl('password')?.value || '';
        const msg = ensureMsg();

        if (!login || !password) {
            msg.textContent = 'Enter username/email and password.';
            msg.style.color = 'orange';
            return;
        }

        try {
            const res = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ login, password })
            });
            const data = await res.json().catch(() => ({} as any));
            if (res.ok) {
                msg.textContent = 'Signed in.';
                msg.style.color = 'lightgreen';
                (window as any).currentUser = data?.user || null;
                // Optionnel: vérifier la session côté serveur
                try { await fetch('/auth/me', { credentials: 'include' }); } catch {}
                load('mainMenu');
            } else {
                msg.textContent = data?.error || 'Login failed.';
                msg.style.color = 'orange';
            }
        } catch (e) {
            msg.textContent = 'Cannot reach server.';
            msg.style.color = 'orange';
        }
    });

    // Expose simple logout helper
    if (!window.logout) {
        window.logout = async () => {
            try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
            window.currentUser = null;
        };
    }
});

window.addEventListener('popstate', function(event) {
    if (event.state?.page) {
        // Charge la page sans mettre à jour l'historique
        load(event.state.page, false);
    } else {
        // Page par défaut si aucun état n'est sauvegardé
        load('landing', false);
    }
});

// top level statemetn ( s'execute des que le fichier est importe)
// --> manipuler le dom quúne fois qu'il est pret
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