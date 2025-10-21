import { load } from './utils.js';
import { DEV_CONFIG } from '../config/dev.js';
import { broadcastSessionCreated, broadcastSessionDestroyed, isSessionBlocked, markSessionActive, markSessionInactive } from '../utils/sessionBroadcast.js';
import { guardFunction } from '../utils/securityGuard.js';

function isValidEmailSimple(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    if (email.includes(' ')) return false;
    const at = email.indexOf('@');
    if (at <= 0 || at !== email.lastIndexOf('@')) return false;
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot <= 0 || dot === domain.length - 1) return false;
    return true;
}

export async function checkSessionOnce() {
    // 🚨 SECURITY: Don't check session if this tab is blocked
    if (isSessionBlocked()) {
        console.log('🚫 Security: checkSessionOnce blocked - Tab does not have active session');
        window.currentUser = null;
        return;
    }
    
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            window.currentUser = data?.user || null;
            
            // Mark this tab as having an active session
            if (window.currentUser) {
                markSessionActive();
            }
            
            // Force websocket reconnection after successful auth verification
            if (window.currentUser && (window as any).reconnectWebSocket) {
                (window as any).reconnectWebSocket();
            }
        } else {
            window.currentUser = null;
            markSessionInactive();
        }
    } catch {
        window.currentUser = null;
        markSessionInactive();
    }
}

// Function to refresh user stats after a game
export async function refreshUserStats() {
    if (!window.currentUser) return false;
    
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const newUser = data?.user;
            if (newUser && newUser.id === window.currentUser.id) {
                const oldWins = window.currentUser.wins || 0;
                const oldLosses = window.currentUser.losses || 0;
                
                window.currentUser = newUser;
                
                // Log if stats changed
                if (newUser.wins !== oldWins || newUser.losses !== oldLosses) {
                    return true; // Stats changed
                }
            }
        }
        return false; // No change
    } catch (error) {
        console.error('Failed to refresh user stats:', error);
        return false;
    }
}

// Handlers d'inscription (SignUp) et connexion (SignIn)
document.addEventListener('componentsReady', () => {
    // SignUp
    const btnUp = document.getElementById('signUpSubmit');
    if (!btnUp || (btnUp as any)._bound) return;
    (btnUp as any)._bound = true;

    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const ensureMsgUp = () => {
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

    btnUp.addEventListener('click', async () => {
        const username = getEl('username')?.value?.trim() || '';
        const email = getEl('email')?.value?.trim() || '';
        const password = getEl('password')?.value || '';
        const confirm = getEl('confirmPassword')?.value || '';
        const msg = ensureMsgUp();

        // Check if session is blocked by another tab
        if (isSessionBlocked()) {
            msg.textContent = 'Cannot register: A session is already active in another tab.';
            msg.style.color = 'red';
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,10}$/.test(username)) {
            msg.textContent = 'Invalid username (3-10 characters, alphanumeric and underscore).';
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
                credentials: 'include',
                body: JSON.stringify({ email, username, password })
            });
            
            if (res.status === 201) {
                const data = await res.json().catch(() => ({} as any));
                msg.textContent = 'Account created and signed in successfully!';
                msg.style.color = 'lightgreen';
                (window as any).currentUser = data?.user || null;
                
                // Mark this tab as having an active session
                markSessionActive();
                
                // Vérifier la session pour s'assurer que tout est correct
                try { 
                    await fetch('/auth/me', { credentials: 'include' }); 
                } catch {}
                
                // Broadcast session creation to other tabs
                broadcastSessionCreated();
                
                // Force websocket reconnection after successful registration
                if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                    (window as any).reconnectWebSocket();
                }
                
                await load('mainMenu');
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

    // Ajouter event listeners pour la touche Entrée sur les champs SignUp
    const signUpInputs = ['username', 'email', 'password', 'confirmPassword'];
    signUpInputs.forEach(inputId => {
        const input = getEl(inputId);
        if (input && !(input as any)._enterBound) {
            (input as any)._enterBound = true;
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btnUp.click();
                }
            });
        }
    });
});

