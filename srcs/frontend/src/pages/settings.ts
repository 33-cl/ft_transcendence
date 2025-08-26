import { load } from '../pages/utils.js';
import { isValidEmail, isValidUsername, isValidPassword } from '../utils/validation.js';

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

// Reset du champ password
function resetPasswordField(passwordInput: HTMLInputElement): void {
    passwordInput.value = '';
    passwordInput.placeholder = 'Current password';
    passwordInput.style.borderColor = '';
    // Reset des variables stockées
    (passwordInput as any).getCurrentPassword = () => '';
    (passwordInput as any).getNewPassword = () => '';
    (passwordInput as any).getPasswordState = () => 'current';
}

// Configuration spéciale pour le champ password avec états multiples
function setupPasswordField(passwordInput: HTMLInputElement): void {
    let passwordState = 'current'; // 'current' -> 'new' -> 'confirm'
    let currentPassword = '';
    let newPassword = '';

    passwordInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            if (passwordState === 'current') {
                const currentPasswordValue = passwordInput.value.trim();
                
                // Validation : vérifier que le mot de passe actuel n'est pas vide
                if (!currentPasswordValue) {
                    showMessage('Current password cannot be empty', true);
                    return;
                }
                
                // Si validé, passer à l'étape suivante
                currentPassword = currentPasswordValue;
                passwordInput.value = '';
                passwordInput.placeholder = 'New password';
                passwordState = 'new';
                passwordInput.blur();
                
            } else if (passwordState === 'new') {
                const newPasswordValue = passwordInput.value.trim();
                
                // Validation du nouveau mot de passe avec la fonction spécifique
                if (!isValidPassword(newPasswordValue)) {
                    showMessage('Password must be at least 8 characters', true);
                    return;
                }
                
                // Si validé, passer à l'étape suivante
                newPassword = newPasswordValue;
                passwordInput.value = '';
                passwordInput.placeholder = 'Confirm password';
                passwordState = 'confirm';
                passwordInput.blur();
                
            } else if (passwordState === 'confirm') {
                const confirmPassword = passwordInput.value.trim();
                
                // Validation : vérifier que la confirmation correspond
                if (confirmPassword !== newPassword) {
                    showMessage('Passwords do not match', true);
                    return;
                }
                
                // Si validé, sauvegarder
                passwordInput.style.borderColor = '#22c55e';
                await savePasswordDirectly(currentPassword, newPassword);
            }
        }
    });

    // Stocker les données dans l'élément pour les récupérer plus tard
    (passwordInput as any).getCurrentPassword = () => currentPassword;
    (passwordInput as any).getNewPassword = () => passwordState === 'confirm' ? newPassword : '';
    (passwordInput as any).getPasswordState = () => passwordState;
    (passwordInput as any).resetPasswordField = () => {
        resetPasswordField(passwordInput);
        passwordState = 'current';
        currentPassword = '';
        newPassword = '';
    };
}

