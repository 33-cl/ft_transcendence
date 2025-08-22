import { load } from './utils.js';
import { DEV_CONFIG } from '../config/dev.js';

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
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            window.currentUser = data?.user || null;
            
            // Force websocket reconnection after successful auth verification
            if (window.currentUser && (window as any).reconnectWebSocket) {
                (window as any).reconnectWebSocket();
            }
        } else {
            window.currentUser = null;
        }
    } catch {
        window.currentUser = null;
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
                credentials: 'include',
                body: JSON.stringify({ email, username, password })
            });
            
            if (res.status === 201) {
                const data = await res.json().catch(() => ({} as any));
                msg.textContent = 'Account created and signed in successfully!';
                msg.style.color = 'lightgreen';
                (window as any).currentUser = data?.user || null;
                
                // Vérifier la session pour s'assurer que tout est correct
                try { 
                    await fetch('/auth/me', { credentials: 'include' }); 
                } catch {}
                
                // Force websocket reconnection after successful registration
                if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                    console.log('Registration successful, reconnecting websocket with cookies...');
                    (window as any).reconnectWebSocket();
                }
                
                load('mainMenu');
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
                
                // Force websocket reconnection after successful login
                if ((window as any).currentUser && (window as any).reconnectWebSocket) {
                    console.log('Login successful, reconnecting websocket with cookies...');
                    (window as any).reconnectWebSocket();
                }
                
                load('mainMenu'); // laisser le caller gérer la navigation si besoin
            } else {
                msg.textContent = data?.error || 'Login failed.';
                msg.style.color = 'orange';
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

    // Expose simple logout helper
    if (!window.logout) {
        window.logout = async () => {
            try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
            window.currentUser = null;
        };
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
