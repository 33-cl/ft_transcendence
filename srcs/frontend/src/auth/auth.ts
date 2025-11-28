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
    const twoFactorCode = getInputValue('twoFactorCode');

    if (!login || !password) {
        showErrorMessage(msg, 'Enter username/email and password.');
        return;
    }

    // Appeler l'API de login (avec code 2FA si présent)
    const result = await loginUser(login, password, twoFactorCode || undefined);

    if (result.success) {
        showSuccessMessage(msg, 'Signed in.');
        await load('mainMenu');
    } else if (result.requires2FA) {
        // 2FA required - afficher le champ de code
        const twoFactorSection = document.getElementById('twoFactorSection');
        const twoFactorInput = document.getElementById('twoFactorCode') as HTMLInputElement;
        
        if (twoFactorSection && twoFactorInput) {
            twoFactorSection.style.display = 'block';
            twoFactorInput.focus();
            showSuccessMessage(msg, result.message || 'Code sent to your email');
        }
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
    
    // Réinitialiser le champ 2FA si l'utilisateur modifie username ou password
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const twoFactorSection = document.getElementById('twoFactorSection');
    const twoFactorInput = document.getElementById('twoFactorCode') as HTMLInputElement;
    
    const reset2FAField = () => {
        if (twoFactorSection && twoFactorInput) {
            twoFactorSection.style.display = 'none';
            twoFactorInput.value = '';
        }
    };
    
    usernameInput?.addEventListener('input', reset2FAField);
    passwordInput?.addEventListener('input', reset2FAField);

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
        
        let messageReceived = false;
        
        // Écouter les messages de la fenêtre OAuth (2FA requis ou erreur)
        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            messageReceived = true;
            
            if (event.data.type === 'oauth-2fa-required') {
                // L'utilisateur a la 2FA activée, on demande le code
                const tempToken = event.data.tempToken;
                
                // Afficher le formulaire 2FA dans la SPA (pas de nouvelle page)
                showOAuth2FAPrompt(tempToken);
                
                // Cleanup
                window.removeEventListener('message', messageHandler);
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

// Les handlers 2FA ne sont plus nécessaires car intégrés dans le signIn

/**
 * Affiche un prompt pour entrer le code 2FA après OAuth
 */
function showOAuth2FAPrompt(tempToken: string) {
    const msg = document.getElementById('signUpMsg') || document.getElementById('signInMsg');
    if (!msg) return;

    // Créer un formulaire 2FA dynamique
    const container = msg.parentElement;
    if (!container) return;

    // Clear existing message
    msg.textContent = '';
    msg.style.color = '#667eea';

    // Créer le formulaire
    const twoFADiv = document.createElement('div');
    twoFADiv.id = 'oauth-2fa-container';
    twoFADiv.innerHTML = `
        <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">🔐 Two-Factor Authentication</h3>
            <p style="margin: 10px 0; color: #666;">A verification code has been sent to your email.</p>
            <input type="text" id="oauth-2fa-code" placeholder="Enter 6-digit code" maxlength="6" 
                   style="width: 100%; padding: 12px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; text-align: center; letter-spacing: 0.5em;">
            <button id="oauth-2fa-submit" style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-top: 10px;">
                Verify Code
            </button>
            <div id="oauth-2fa-error" style="color: red; margin-top: 10px; display: none;"></div>
        </div>
    `;

    // Insérer après le message
    msg.after(twoFADiv);

    // Focus sur l'input
    const codeInput = document.getElementById('oauth-2fa-code') as HTMLInputElement;
    const submitBtn = document.getElementById('oauth-2fa-submit') as HTMLButtonElement;
    const errorDiv = document.getElementById('oauth-2fa-error') as HTMLDivElement;

    if (codeInput) {
        codeInput.focus();
        
        // Submit on Enter
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn?.click();
            }
        });
    }

    // Handler pour la vérification
    const verifyCode = async () => {
        const code = codeInput?.value.trim();
        
        if (!code || code.length !== 6) {
            if (errorDiv) {
                errorDiv.textContent = 'Please enter a 6-digit code';
                errorDiv.style.display = 'block';
            }
            return;
        }

        // Désactiver le bouton pendant la requête
        if (submitBtn) submitBtn.disabled = true;
        if (errorDiv) errorDiv.style.display = 'none';

        try {
            const response = await fetch('https://localhost:8080/auth/2fa/verify-oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tempToken, code })
            });

            if (response.ok) {
                // Success! Reload to show authenticated state
                msg.textContent = '✅ Authentication successful!';
                msg.style.color = 'green';
                twoFADiv.remove();
                
                setTimeout(() => window.location.reload(), 1000);
            } else {
                const data = await response.json();
                if (errorDiv) {
                    errorDiv.textContent = data.error || 'Invalid verification code';
                    errorDiv.style.display = 'block';
                }
                if (submitBtn) submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error verifying OAuth 2FA code:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
            if (submitBtn) submitBtn.disabled = false;
        }
    };

    submitBtn?.addEventListener('click', verifyCode);
}

// Expose refreshUserStats globally for post-game stats refresh
(window as any).refreshUserStats = refreshUserStats;
