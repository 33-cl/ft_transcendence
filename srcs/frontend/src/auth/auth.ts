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

// Stockage sécurisé des credentials 2FA (privé au module, non exposé dans window)
let pending2FACredentials: { login: string; password: string } | null = null;
let pendingOAuth2FAToken: string | null = null;

// Fonctions d'accès sécurisées pour les credentials login
function setPending2FACredentials(login: string, password: string): void {
    pending2FACredentials = { login, password };
}

function getPending2FACredentials(): { login: string; password: string } | null {
    return pending2FACredentials;
}

function clearPending2FACredentials(): void {
    pending2FACredentials = null;
}

// Fonctions d'accès sécurisées pour le token OAuth 2FA
function setPendingOAuth2FAToken(token: string): void {
    pendingOAuth2FAToken = token;
}

function getPendingOAuth2FAToken(): string | null {
    return pendingOAuth2FAToken;
}

function clearPendingOAuth2FAToken(): void {
    pendingOAuth2FAToken = null;
}

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
            if (window.currentUser && window.reconnectWebSocket)
                window.reconnectWebSocket();

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
    } else if (result.requires2FA) {
        // 2FA required - stocker les credentials de manière sécurisée (non exposé dans window)
        setPending2FACredentials(login, password);
        // Rediriger directement vers la page 2FA
        await load('twoFactor');
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

/**
 * Gestionnaire pour la page 2FA (vérification du code)
 */
async function handleVerify2FA(): Promise<void> {
    const msg = ensureMessageElement('twoFactorMsg', 'verifyCodeButton');
    
    const twoFactorCode = getInputValue('twoFactorCode');
    
    if (!twoFactorCode || twoFactorCode.length !== 6) {
        showErrorMessage(msg, 'Please enter a valid 6-digit code.');
        return;
    }
    
    // Vérifier si c'est une vérification OAuth ou login classique
    const oauthTempToken = getPendingOAuth2FAToken();
    const credentials = getPending2FACredentials();
    
    if (oauthTempToken) {
        // Mode OAuth - appeler l'endpoint de vérification OAuth
        try {
            const response = await fetch('https://localhost:8080/auth/2fa/verify-oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tempToken: oauthTempToken, code: twoFactorCode.trim() })
            });

            if (response.ok) {
                const data = await response.json();
                // Nettoyer les données OAuth stockées de manière sécurisée
                clearPendingOAuth2FAToken();
                
                // Stocker l'utilisateur globalement
                if (data.user) {
                    window.currentUser = data.user;
                }
                
                // Reconnecter le WebSocket avec les nouveaux credentials
                if (window.reconnectWebSocket) {
                    window.reconnectWebSocket();
                }
                
                showSuccessMessage(msg, 'Signed in.');
                // Naviguer vers le menu principal (comme pour le login classique)
                await load('mainMenu');
            } else {
                const data = await response.json();
                showErrorMessage(msg, data.error || 'Invalid verification code.');
            }
        } catch (error) {
            console.error('Error verifying OAuth 2FA code:', error);
            showErrorMessage(msg, 'Network error. Please try again.');
        }
    } else if (credentials) {
        // Mode login classique - appeler l'API de login avec le code 2FA
        console.log('🔐 2FA: Calling loginUser with code...');
        const result = await loginUser(credentials.login, credentials.password, twoFactorCode);
        console.log('🔐 2FA: loginUser result:', result);
        
        if (result.success) {
            // Nettoyer les credentials stockés de manière sécurisée
            clearPending2FACredentials();
            showSuccessMessage(msg, 'Signed in.');
            console.log('🔐 2FA: Login successful, navigating to mainMenu...');
            await load('mainMenu');
            console.log('🔐 2FA: Navigation to mainMenu complete');
        } else {
            showErrorMessage(msg, result.error || 'Invalid verification code.');
        }
    } else {
        // Aucune session 2FA en cours
        showErrorMessage(msg, 'Session expired. Please sign in again.');
        setTimeout(() => load('signIn'), 1500);
    }
}

// Handler pour la page 2FA
document.addEventListener('componentsReady', () => {
    // Verify button
    const verifyBtn = document.getElementById('verifyCodeButton');
    if (verifyBtn && !(verifyBtn as any)._bound) {
        (verifyBtn as any)._bound = true;
        verifyBtn.addEventListener('click', handleVerify2FA);
        
        // Ajouter event listener pour la touche Entrée
        addEnterKeyListeners(['twoFactorCode'], () => verifyBtn.click());
    }
    
    // Cancel button - retour à signIn
    const cancelBtn = document.getElementById('cancel2FABtn');
    if (cancelBtn && !(cancelBtn as any)._bound) {
        (cancelBtn as any)._bound = true;
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Nettoyer les données stockées (OAuth ou login classique) de manière sécurisée
            clearPending2FACredentials();
            clearPendingOAuth2FAToken();
            load('signIn');
        });
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
        
        let messageReceived = false;
        let twoFARedirected = false;
        
        // Écouter les messages de la fenêtre OAuth (2FA requis ou erreur)
        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            // Éviter les doubles traitements
            if (messageReceived) return;
            messageReceived = true;
            
            if (event.data.type === 'oauth-2fa-required') {
                // L'utilisateur a la 2FA activée - stocker le tempToken de manière sécurisée (non exposé dans window)
                const tempToken = event.data.tempToken;
                setPendingOAuth2FAToken(tempToken);
                
                // Cleanup
                window.removeEventListener('message', messageHandler);
                
                // Rediriger vers la page 2FA (une seule fois)
                if (!twoFARedirected) {
                    twoFARedirected = true;
                    load('twoFactor');
                }
            } else if (event.data.type === 'oauth-error') {
                // Erreur lors de l'OAuth
                const msg = document.getElementById('signUpMsg') || document.getElementById('signInMsg');
                if (msg) {
                    msg.textContent = event.data.error || 'Authentication error. Please try again.';
                    msg.style.color = 'red';
                }
                window.removeEventListener('message', messageHandler);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        const checkInterval = setInterval(() => {
            if (authWindow?.closed) {
                clearInterval(checkInterval);
                window.removeEventListener('message', messageHandler);
                
                // Si un message 2FA a été reçu, ne pas recharger (on attend la saisie du code)
                // Sinon, recharger pour afficher l'état authentifié
                if (!messageReceived) {
                    setTimeout(() => window.location.reload(), 500);
                }
            }
        }, 500);
    });
});

// Expose refreshUserStats globally for post-game stats refresh
window.refreshUserStats = refreshUserStats;
