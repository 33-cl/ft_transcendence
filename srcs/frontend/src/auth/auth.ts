import { load } from '../navigation/utils.js';
import { isSessionBlocked, markSessionActive, markSessionInactive } from '../navigation/sessionBroadcast.js';
import { guardFunction } from '../navigation/securityGuard.js';
import { validateRegisterInputs } from '../services/validation.client.js';
import { registerUser, loginUser, logoutUser } from '../services/auth.client.service.js';
import { 
    getInputValue, 
    getPasswordValue, 
    ensureMessageElement, 
    showSuccessMessage, 
    showErrorMessage, 
    showCriticalError,
    addEnterKeyListeners 
} from '../shared/ui/ui.helpers.js';

export async function checkSessionOnce() {
    if (isSessionBlocked())
    {
        window.currentUser = null;
        return;
    }
    
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok)
        {
            const data = await res.json();
            window.currentUser = data?.user || null;
            
            // Mark this tab as having an active session
            if (window.currentUser) {
                markSessionActive();
            }
            
            // Force websocket reconnection after successful auth verification
            if (window.currentUser && (window as any).reconnectWebSocket)
                (window as any).reconnectWebSocket();

        }
        else
        {
            window.currentUser = null;
            markSessionInactive();
        }
    }
    catch
    {
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

/**
 * Gestionnaire pour le bouton SignUp (inscription)
 */
async function handleSignUp(): Promise<void> {
    const msg = ensureMessageElement('signUpMsg', 'signUpSubmit');

    if (isSessionBlocked())
    {
        showCriticalError(msg, 'Cannot register: A session is already active in another tab.');
        return;
    }

    const username = getInputValue('username');
    const email = getInputValue('email');
    const password = getPasswordValue('password');
    const confirmPassword = getPasswordValue('confirmPassword');

    // Valider les inputs
    const validation = validateRegisterInputs({ username, email, password, confirmPassword });
    if (!validation.valid)
    {
        showErrorMessage(msg, validation.error!);
        return;
    }

    // Appeler l'API de registration
    const result = await registerUser(email, username, password);

    if (result.success) {
        showSuccessMessage(msg, 'Account created and signed in successfully!');
        await load('mainMenu');
    } else {
        showErrorMessage(msg, result.error!);
    }
}

// Handlers d'inscription (SignUp) et connexion (SignIn)
document.addEventListener('componentsReady', () => {
    // SignUp
    const btnUp = document.getElementById('signUpSubmit');
    if (!btnUp || (btnUp as any)._bound) return;
    (btnUp as any)._bound = true;

    btnUp.addEventListener('click', handleSignUp);

    // Ajouter event listeners pour la touche Entrée sur les champs SignUp
    addEnterKeyListeners(['username', 'email', 'password', 'confirmPassword'], () => btnUp.click());
});

/**
 * Gestionnaire pour le bouton SignIn (connexion)
 */
async function handleSignIn(): Promise<void> {
    const msg = ensureMessageElement('signInMsg', 'signInButton');

    // Vérifier si une session est bloquée par un autre onglet
    if (isSessionBlocked()) {
        showCriticalError(msg, 'Cannot login: A session is already active in another tab.');
        return;
    }

    // Récupérer les valeurs des inputs
    const login = getInputValue('username');
    const password = getPasswordValue('password');

    if (!login || !password) {
        showErrorMessage(msg, 'Enter username/email and password.');
        return;
    }

    // Appeler l'API de login
    const result = await loginUser(login, password);

    if (result.success) {
        showSuccessMessage(msg, 'Signed in.');
        await load('mainMenu');
    } else {
        // Gérer spécifiquement l'erreur de connexion multiple
        if (result.code === 'USER_ALREADY_CONNECTED') {
            showCriticalError(msg, 'This account is already connected elsewhere.');
        } else {
            showErrorMessage(msg, result.error!);
        }
    }
}

document.addEventListener('componentsReady', () => {
    // SignIn
    const btnIn = document.getElementById('signInButton');
    if (!btnIn || (btnIn as any)._bound) return;
    (btnIn as any)._bound = true;

    btnIn.addEventListener('click', handleSignIn);

    // Ajouter event listeners pour la touche Entrée sur les champs SignIn
    addEnterKeyListeners(['username', 'password'], () => btnIn.click());

    // Expose simple logout helper with security guard
    if (!window.logout) {
        // Wrap with security guard to prevent execution in blocked tabs
        // requiresAuth = true to ensure user is authenticated before logout
        window.logout = guardFunction(logoutUser, 'logout', true);
    }
});

document.addEventListener('componentsReady', () => {
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    if (!googleAuthBtn || (googleAuthBtn as any)._bound) return;
    (googleAuthBtn as any)._bound = true;

    googleAuthBtn.addEventListener('click', () => {

        if (isSessionBlocked()) {
            const msg = document.getElementById('signUpMsg');
            if (msg) {
                msg.textContent = 'Cannot authenticate: A session is already active in another tab.';
                msg.style.color = 'red';
            }
            return;
        }

        const authWindow = window.open('https://localhost:8080/auth/google', '_blank', 'width=500,height=600');
        
        const checkInterval = setInterval(() => {
            if (authWindow?.closed) {
                clearInterval(checkInterval);
                window.location.reload();
            }
        }, 500);
    });
});

// Expose refreshUserStats globally for post-game stats refresh
(window as any).refreshUserStats = refreshUserStats;
