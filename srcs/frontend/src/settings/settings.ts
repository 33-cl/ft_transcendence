// import { load } from '../navigation/utils.js';
import { isValidEmail, isValidUsername, isValidPassword } from '../services/validation.js';
import { initAvatarHandlers, saveAvatar } from '../profile/change_avatar.js';

// Mettre à jour le profil utilisateur
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
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }, 3000);
    }
}

// Reset du champ password
function resetPasswordField(passwordInput: HTMLInputElement): void {
    passwordInput.value = '';
    passwordInput.placeholder = 'New password';
    passwordInput.style.borderColor = '';
    // Reset des variables stockées
    (passwordInput as any).getCurrentPassword = () => '';
    (passwordInput as any).getNewPassword = () => '';
    (passwordInput as any).getPasswordState = () => 'new';
}

// Configuration spéciale pour le champ password avec états multiples
function setupPasswordField(passwordInput: HTMLInputElement): void {
    let passwordState = 'new'; // 'current' -> 'new' -> 'confirm'
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
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;
    const passwordInput = document.getElementById('settings-password') as HTMLInputElement;

    // Fonction pour ajuster la largeur d'un input en fonction de son contenu
    const adjustInputWidth = (input: HTMLInputElement) => {
        // Créer un élément temporaire pour mesurer la largeur du texte
        const span = document.createElement('span');
        span.style.position = 'absolute';
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'pre';
        span.style.font = window.getComputedStyle(input).font;
        span.textContent = input.value || input.placeholder;
        document.body.appendChild(span);
        
        // Ajouter un peu de padding pour être sûr que tout soit visible
        const textWidth = span.offsetWidth + 20;
        document.body.removeChild(span);
        
        // Définir une largeur minimale et maximale
        const minWidth = 256; // 16rem = 256px
        const maxWidth = 600; // Largeur maximale pour ne pas être trop large
        
        // Appliquer la largeur calculée
        input.style.width = `${Math.max(minWidth, Math.min(maxWidth, textWidth))}px`;
    };

    if (usernameInput && !(usernameInput as any)._listenerSet) {
        (usernameInput as any)._listenerSet = true;
        
        // Stocker la valeur originale
        const originalUsername = window.currentUser?.username || '';
        
        // Ajuster la largeur initiale
        adjustInputWidth(usernameInput);
        
        // Ajuster la largeur à chaque modification
        usernameInput.addEventListener('input', () => {
            adjustInputWidth(usernameInput);
        });
        
        // Quand on clique sur le champ, le vider s'il contient encore la valeur par défaut
        usernameInput.addEventListener('focus', () => {
            if (usernameInput.value === originalUsername) {
                usernameInput.value = '';
            }
            adjustInputWidth(usernameInput);
        });

        // Si on quitte le champ et qu'il est vide, remettre la valeur par défaut
        usernameInput.addEventListener('blur', () => {
            if (usernameInput.value.trim() === '') {
                usernameInput.value = originalUsername;
            }
            adjustInputWidth(usernameInput);
        });

        // Ajouter l'événement Enter pour sauvegarder
        usernameInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (emailInput && !(emailInput as any)._listenerSet) {
        (emailInput as any)._listenerSet = true;
        
        // Stocker la valeur originale
        const originalEmail = window.currentUser?.email || '';
        
        // Ajuster la largeur initiale
        adjustInputWidth(emailInput);
        
        // Ajuster la largeur à chaque modification
        emailInput.addEventListener('input', () => {
            adjustInputWidth(emailInput);
        });
        
        // Quand on clique sur le champ, le vider s'il contient encore la valeur par défaut
        emailInput.addEventListener('focus', () => {
            if (emailInput.value === originalEmail) {
                emailInput.value = '';
            }
            adjustInputWidth(emailInput);
        });

        // Si on quitte le champ et qu'il est vide, remettre la valeur par défaut
        emailInput.addEventListener('blur', () => {
            if (emailInput.value.trim() === '') {
                emailInput.value = originalEmail;
            }
            adjustInputWidth(emailInput);
        });

        // Ajouter l'événement Enter pour sauvegarder
        emailInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveChangedFields();
            }
        });
    }

    if (passwordInput && !(passwordInput as any)._listenerSet) {
        (passwordInput as any)._listenerSet = true;
        
        // Ajuster la largeur initiale
        adjustInputWidth(passwordInput);
        
        // Ajuster la largeur à chaque modification
        passwordInput.addEventListener('input', () => {
            adjustInputWidth(passwordInput);
        });
        
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

            // Ne recharger la page que si on est toujours sur settings
            // setTimeout(() => {
            //     if (isOnSettingsPage) {
            //         load('settings');
            //     }
            // }, 1500);
            
        } else {
            showMessage(result.error || 'Password update failed', true);
            const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
            if (passwordInput && (passwordInput as any).resetPasswordField) {
                (passwordInput as any).resetPasswordField();
            }
        }
    } catch (error) {
        showMessage('Network error occurred', true);
        const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
        if (passwordInput && (passwordInput as any).resetPasswordField) {
            (passwordInput as any).resetPasswordField();
        }
    }
}