document.addEventListener('componentsReady', () => {
    // SignIn
    const btnIn = document.getElementById('signInButton');
    if (!btnIn || (btnIn as any)._bound) return;
    (btnIn as any)._bound = true;

    const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    const ensureMsg = () => {
        let el = document.getElementById('signInMsg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'signInMsg';
            el.style.marginTop = '8px';
            const container = (document.getElementById('signInButton') as HTMLElement)?.parentElement;
            container?.appendChild(el);
        }
        return el!;
    };

    btnIn.addEventListener('click', async () => {
        const login = getEl('username')?.value?.trim() || '';
        const password = getEl('password')?.value || '';
        const msg = ensureMsg();

        // Check if session is blocked by another tab
        if (isSessionBlocked()) {
            msg.textContent = 'Cannot login: A session is already active in another tab.';
            msg.style.color = 'red';
            return;
        }

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
                try { await fetch('/auth/me', { credentials: 'include' }); } catch {}
                
                // Mark this tab as having an active session
                markSessionActive();
                
                // Broadcast session creation to other tabs
                broadcastSessionCreated();
                
                // Force websocket reconnection after successful login
                if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                    (window as any).reconnectWebSocket();
                }
                
                await load('mainMenu'); // laisser le caller gérer la navigation si besoin
            } else {
                // Gérer spécifiquement l'erreur de connexion multiple
                if (data?.code === 'USER_ALREADY_CONNECTED') {
                    msg.textContent = 'This account is already connected elsewhere.';
                    msg.style.color = 'red';
                } else {
                    msg.textContent = data?.error || 'Login failed.';
                    msg.style.color = 'orange';
                }
            }
        } catch (e) {
            msg.textContent = 'Cannot reach server.';
            msg.style.color = 'orange';
        }
    });

    // Ajouter event listeners pour la touche Entrée sur les champs SignIn
    const signInInputs = ['username', 'password'];
    signInInputs.forEach(inputId => {
        const input = getEl(inputId);
        if (input && !(input as any)._enterBound) {
            (input as any)._enterBound = true;
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btnIn.click();
                }
            });
        }
    });

    // Expose simple logout helper with security guard
    if (!window.logout) {
        // Internal logout implementation
        const logoutImpl = async () => {
            try { 
                await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); 
            } catch {}
            window.currentUser = null;
            // Mark this tab as not having a session
            markSessionInactive();
            // Broadcast session destruction to other tabs
            broadcastSessionDestroyed();
        };
        
        // Wrap with security guard to prevent execution in blocked tabs
        // requiresAuth = true to ensure user is authenticated before logout
        window.logout = guardFunction(logoutImpl, 'logout', true);
    }
});

// DEV ONLY: Handler pour le bouton Skip Login
document.addEventListener('componentsReady', () => {
    if (!DEV_CONFIG.SKIP_LOGIN_ENABLED) return; // Skip si désactivé en configuration
    
    const skipBtn = document.getElementById('skipLoginBtn');
    if (!skipBtn || (skipBtn as any)._bound) return;
    (skipBtn as any)._bound = true;

    skipBtn.addEventListener('click', async () => {
        // Utiliser l'utilisateur de test défini dans la configuration
        window.currentUser = { ...DEV_CONFIG.DEV_USER };
        
        // Afficher un message de confirmation
        const msg = document.getElementById('signInMsg');
        if (msg) {
            msg.textContent = `Logged in as ${DEV_CONFIG.DEV_USER.username} (bypassed auth)`;
            msg.style.color = 'lightgreen';
        }
        
        // Rediriger vers le menu principal
        setTimeout(() => {
            load('mainMenu');
        }, 500);
    });
});

// Expose refreshUserStats globally for post-game stats refresh
(window as any).refreshUserStats = refreshUserStats;
