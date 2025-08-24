import { load } from '../pages/utils.js';

// Fonction pour mettre à jour le profil utilisateur
async function updateProfile(profileData: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
    try {
        const response = await fetch('/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { ok: false, error: data.error || 'Update failed' };
        }

        return { ok: true, message: data.message };
    } catch (error) {
        console.error('Profile update error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Fonction pour afficher un message (succès ou erreur)
function showMessage(message: string, isError: boolean = false): void {
    const messageEl = document.getElementById('settings-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.style.color = isError ? '#ef4444' : '#22c55e';
        messageEl.style.display = 'block';
        
        // Cacher le message après 5 secondes
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}

// Validation côté client
function validateInput(username: string, email: string, newPassword?: string): { valid: boolean; error?: string } {
    // Validation username
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return { valid: false, error: 'Username must be 3-20 characters (letters, numbers, underscore only)' };
    }

    // Validation email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    // Validation nouveau mot de passe
    if (newPassword && newPassword.length < 8) {
        return { valid: false, error: 'New password must be at least 8 characters' };
    }

    return { valid: true };
}

// Gestionnaire d'événements pour les paramètres
export function initSettingsHandlers(): void {
    document.addEventListener('componentsReady', () => {
        const saveBtn = document.getElementById('saveBtn');
        const goToMainBtn = document.getElementById('goToMain');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const usernameInput = document.getElementById('username') as HTMLInputElement;
                const emailInput = document.getElementById('email') as HTMLInputElement;
                const currentPasswordInput = document.getElementById('currentPassword') as HTMLInputElement;
                const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;

                if (!usernameInput || !emailInput || !currentPasswordInput || !newPasswordInput) {
                    showMessage('Form elements not found', true);
                    return;
                }

                const username = usernameInput.value.trim();
                const email = emailInput.value.trim();
                const currentPassword = currentPasswordInput.value;
                const newPassword = newPasswordInput.value;

                // Validation côté client
                const validation = validateInput(username, email, newPassword);
                if (!validation.valid) {
                    showMessage(validation.error!, true);
                    return;
                }

                // Vérifier si des changements ont été effectués
                const currentUser = window.currentUser;
                const hasUsernameChanged = username !== currentUser?.username;
                const hasEmailChanged = email !== currentUser?.email;
                const hasNewPassword = newPassword.length > 0;

                if (!hasUsernameChanged && !hasEmailChanged && !hasNewPassword) {
                    showMessage('No changes to save', true);
                    return;
                }

                // Si on veut changer le mot de passe, le mot de passe actuel est requis
                if (hasNewPassword && !currentPassword) {
                    showMessage('Current password is required to change password', true);
                    return;
                }

                // Construire les données à envoyer
                const profileData: any = {};
                
                if (hasUsernameChanged) profileData.username = username;
                if (hasEmailChanged) profileData.email = email;
                if (hasNewPassword) {
                    profileData.currentPassword = currentPassword;
                    profileData.newPassword = newPassword;
                }

                // Désactiver le bouton pendant la requête
                const saveButton = saveBtn as HTMLButtonElement;
                saveButton.disabled = true;
                saveButton.textContent = '[SAVING...]';

                try {
                    const result = await updateProfile(profileData);
                    
                    if (result.ok) {
                        showMessage(result.message || 'Profile updated successfully');
                        
                        // Refresh les données utilisateur
                        if ((window as any).refreshUserStats) {
                            await (window as any).refreshUserStats();
                        }

                        // Vider les champs de mot de passe
                        currentPasswordInput.value = '';
                        newPasswordInput.value = '';
                        
                        // Mettre à jour les placeholders avec les nouvelles valeurs
                        usernameInput.value = window.currentUser?.username || username;
                        emailInput.value = window.currentUser?.email || email;
                        
                    } else {
                        showMessage(result.error || 'Update failed', true);
                    }
                } catch (error) {
                    showMessage('Network error occurred', true);
                } finally {
                    const saveButton = saveBtn as HTMLButtonElement;
                    saveButton.disabled = false;
                    saveButton.textContent = '[SAVE]';
                }
            });
        }

        if (goToMainBtn) {
            goToMainBtn.addEventListener('click', () => {
                load('mainMenu');
            });
        }
    });
}
