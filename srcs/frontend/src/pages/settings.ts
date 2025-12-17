import { isValidEmail, isValidUsername, isValidPassword } from '../services/validation.js';
import { initAvatarHandlers, saveAvatar } from '../profile/change_avatar.js';

// Sends profile update request to server with only the fields that have changed
async function updateProfile(profileData: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }>
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

        return { ok: true, message: data.message };
    }
    catch (error)
    {
        return { ok: false, error: 'Network error' };
    }
}

// Displays a temporary message to the user indicating success or error state
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

// Clears password field and resets all stored password states to initial values
function resetPasswordField(passwordInput: HTMLInputElement): void
{
    passwordInput.value = '';
    passwordInput.placeholder = 'New password';
    passwordInput.style.borderColor = '';
    (passwordInput as any).getCurrentPassword = () => '';
    (passwordInput as any).getNewPassword = () => '';
    (passwordInput as any).getPasswordState = () => 'new';
}

// Implements three-step password change flow: current -> new -> confirm
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
                
                passwordInput.style.borderColor = '#22c55e';
                await savePasswordDirectly(currentPassword, newPassword);
            }
        }
    });

    // Expose state getters and reset function for external access
    (passwordInput as any).getCurrentPassword = () => currentPassword;
    (passwordInput as any).getNewPassword = () => passwordState === 'confirm' ? newPassword : '';
    (passwordInput as any).getPasswordState = () => passwordState;
    (passwordInput as any).resetPasswordField = () =>
    {
        resetPasswordField(passwordInput);
        passwordState = 'current';
        currentPassword = '';
        newPassword = '';
    };
}

// Configures dynamic behavior for all settings input fields including auto-sizing and validation
function setupInputBehavior(): void
{
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;
    const passwordInput = document.getElementById('settings-password') as HTMLInputElement;

    // Dynamically adjusts input width based on content length to improve visual feedback
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

    if (usernameInput)
    {
        const originalUsername = window.currentUser?.username || '';
        
        adjustInputWidth(usernameInput);
        
        usernameInput.addEventListener('input', () =>
        {
            adjustInputWidth(usernameInput);
        });
        
        // Clear placeholder value when user focuses to allow fresh input
        usernameInput.addEventListener('focus', () =>
        {
            if (usernameInput.value === originalUsername)
                usernameInput.value = '';
            
            adjustInputWidth(usernameInput);
        });

        // Restore original value if field is left empty to prevent accidental deletion
        usernameInput.addEventListener('blur', () =>
        {
            if (usernameInput.value.trim() === '')
                usernameInput.value = originalUsername;
            
            adjustInputWidth(usernameInput);
        });

        usernameInput.addEventListener('keydown', async (e) =>
        {
            if (e.key === 'Enter')
            {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (emailInput)
    {
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
                emailInput.value = originalEmail;
            
            adjustInputWidth(emailInput);
        });

        emailInput.addEventListener('keydown', async (e) =>
        {
            if (e.key === 'Enter')
            {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (passwordInput)
    {
        adjustInputWidth(passwordInput);
        
        passwordInput.addEventListener('input', () =>
        {
            adjustInputWidth(passwordInput);
        });
        
        setupPasswordField(passwordInput);
    }
}

// Handles password update workflow and refreshes user data on success
async function savePasswordDirectly(currentPassword: string, newPassword: string): Promise<void>
{
    const profileData =
    {
        currentPassword: currentPassword,
        newPassword: newPassword
    };

    try
    {
        const result = await updateProfile(profileData);
        
        if (result.ok)
        {
            showMessage(result.message || 'Password updated successfully');
            
            if (window.refreshUserStats)
                await window.refreshUserStats();
        }
        else
        {
            showMessage(result.error || 'Password update failed', true);
            const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
            if (passwordInput && (passwordInput as any).resetPasswordField)
                (passwordInput as any).resetPasswordField();
        }
    }
    catch (error)
    {
        showMessage('Network error occurred', true);
        const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
        if (passwordInput && (passwordInput as any).resetPasswordField)
            (passwordInput as any).resetPasswordField();
    }
}

// Detects which fields have been modified and saves only those changes to minimize server load
async function saveChangedFields(): Promise<void>
{
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;

    if (!usernameInput || !emailInput)
    {
        showMessage('Form elements not found', true);
        return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();

    const currentUser = window.currentUser;
    const hasUsernameChanged = username !== currentUser?.username && username !== '';
    const hasEmailChanged = email !== currentUser?.email && email !== '';
    const hasPendingAvatar = window.hasPendingAvatar;

    if (!hasUsernameChanged && !hasEmailChanged && !hasPendingAvatar)
    {
        showMessage('No changes to save', true);
        const { load } = await import('../navigation/utils.js');
        await load('mainMenu');
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
        
        // Avatar must be saved first to ensure profile consistency
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
        
        if (hasUsernameChanged)
        {
            if (!isValidUsername(username))
            {
                showMessage('Username must be 3-10 characters (letters, numbers, underscore only)', true);
                return;
            }
            profileData.username = username;
        }

        if (hasEmailChanged)
        {
            if (!isValidEmail(email))
            {
                showMessage('Invalid email format', true);
                return;
            }
            profileData.email = email;
        }

        let profileSaveResult: { ok: boolean; error?: string; message?: string } = { ok: true };
        if (hasUsernameChanged || hasEmailChanged)
        {
            profileSaveResult = await updateProfile(profileData);
            if (!profileSaveResult.ok)
            {
                showMessage(profileSaveResult.error || 'Update failed', true);
                return;
            }
        }

        // Construct user-friendly success message listing all updated fields
        const successMessages = [];
        if (avatarSaveResult.ok && hasPendingAvatar)
            successMessages.push('Avatar');
        
        if (profileSaveResult.ok && (hasUsernameChanged || hasEmailChanged))
        {
            const fields = [];
            if (hasUsernameChanged)
                fields.push('Username');
            if (hasEmailChanged)
                fields.push('Email');
            successMessages.push(...fields);
        }

        if (successMessages.length > 0)
        {
            showMessage(`${successMessages.join(' and ')} updated successfully`);
            
            if (avatarSaveResult.avatar_url && window.currentUser)
                window.currentUser.avatar_url = avatarSaveResult.avatar_url;
            
            if (hasUsernameChanged && window.currentUser)
                window.currentUser.username = username;
            
            if (window.refreshUserStats)
                await window.refreshUserStats();
            
            // Refresh leaderboard to reflect username or avatar changes across UI
            if (hasUsernameChanged || hasPendingAvatar)
            {
                const leaderboardContainer = document.getElementById('leaderboard');
                if (leaderboardContainer)
                {
                    const { leaderboardHTML } = await import('../leaderboard/leaderboard.html.js');
                    leaderboardContainer.innerHTML = await leaderboardHTML();
                }
            }
            
            const { load } = await import('../navigation/utils.js');
            await load('mainMenu');
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

// Initializes all settings page event handlers when components are ready
export function initSettingsHandlers(): void
{
    document.addEventListener('componentsReady', () =>
    {
        setupInputBehavior();
        initAvatarHandlers();

        const saveBtn = document.getElementById('saveBtn');

        if (saveBtn)
        {
            saveBtn.addEventListener('click', async () =>
            {
                await saveChangedFields();
            });
        }
    });
}