// Fonction pour configurer le comportement des champs de saisie
function setupInputBehavior(): void {
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('passwordField') as HTMLInputElement;

    if (usernameInput) {
        // Stocker la valeur originale
        const originalUsername = window.currentUser?.username || 'user666';
        
        // Quand on clique sur le champ, le vider s'il contient encore la valeur par défaut
        usernameInput.addEventListener('focus', () => {
            if (usernameInput.value === originalUsername) {
                usernameInput.value = '';
            }
        });

        // Si on quitte le champ et qu'il est vide, remettre la valeur par défaut
        usernameInput.addEventListener('blur', () => {
            if (usernameInput.value.trim() === '') {
                usernameInput.value = originalUsername;
            }
        });

        // Ajouter l'événement Enter pour sauvegarder
        usernameInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (emailInput) {
        // Stocker la valeur originale
        const originalEmail = window.currentUser?.email || 'unknown@gmail.com';
        
        // Quand on clique sur le champ, le vider s'il contient encore la valeur par défaut
        emailInput.addEventListener('focus', () => {
            if (emailInput.value === originalEmail) {
                emailInput.value = '';
            }
        });

        // Si on quitte le champ et qu'il est vide, remettre la valeur par défaut
        emailInput.addEventListener('blur', () => {
            if (emailInput.value.trim() === '') {
                emailInput.value = originalEmail;
            }
        });

        // Ajouter l'événement Enter pour sauvegarder
        emailInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (passwordInput) {
        setupPasswordField(passwordInput);
    }
}

// Fonction pour sauvegarder le mot de passe directement
async function savePasswordDirectly(currentPassword: string, newPassword: string): Promise<void> {
    const profileData = {
        currentPassword: currentPassword,
        newPassword: newPassword
    };

    try {
        const result = await updateProfile(profileData);
        
        if (result.ok) {
            showMessage(result.message || 'Password updated successfully');
            
            // Refresh les données utilisateur
            if ((window as any).refreshUserStats) {
                await (window as any).refreshUserStats();
            }

            // Recharger la page après un court délai
            setTimeout(() => {
                load('settings');
            }, 1500);
            
        } else {
            showMessage(result.error || 'Password update failed', true);
            const passwordInput = document.getElementById('passwordField') as HTMLInputElement;
            if (passwordInput && (passwordInput as any).resetPasswordField) {
                (passwordInput as any).resetPasswordField();
            }
        }
    } catch (error) {
        showMessage('Network error occurred', true);
        const passwordInput = document.getElementById('passwordField') as HTMLInputElement;
        if (passwordInput && (passwordInput as any).resetPasswordField) {
            (passwordInput as any).resetPasswordField();
        }
    }
}

// Fonction pour détecter les changements et sauvegarder uniquement ce qui a été modifié
async function saveChangedFields(): Promise<void> {
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;

    if (!usernameInput || !emailInput) {
        showMessage('Form elements not found', true);
        return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();

    // Vérifier les changements
    const currentUser = window.currentUser;
    const hasUsernameChanged = username !== currentUser?.username && username !== '';
    const hasEmailChanged = email !== currentUser?.email && email !== '';

    if (!hasUsernameChanged && !hasEmailChanged) {
        showMessage('No changes to save', true);
        return;
    }

    // Construire les données à envoyer uniquement pour les champs modifiés
    const profileData: any = {};
    
    if (hasUsernameChanged) {
        // Validation username avec la fonction spécifique
        if (!isValidUsername(username)) {
            showMessage('Username must be 3-20 characters (letters, numbers, underscore only)', true);
            return;
        }
        profileData.username = username;
    }

    if (hasEmailChanged) {
        // Validation email avec la fonction spécifique
        if (!isValidEmail(email)) {
            showMessage('Invalid email format', true);
            return;
        }
        profileData.email = email;
    }

    // Désactiver le bouton pendant la requête
    const saveButton = document.getElementById('saveBtn') as HTMLButtonElement;
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '[SAVING...]';
    }

    try {
        const result = await updateProfile(profileData);
        
        if (result.ok) {
            const fields = [];
            if (hasUsernameChanged) fields.push('username');
            if (hasEmailChanged) fields.push('email');
            
            showMessage(result.message || `${fields.join(' and ')} updated successfully`);
            
            // Refresh les données utilisateur
            if ((window as any).refreshUserStats) {
                await (window as any).refreshUserStats();
            }

            // Recharger la page après un court délai
            setTimeout(() => {
                load('settings');
            }, 1500);
            
        } else {
            showMessage(result.error || 'Update failed', true);
        }
    } catch (error) {
        showMessage('Network error occurred', true);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '[SAVE]';
        }
    }
}

// Gestionnaire d'événements pour les paramètres
export function initSettingsHandlers(): void {
    document.addEventListener('componentsReady', () => {
        // Configurer le comportement des champs de saisie
        setupInputBehavior();

        const saveBtn = document.getElementById('saveBtn');
        const goToMainBtn = document.getElementById('goToMain');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await saveChangedFields();
            });
        }

        if (goToMainBtn) {
            goToMainBtn.addEventListener('click', () => {
                load('mainMenu');
            });
        }
    });
}