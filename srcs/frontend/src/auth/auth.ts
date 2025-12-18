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

// Internal storage for 2FA credentials to keep them isolated from the global window scope.
let pending2FACredentials: { login: string; password: string } | null = null;
let pendingOAuth2FAToken: string | null = null;

// Store temporary login credentials needed for the subsequent 2FA verification step.
function setPending2FACredentials(login: string, password: string): void
{
    pending2FACredentials = { login, password };
}

// Retrieve the stored credentials to finalize the login process.
function getPending2FACredentials(): { login: string; password: string } | null
{
    return pending2FACredentials;
}

// Wipe stored credentials from memory after successful authentication or cancellation.
function clearPending2FACredentials(): void
{
    pending2FACredentials = null;
}

// Store the temporary token provided by the OAuth provider for 2FA verification.
function setPendingOAuth2FAToken(token: string): void
{
    pendingOAuth2FAToken = token;
}

// Retrieve the temporary OAuth token.
function getPendingOAuth2FAToken(): string | null
{
    return pendingOAuth2FAToken;
}

// Wipe the OAuth token from memory.
function clearPendingOAuth2FAToken(): void
{
    pendingOAuth2FAToken = null;
}

// Verify the session status with the backend and manage tab synchronization state.
export async function checkSessionOnce()
{
    if (isSessionBlocked())
    {
        window.currentUser = null;
        return;
    }

    try
    {
        const res = await fetch('/auth/me', { credentials: 'include' });

        if (res.ok)
        {
            const data = await res.json();
            window.currentUser = data?.user || null;

            // If a valid user is returned, flag this tab as the active session owner.
            if (window.currentUser)
                markSessionActive();

            // Re-establish the WebSocket connection now that authentication is confirmed.
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

// Fetch the latest user statistics from the server to ensure UI data consistency.
export async function refreshUserStats()
{
    if (!window.currentUser)
        return false;

    try
    {
        const res = await fetch('/auth/me', { credentials: 'include' });

        if (res.ok)
        {
            const data = await res.json();
            const newUser = data?.user;

            if (newUser && newUser.id === window.currentUser.id)
            {
                const oldWins = window.currentUser.wins || 0;
                const oldLosses = window.currentUser.losses || 0;

                window.currentUser = newUser;

                // Return true only if the win/loss record has changed.
                if (newUser.wins !== oldWins || newUser.losses !== oldLosses)
                    return true;
            }
        }
        return false;
    }
    catch (error)
    {
        return false;
    }
}

// Process the user registration form submission.
async function handleSignUp(): Promise<void>
{
    const msg = ensureMessageElement('signUpMsg', 'signUpSubmit');

    // Prevent registration if the tab is blocked by another active session.
    if (isSessionBlocked())
    {
        showCriticalError(msg, 'Cannot register: A session is already active in another tab.');
        return;
    }

    const username = getInputValue('username');
    const email = getInputValue('email');
    const password = getPasswordValue('password');
    const confirmPassword = getPasswordValue('confirmPassword');

    // Validate all input fields before sending the request.
    const validation = validateRegisterInputs({ username, email, password, confirmPassword });

    if (!validation.valid)
    {
        showErrorMessage(msg, validation.error!);
        return;
    }

    // Execute the registration request against the API.
    const result = await registerUser(email, username, password);

    if (result.success)
    {
        showSuccessMessage(msg, 'Account created and signed in successfully!');
        await load('mainMenu');
    }
    else
    {
        showErrorMessage(msg, result.error!);
    }
}

// Initialize event listeners for the registration interface.
document.addEventListener('componentsReady', () =>
{
    const btnUp = document.getElementById('signUpSubmit');

    if (!btnUp || (btnUp as any)._bound)
        return;

    (btnUp as any)._bound = true;

    btnUp.addEventListener('click', handleSignUp);

    // Bind the Enter key to trigger the registration submission.
    addEnterKeyListeners(['username', 'email', 'password', 'confirmPassword'], () => btnUp.click());
});

// Process the user login form submission.
async function handleSignIn(): Promise<void>
{
    const msg = ensureMessageElement('signInMsg', 'signInButton');

    // Prevent login if the tab is blocked by another active session.
    if (isSessionBlocked())
    {
        showCriticalError(msg, 'Cannot login: A session is already active in another tab.');
        return;
    }

    const login = getInputValue('username');
    const password = getPasswordValue('password');

    if (!login || !password)
    {
        showErrorMessage(msg, 'Enter username/email and password.');
        return;
    }

    // Execute the login request against the API.
    const result = await loginUser(login, password);

    if (result.success)
    {
        showSuccessMessage(msg, 'Signed in.');
        await load('mainMenu');
    }
    else if (result.requires2FA)
    {
        // Store credentials locally and redirect to the 2FA verification view.
        setPending2FACredentials(login, password);
        await load('twoFactor');
    }
    else
    {
        // Handle specific error codes for better user feedback.
        if (result.code === 'USER_ALREADY_CONNECTED')
            showCriticalError(msg, 'This account is already connected elsewhere.');
        else
            showErrorMessage(msg, result.error!);
    }
}

// Initialize event listeners for the login interface and expose the logout function.
document.addEventListener('componentsReady', () =>
{
    const btnIn = document.getElementById('signInButton');

    if (!btnIn || (btnIn as any)._bound)
        return;

    (btnIn as any)._bound = true;

    btnIn.addEventListener('click', handleSignIn);

    // Bind the Enter key to trigger the login submission.
    addEnterKeyListeners(['username', 'password'], () => btnIn.click());

    // Securely expose the logout function globally, ensuring it respects tab blocking rules.
    if (!window.logout)
        window.logout = guardFunction(logoutUser, 'logout', true);
});

// Process the 2FA code verification submission.
async function handleVerify2FA(): Promise<void>
{
    const msg = ensureMessageElement('twoFactorMsg', 'verifyCodeButton');
    const twoFactorCode = getInputValue('twoFactorCode');

    if (!twoFactorCode || twoFactorCode.length !== 6)
    {
        showErrorMessage(msg, 'Please enter a valid 6-digit code.');
        return;
    }

    const oauthTempToken = getPendingOAuth2FAToken();
    const credentials = getPending2FACredentials();

    if (oauthTempToken)
    {
        // Handle 2FA verification for OAuth flows using the temporary token.
        try
        {
            const response = await fetch('https://localhost:8080/auth/2fa/verify-oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tempToken: oauthTempToken, code: twoFactorCode.trim() })
            });

            if (response.ok)
            {
                const data = await response.json();
                clearPendingOAuth2FAToken();

                if (data.user)
                    window.currentUser = data.user;

                if (window.reconnectWebSocket)
                    window.reconnectWebSocket();

                showSuccessMessage(msg, 'Signed in.');
                await load('mainMenu');
            }
            else
            {
                const data = await response.json();
                showErrorMessage(msg, data.error || 'Invalid verification code.');
            }
        }
        catch (error)
        {
            showErrorMessage(msg, 'Network error. Please try again.');
        }
    }
    else if (credentials)
    {
        // Handle 2FA verification for standard login flows using stored credentials.
        const result = await loginUser(credentials.login, credentials.password, twoFactorCode);

        if (result.success)
        {
            clearPending2FACredentials();
            showSuccessMessage(msg, 'Signed in.');
            await load('mainMenu');
        }
        else
        {
            showErrorMessage(msg, result.error || 'Invalid verification code.');
        }
    }
    else
    {
        showErrorMessage(msg, 'Session expired. Please sign in again.');
        setTimeout(() => load('signIn'), 1500);
    }
}

// Initialize event listeners for the 2FA verification interface.
document.addEventListener('componentsReady', () =>
{
    const verifyBtn = document.getElementById('verifyCodeButton');

    if (verifyBtn && !(verifyBtn as any)._bound)
    {
        (verifyBtn as any)._bound = true;
        verifyBtn.addEventListener('click', handleVerify2FA);
        addEnterKeyListeners(['twoFactorCode'], () => verifyBtn.click());
    }

    const cancelBtn = document.getElementById('cancel2FABtn');

    if (cancelBtn && !(cancelBtn as any)._bound)
    {
        (cancelBtn as any)._bound = true;
        cancelBtn.addEventListener('click', (e) =>
        {
            e.preventDefault();
            clearPending2FACredentials();
            clearPendingOAuth2FAToken();
            load('signIn');
        });
    }
});

// Initialize event listeners for the OAuth (Google) authentication button.
document.addEventListener('componentsReady', () =>
{
    const googleAuthBtn = document.getElementById('googleAuthBtn');

    if (!googleAuthBtn || (googleAuthBtn as any)._bound)
        return;

    (googleAuthBtn as any)._bound = true;

    googleAuthBtn.addEventListener('click', () =>
    {
        if (isSessionBlocked())
        {
            const msg = document.getElementById('signUpMsg');
            if (msg)
            {
                msg.textContent = 'Cannot authenticate: A session is already active in another tab.';
                msg.style.color = 'red';
            }
            return;
        }

        const authWindow = window.open('https://localhost:8080/auth/google', '_blank', 'width=500,height=600');
        let messageReceived = false;
        let twoFARedirected = false;

        // Listen for messages from the OAuth popup regarding success or 2FA requirements.
        const messageHandler = (event: MessageEvent) =>
        {
            if (event.origin !== window.location.origin)
                return;

            if (messageReceived)
                return;

            messageReceived = true;

            if (event.data.type === 'oauth-2fa-required')
            {
                const tempToken = event.data.tempToken;
                setPendingOAuth2FAToken(tempToken);

                window.removeEventListener('message', messageHandler);

                if (!twoFARedirected)
                {
                    twoFARedirected = true;
                    load('twoFactor');
                }
            }
            else if (event.data.type === 'oauth-error')
            {
                const msg = document.getElementById('signUpMsg') || document.getElementById('signInMsg');
                if (msg)
                {
                    msg.textContent = event.data.error || 'Authentication error. Please try again.';
                    msg.style.color = 'red';
                }
                window.removeEventListener('message', messageHandler);
            }
        };

        window.addEventListener('message', messageHandler);

        // Monitor the popup status to detect when it closes.
        const checkInterval = setInterval(() =>
        {
            try
            {
                if (authWindow?.closed)
                {
                    clearInterval(checkInterval);
                    window.removeEventListener('message', messageHandler);

                    // If no specific message was received (like 2FA), assume success and reload to update state.
                    if (!messageReceived)
                        setTimeout(() => window.location.reload(), 500);
                }
            }
            catch
            {
                // Ignore Cross-Origin Opener Policy blocks.
            }
        }, 500);
    });
});

// Expose the stats refresh function globally for external access.
window.refreshUserStats = refreshUserStats;