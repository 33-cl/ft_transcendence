import { isValidEmail, isValidUsername, isValidPassword } from '../services/validation.js';
import { initAvatarHandlers, saveAvatar } from '../profile/change_avatar.js';

let pendingPasswordChange: { currentPassword: string; newPassword: string } | null = null;
let pending2FAChange: 'enable' | 'disable' | null = null;
let pendingUsernameChange: string | null = null;
let pendingEmailChange: string | null = null;

// Sends updated profile data to the server and returns the result with success or error information
async function updateProfile(profileData: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<{ ok: boolean; error?: string; message?: string; twoFactorDisabled?: boolean }>
{
    try
    {
        const response = await fetch('/auth/profile',
        {
            method: 'PUT',
            headers:
            {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });

        const data = await response.json();
        
        if (!response.ok)
            return { ok: false, error: data.error || 'Update failed' };

        if (data.updated?.twoFactorDisabled && window.currentUser)
            window.currentUser.twoFactorEnabled = false;

        return { 
            ok: true, 
            message: data.message,
            twoFactorDisabled: data.updated?.twoFactorDisabled 
        };
    }
    catch (error)
    {
        console.error('Profile update error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Displays a success or error message to the user and auto-hides it after 3 seconds
function showMessage(message: string, isError: boolean = false): void
{
    const messageEl = document.getElementById('settings-message');
    
    if (messageEl)
    {
        messageEl.textContent = message;
        messageEl.style.color = isError ? '#ef4444' : '#22c55e';
        messageEl.style.display = 'block';
        
        setTimeout(() =>
        {
            if (messageEl)
                messageEl.style.display = 'none';
        }, 3000);
    }
}

// Toggles visibility of the 2FA code input field based on whether the user is enabling 2FA
function show2FACodeField(show: boolean): void
{
    const toggle2FABtn = document.getElementById('toggle-2fa');
    const codeInput = document.getElementById('twofa-code-input') as HTMLInputElement;
    
    if (toggle2FABtn)
        toggle2FABtn.style.display = show ? 'none' : 'inline-block';
    
    if (codeInput)
    {
        codeInput.style.display = show ? 'inline-block' : 'none';
        if (show)
            codeInput.value = '';
    }
}

// Displays a 2FA-specific message to the user and auto-hides it after 5 seconds
function show2FAMessage(message: string, isError: boolean = false): void
{
    const msg = document.getElementById('twofa-message');
    
    if (!msg)
        return;
    
    msg.textContent = message;
    msg.style.color = isError ? '#ef4444' : '#22c55e';
    msg.style.display = 'block';
    
    setTimeout(() =>
    {
        msg.style.display = 'none';
    }, 5000);
}

let is2FAButtonDisabled = false;

// Handles the intent to enable or disable 2FA and sends verification codes when enabling
async function toggle2FA(): Promise<void>
{
    const toggle2FABtn = document.getElementById('toggle-2fa');
    const is2FAEnabled = window.currentUser?.twoFactorEnabled || false;
    
    if (is2FAEnabled)
    {
        if (pending2FAChange === 'disable')
        {
            pending2FAChange = null;
            if (toggle2FABtn)
            {
                toggle2FABtn.textContent = '[DISABLE]';
                toggle2FABtn.style.color = '';
            }
            showMessage('2FA disable cancelled');
        }
        else
        {
            pending2FAChange = 'disable';
            if (toggle2FABtn)
            {
                toggle2FABtn.textContent = '[DISABLE] (pending)';
                toggle2FABtn.style.color = '#f59e0b';
            }
            showMessage('2FA disable pending - click [SAVE] to apply');
        }
    }
    else
    {
        if (pending2FAChange === 'enable')
        {
            pending2FAChange = null;
            show2FACodeField(false);
            if (toggle2FABtn)
            {
                toggle2FABtn.textContent = '[ENABLE]';
                toggle2FABtn.style.color = '';
            }
            showMessage('2FA enable cancelled');
        }
        else
        {
            if (is2FAButtonDisabled)
                return;

            is2FAButtonDisabled = true;
            if (toggle2FABtn)
            {
                toggle2FABtn.setAttribute('disabled', 'true');
                toggle2FABtn.style.opacity = '0.5';
                toggle2FABtn.style.cursor = 'not-allowed';
            }

            try
            {
                const response = await fetch('/auth/2fa/enable',
                {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();
                
                if (!response.ok)
                {
                    if (data.code === 'TEMPORARY_EMAIL')
                        show2FAMessage('Please update your email address first (Settings → Email). Your current email is temporary.', true);
                    else
                        show2FAMessage(data.error || '2FA enable failed', true);
                    
                    setTimeout(() =>
                    {
                        is2FAButtonDisabled = false;
                        if (toggle2FABtn)
                        {
                            toggle2FABtn.removeAttribute('disabled');
                            toggle2FABtn.style.opacity = '1';
                            toggle2FABtn.style.cursor = 'pointer';
                        }
                    }, 30000);
                    return;
                }

                pending2FAChange = 'enable';
                show2FACodeField(true);
                if (toggle2FABtn)
                {
                    toggle2FABtn.textContent = '[ENABLE] (pending)';
                    toggle2FABtn.style.color = '#f59e0b';
                }
                show2FAMessage(data.message || 'Verification code sent - enter code then click [SAVE]');
                
                setTimeout(() =>
                {
                    is2FAButtonDisabled = false;
                    if (toggle2FABtn)
                    {
                        toggle2FABtn.removeAttribute('disabled');
                        toggle2FABtn.style.opacity = '1';
                        toggle2FABtn.style.cursor = 'pointer';
                    }
                }, 30000);
            }
            catch (error)
            {
                console.error('2FA enable error:', error);
                show2FAMessage('Network error occurred', true);
                setTimeout(() =>
                {
                    is2FAButtonDisabled = false;
                    if (toggle2FABtn)
                    {
                        toggle2FABtn.removeAttribute('disabled');
                        toggle2FABtn.style.opacity = '1';
                        toggle2FABtn.style.cursor = 'pointer';
                    }
                }, 30000);
            }
        }
    }
}

// Clears the password field and resets all related state variables to initial values
function resetPasswordField(passwordInput: HTMLInputElement): void
{
    passwordInput.value = '';
    passwordInput.placeholder = 'New password';
    passwordInput.style.borderColor = '';
    (passwordInput as any).getCurrentPassword = () => '';
    (passwordInput as any).getNewPassword = () => '';
    (passwordInput as any).getPasswordState = () => 'new';
}

// Configures the password field to handle multi-step password change flow with validation
function setupPasswordField(passwordInput: HTMLInputElement): void
{
    let passwordState = 'new';
    let currentPassword = '';
    let newPassword = '';

    passwordInput.addEventListener('keydown', async (e) =>
    {
        if (e.key === 'Enter')
        {
            e.preventDefault();
            
            if (passwordState === 'current')
            {
                const currentPasswordValue = passwordInput.value.trim();
                
                if (!currentPasswordValue)
                {
                    showMessage('Current password cannot be empty', true);
                    return;
                }
                
                currentPassword = currentPasswordValue;
                passwordInput.value = '';
                passwordInput.placeholder = 'New password';
                passwordState = 'new';
                passwordInput.blur();
            }
            else if (passwordState === 'new')
            {
                const newPasswordValue = passwordInput.value.trim();
                
                if (!isValidPassword(newPasswordValue))
                {
                    showMessage('Password must be at least 8 characters', true);
                    return;
                }
                
                newPassword = newPasswordValue;
                passwordInput.value = '';
                passwordInput.placeholder = 'Confirm password';
                passwordState = 'confirm';
                passwordInput.blur();
            }
            else if (passwordState === 'confirm')
            {
                const confirmPassword = passwordInput.value.trim();
                
                if (confirmPassword !== newPassword)
                {
                    showMessage('Passwords do not match', true);
                    return;
                }
                
                pendingPasswordChange = { currentPassword, newPassword };
                passwordInput.style.borderColor = '#22c55e';
                passwordInput.value = '';
                passwordInput.placeholder = '••••••••';
                passwordInput.blur();
                showMessage('Password change pending - click [SAVE] to apply');
            }
        }
    });

    (passwordInput as any).getCurrentPassword = () => currentPassword;
    (passwordInput as any).getNewPassword = () => passwordState === 'confirm' ? newPassword : '';
    (passwordInput as any).getPasswordState = () => passwordState;
    (passwordInput as any).resetPasswordField = () =>
    {
        resetPasswordField(passwordInput);
        passwordState = 'current';
        currentPassword = '';
        newPassword = '';
        pendingPasswordChange = null;
    };
}

// Sets up event listeners and dynamic width adjustment for username, email, and password input fields
function setupInputBehavior(): void
{
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;
    const passwordInput = document.getElementById('settings-password') as HTMLInputElement;

    const adjustInputWidth = (input: HTMLInputElement) =>
    {
        const span = document.createElement('span');
        span.style.position = 'absolute';
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'pre';
        span.style.font = window.getComputedStyle(input).font;
        span.textContent = input.value || input.placeholder;
        document.body.appendChild(span);
        
        const textWidth = span.offsetWidth + 20;
        document.body.removeChild(span);
        
        const minWidth = 256;
        const maxWidth = 600;
        
        input.style.width = `${Math.max(minWidth, Math.min(maxWidth, textWidth))}px`;
    };

    if (usernameInput && !(usernameInput as any)._listenerSet)
    {
        (usernameInput as any)._listenerSet = true;
        
        const originalUsername = window.currentUser?.username || '';
        
        adjustInputWidth(usernameInput);
        
        usernameInput.addEventListener('input', () =>
        {
            adjustInputWidth(usernameInput);
        });
        
        usernameInput.addEventListener('focus', () =>
        {
            if (usernameInput.value === originalUsername)
                usernameInput.value = '';
            
            adjustInputWidth(usernameInput);
        });

        usernameInput.addEventListener('blur', () =>
        {
            if (usernameInput.value.trim() === '')
            {
                usernameInput.value = originalUsername;
                if (pendingUsernameChange)
                {
                    pendingUsernameChange = null;
                    usernameInput.style.borderColor = '';
                }
            }
            adjustInputWidth(usernameInput);
        });

        usernameInput.addEventListener('keydown', (e) =>
        {
            if (e.key === 'Enter')
            {
                e.preventDefault();
                const newUsername = usernameInput.value.trim();
                
                if (newUsername === originalUsername || newUsername === '')
                {
                    showMessage('No changes to username', true);
                    return;
                }
                
                if (!isValidUsername(newUsername))
                {
                    showMessage('Username must be 3-10 characters (letters, numbers, underscore only)', true);
                    return;
                }
                
                pendingUsernameChange = newUsername;
                usernameInput.style.borderColor = '#22c55e';
                usernameInput.blur();
                showMessage('Username change pending - click [SAVE] to apply');
            }
        });
    }

    if (emailInput && !(emailInput as any)._listenerSet)
    {
        (emailInput as any)._listenerSet = true;
        
        const originalEmail = window.currentUser?.email || '';
        
        adjustInputWidth(emailInput);
        
        emailInput.addEventListener('input', () =>
        {
            adjustInputWidth(emailInput);
        });
        
        emailInput.addEventListener('focus', () =>
        {
            if (emailInput.value === originalEmail)
                emailInput.value = '';
            
            adjustInputWidth(emailInput);
        });

        emailInput.addEventListener('blur', () =>
        {
            if (emailInput.value.trim() === '')
            {
                emailInput.value = originalEmail;
                if (pendingEmailChange)
                {
                    pendingEmailChange = null;
                    emailInput.style.borderColor = '';
                }
            }
            adjustInputWidth(emailInput);
        });

        emailInput.addEventListener('keydown', (e) =>
        {
            if (e.key === 'Enter')
            {
                e.preventDefault();
                const newEmail = emailInput.value.trim();
                
                if (newEmail === originalEmail || newEmail === '')
                {
                    showMessage('No changes to email', true);
                    return;
                }
                
                if (!isValidEmail(newEmail))
                {
                    showMessage('Invalid email format', true);
                    return;
                }
                
                pendingEmailChange = newEmail;
                emailInput.style.borderColor = '#22c55e';
                emailInput.blur();
                showMessage('Email change pending - click [SAVE] to apply');
            }
        });
    }

    if (passwordInput && !(passwordInput as any)._listenerSet)
    {
        (passwordInput as any)._listenerSet = true;
        
        adjustInputWidth(passwordInput);
        
        passwordInput.addEventListener('input', () =>
        {
            adjustInputWidth(passwordInput);
        });
        
        setupPasswordField(passwordInput);
    }
}

// Processes all pending changes and sends them to the server when the Save button is clicked
async function saveChangedFields(): Promise<void>
{
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;
    const codeInput = document.getElementById('twofa-code-input') as HTMLInputElement;

    if (!usernameInput || !emailInput)
    {
        showMessage('Form elements not found', true);
        return;
    }

    const hasPendingUsername = pendingUsernameChange !== null;
    const hasPendingEmail = pendingEmailChange !== null;
    const hasPendingAvatar = window.hasPendingAvatar;
    const hasPendingPassword = pendingPasswordChange !== null;
    const hasPending2FA = pending2FAChange !== null;

    if (!hasPendingUsername && !hasPendingEmail && !hasPendingAvatar && !hasPendingPassword && !hasPending2FA)
    {
        showMessage('No changes to save', true);
        return;
    }

    const saveButton = document.getElementById('saveBtn') as HTMLButtonElement;
    if (saveButton)
    {
        saveButton.disabled = true;
        saveButton.textContent = '[SAVING...]';
    }

    try
    {
        let avatarSaveResult: { ok: boolean; error?: string; message?: string; avatar_url?: string } = { ok: true };
        
        if (hasPendingAvatar)
        {
            avatarSaveResult = await saveAvatar();
            if (!avatarSaveResult.ok)
            {
                showMessage(avatarSaveResult.error || 'Avatar save failed', true);
                return;
            }
        }

        const profileData: any = {};
        
        if (hasPendingUsername && pendingUsernameChange)
            profileData.username = pendingUsernameChange;

        if (hasPendingEmail && pendingEmailChange)
            profileData.email = pendingEmailChange;

        let profileSaveResult: { ok: boolean; error?: string; message?: string; twoFactorDisabled?: boolean } = { ok: true };
        if (hasPendingUsername || hasPendingEmail)
        {
            profileSaveResult = await updateProfile(profileData);
            if (!profileSaveResult.ok)
            {
                showMessage(profileSaveResult.error || 'Update failed', true);
                return;
            }
        }

        let passwordSaveResult: { ok: boolean; error?: string } = { ok: true };
        if (hasPendingPassword && pendingPasswordChange)
        {
            const passwordResponse = await updateProfile({
                currentPassword: pendingPasswordChange.currentPassword,
                newPassword: pendingPasswordChange.newPassword
            });
            if (!passwordResponse.ok)
            {
                showMessage(passwordResponse.error || 'Password update failed', true);
                const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
                if (passwordInput && (passwordInput as any).resetPasswordField)
                    (passwordInput as any).resetPasswordField();
                
                return;
            }
            passwordSaveResult = passwordResponse;
            pendingPasswordChange = null;
            const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
            if (passwordInput)
            {
                passwordInput.style.borderColor = '';
                passwordInput.placeholder = 'New password';
            }
        }

        let twofaSaveResult: { ok: boolean; error?: string } = { ok: true };
        if (hasPending2FA && pending2FAChange)
        {
            if (pending2FAChange === 'disable')
            {
                const response = await fetch('/auth/2fa/disable',
                {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await response.json();
                
                if (!response.ok)
                {
                    show2FAMessage(data.error || '2FA disable failed', true);
                    twofaSaveResult = { ok: false, error: data.error };
                }
                else
                {
                    if (window.currentUser)
                        window.currentUser.twoFactorEnabled = false;
                    
                    const toggle2FABtn = document.getElementById('toggle-2fa');
                    if (toggle2FABtn)
                    {
                        toggle2FABtn.textContent = '[ENABLE]';
                        toggle2FABtn.setAttribute('data-enabled', 'false');
                        toggle2FABtn.style.color = '';
                    }
                    pending2FAChange = null;
                }
            }
            else if (pending2FAChange === 'enable')
            {
                const code = codeInput?.value.trim();
                if (!code || code.length !== 6)
                {
                    show2FAMessage('Please enter a valid 6-digit code', true);
                    return;
                }
                
                const verifyResponse = await fetch('/auth/2fa/verify',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code })
                });
                const verifyData = await verifyResponse.json();
                
                if (!verifyResponse.ok)
                {
                    show2FAMessage(verifyData.error || 'Invalid verification code', true);
                    twofaSaveResult = { ok: false, error: verifyData.error };
                }
                else
                {
                    if (window.currentUser)
                        window.currentUser.twoFactorEnabled = true;
                    
                    const toggle2FABtn = document.getElementById('toggle-2fa');
                    if (toggle2FABtn)
                    {
                        toggle2FABtn.textContent = '[DISABLE]';
                        toggle2FABtn.setAttribute('data-enabled', 'true');
                        toggle2FABtn.style.color = '';
                    }
                    show2FACodeField(false);
                    pending2FAChange = null;
                }
            }
        }

        const successMessages = [];
        if (avatarSaveResult.ok && hasPendingAvatar)
            successMessages.push('Avatar');
        
        if (profileSaveResult.ok && (hasPendingUsername || hasPendingEmail))
        {
            const fields = [];
            if (hasPendingUsername)
                fields.push('Username');
            if (hasPendingEmail)
                fields.push('Email');
            successMessages.push(...fields);
        }
        if (passwordSaveResult.ok && hasPendingPassword)
            successMessages.push('Password');
        
        if (twofaSaveResult.ok && hasPending2FA)
            successMessages.push('2FA');

        if (successMessages.length > 0)
        {
            let message = `${successMessages.join(' and ')} updated successfully`;
            if (profileSaveResult.message)
                message = profileSaveResult.message;
            
            showMessage(message);
            
            if (avatarSaveResult.avatar_url && window.currentUser)
                window.currentUser.avatar_url = avatarSaveResult.avatar_url;
            
            if (hasPendingEmail && pendingEmailChange && window.currentUser)
            {
                window.currentUser.email = pendingEmailChange;
                
                const tempEmailWarning = document.getElementById('temp-email-warning');
                if (tempEmailWarning && !pendingEmailChange.endsWith('@oauth.local'))
                    tempEmailWarning.remove();
                
                pendingEmailChange = null;
                emailInput.style.borderColor = '';
            }
            
            if (hasPendingUsername && pendingUsernameChange && window.currentUser)
            {
                window.currentUser.username = pendingUsernameChange;
                
                pendingUsernameChange = null;
                usernameInput.style.borderColor = '';
            }
            
            if (profileSaveResult.twoFactorDisabled)
            {
                const toggle2FABtn = document.getElementById('toggle-2fa');
                if (toggle2FABtn)
                {
                    toggle2FABtn.textContent = '[ENABLE]';
                    toggle2FABtn.setAttribute('data-enabled', 'false');
                }
            }
            
            if ((window as any).refreshUserStats)
                await (window as any).refreshUserStats();

            // After a successful save, navigate back to the main menu
            try
            {
                const module = await import('../navigation/utils.js');
                await module.load('mainMenu');
            }
            catch (error)
            {
                console.warn('Failed to navigate to main menu after saving settings', error);
            }
        }
    }
    catch (error)
    {
        showMessage('Network error occurred', true);
    }
    finally
    {
        if (saveButton)
        {
            saveButton.disabled = false;
            saveButton.textContent = '[SAVE]';
        }
    }
}

// Initializes all event handlers for the settings page when components are ready
export function initSettingsHandlers(): void
{
    document.addEventListener('componentsReady', () =>
    {
        setupInputBehavior();
        initAvatarHandlers();

        const saveBtn = document.getElementById('saveBtn');
        const toggle2FABtn = document.getElementById('toggle-2fa');

        if (saveBtn)
        {
            saveBtn.addEventListener('click', async () =>
            {
                await saveChangedFields();
            });
        }

        if (toggle2FABtn)
        {
            toggle2FABtn.addEventListener('click', async () =>
            {
                await toggle2FA();
            });
        }
    });
}