// Fonction pour détecter les changements et sauvegarder uniquement ce qui a été modifié
async function saveChangedFields(): Promise<void> {
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;

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
    const hasPendingAvatar = window.hasPendingAvatar;

    if (!hasUsernameChanged && !hasEmailChanged && !hasPendingAvatar) {
        showMessage('No changes to save', true);
        return;
    }

    // Désactiver le bouton pendant la requête
    const saveButton = document.getElementById('saveBtn') as HTMLButtonElement;
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '[SAVING...]';
    }

    try {
        let avatarSaveResult: { ok: boolean; error?: string; message?: string; avatar_url?: string } = { ok: true };
        
        // Sauvegarder l'avatar en premier si nécessaire
        if (hasPendingAvatar) {
            avatarSaveResult = await saveAvatar();
            if (!avatarSaveResult.ok) {
                showMessage(avatarSaveResult.error || 'Avatar save failed', true);
                return;
            }
        }

        // Construire les données à envoyer uniquement pour les champs modifiés
        const profileData: any = {};
        
        if (hasUsernameChanged) {
            // Validation username avec la fonction spécifique
            if (!isValidUsername(username)) {
                showMessage('Username must be 3-10 characters (letters, numbers, underscore only)', true);
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

        // Sauvegarder le profil si des changements existent
        let profileSaveResult: { ok: boolean; error?: string; message?: string } = { ok: true };
        if (hasUsernameChanged || hasEmailChanged) {
            profileSaveResult = await updateProfile(profileData);
            if (!profileSaveResult.ok) {
                showMessage(profileSaveResult.error || 'Update failed', true);
                return;
            }
        }

        // Construire le message de succès
        const successMessages = [];
        if (avatarSaveResult.ok && hasPendingAvatar) {
            successMessages.push('Avatar');
        }
        if (profileSaveResult.ok && (hasUsernameChanged || hasEmailChanged)) {
            const fields = [];
            if (hasUsernameChanged) fields.push('Username');
            if (hasEmailChanged) fields.push('Email');
            successMessages.push(...fields);
        }

        if (successMessages.length > 0) {
            showMessage(`${successMessages.join(' and ')} updated successfully`);
            
            // Mettre à jour l'utilisateur global si l'avatar a été sauvegardé
            if (avatarSaveResult.avatar_url && window.currentUser) {
                window.currentUser.avatar_url = avatarSaveResult.avatar_url;
            }
            
            // Refresh les données utilisateur
            if ((window as any).refreshUserStats) {
                await (window as any).refreshUserStats();
            }
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
        // Marquer qu'on est sur la page settings
        // isOnSettingsPage = true;
        
        // Configurer le comportement des champs de saisie
        setupInputBehavior();
        initAvatarHandlers();

        const saveBtn = document.getElementById('saveBtn');
        // const goToMainBtn = document.getElementById('goToMain');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await saveChangedFields();
            });
        }

        // if (goToMainBtn) {
        //     goToMainBtn.addEventListener('click', () => {
        //         // Marquer qu'on quitte la page settings
        //         isOnSettingsPage = false;
        //         load('mainMenu');
        //     });
        // }
    });
}

// Fonction à appeler quand on quitte la page settings
export function cleanupSettingsHandlers(): void {
    // isOnSettingsPage = false;

}