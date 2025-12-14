// import { load } from '../navigation/utils.js';
import { isValidEmail, isValidUsername, isValidPassword } from '../services/validation.js';
import { initAvatarHandlers, saveAvatar } from '../profile/change_avatar.js';

// Variables pour stocker les modifications en attente
let pendingPasswordChange: { currentPassword: string; newPassword: string } | null = null;
let pending2FAChange: 'enable' | 'disable' | null = null;
let pendingUsernameChange: string | null = null;
let pendingEmailChange: string | null = null;

// Mettre à jour le profil utilisateur
async function updateProfile(profileData: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<{ ok: boolean; error?: string; message?: string; twoFactorDisabled?: boolean }> {
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

        // Si la 2FA a été désactivée, mettre à jour l'état local
        if (data.updated?.twoFactorDisabled && window.currentUser) {
            window.currentUser.twoFactorEnabled = false;
        }

        return { 
            ok: true, 
            message: data.message,
            twoFactorDisabled: data.updated?.twoFactorDisabled 
        };
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

// Fonction pour afficher/masquer le champ de code 2FA
function show2FACodeField(show: boolean): void {
    const toggle2FABtn = document.getElementById('toggle-2fa');
    const codeInput = document.getElementById('twofa-code-input') as HTMLInputElement;
    
    if (toggle2FABtn) {
        toggle2FABtn.style.display = show ? 'none' : 'inline-block';
    }
    
    if (codeInput) {
        codeInput.style.display = show ? 'inline-block' : 'none';
        if (show) {
            codeInput.value = '';
        }
    }
}

// Fonction pour afficher un message 2FA
function show2FAMessage(message: string, isError: boolean = false): void {
    const msg = document.getElementById('twofa-message');
    if (!msg) return;
    
    msg.textContent = message;
    msg.style.color = isError ? '#ef4444' : '#22c55e';
    msg.style.display = 'block';
    
    setTimeout(() => {
        msg.style.display = 'none';
    }, 5000);
}

// Variable pour le cooldown du bouton 2FA
let is2FAButtonDisabled = false;

// Fonction pour marquer l'intention d'activer/désactiver la 2FA (sera appliquée via SAVE)
async function toggle2FA(): Promise<void> {
    const toggle2FABtn = document.getElementById('toggle-2fa');
    const is2FAEnabled = window.currentUser?.twoFactorEnabled || false;
    
    if (is2FAEnabled) {
        // Intention de désactiver la 2FA
        if (pending2FAChange === 'disable') {
            // Annuler l'intention
            pending2FAChange = null;
            if (toggle2FABtn) {
                toggle2FABtn.textContent = '[DISABLE]';
                toggle2FABtn.style.color = '';
            }
            showMessage('2FA disable cancelled');
        } else {
            pending2FAChange = 'disable';
            if (toggle2FABtn) {
                toggle2FABtn.textContent = '[DISABLE] (pending)';
                toggle2FABtn.style.color = '#f59e0b';
            }
            showMessage('2FA disable pending - click [SAVE] to apply');
        }
    } else {
        // Intention d'activer la 2FA - nécessite l'envoi d'un code
        if (pending2FAChange === 'enable') {
            // Annuler l'intention
            pending2FAChange = null;
            show2FACodeField(false);
            if (toggle2FABtn) {
                toggle2FABtn.textContent = '[ENABLE]';
                toggle2FABtn.style.color = '';
            }
            showMessage('2FA enable cancelled');
        } else {
            // Vérifier le cooldown
            if (is2FAButtonDisabled) {
                return;
            }

            // Activer le cooldown
            is2FAButtonDisabled = true;
            if (toggle2FABtn) {
                toggle2FABtn.setAttribute('disabled', 'true');
                toggle2FABtn.style.opacity = '0.5';
                toggle2FABtn.style.cursor = 'not-allowed';
            }

            try {
                // Demander l'envoi du code
                const response = await fetch('/auth/2fa/enable', {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();
                
                if (!response.ok) {
                    if (data.code === 'TEMPORARY_EMAIL') {
                        show2FAMessage('Please update your email address first (Settings → Email). Your current email is temporary.', true);
                    } else {
                        show2FAMessage(data.error || '2FA enable failed', true);
                    }
                    setTimeout(() => {
                        is2FAButtonDisabled = false;
                        if (toggle2FABtn) {
                            toggle2FABtn.removeAttribute('disabled');
                            toggle2FABtn.style.opacity = '1';
                            toggle2FABtn.style.cursor = 'pointer';
                        }
                    }, 30000);
                    return;
                }

                // Marquer l'intention et afficher le champ de code
                pending2FAChange = 'enable';
                show2FACodeField(true);
                if (toggle2FABtn) {
                    toggle2FABtn.textContent = '[ENABLE] (pending)';
                    toggle2FABtn.style.color = '#f59e0b';
                }
                show2FAMessage(data.message || 'Verification code sent - enter code then click [SAVE]');
                
                setTimeout(() => {
                    is2FAButtonDisabled = false;
                    if (toggle2FABtn) {
                        toggle2FABtn.removeAttribute('disabled');
                        toggle2FABtn.style.opacity = '1';
                        toggle2FABtn.style.cursor = 'pointer';
                    }
                }, 30000);
                
            } catch (error) {
                console.error('2FA enable error:', error);
                show2FAMessage('Network error occurred', true);
                setTimeout(() => {
                    is2FAButtonDisabled = false;
                    if (toggle2FABtn) {
                        toggle2FABtn.removeAttribute('disabled');
                        toggle2FABtn.style.opacity = '1';
                        toggle2FABtn.style.cursor = 'pointer';
                    }
                }, 30000);
            }
        }
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
                
                // Stocker le changement de mot de passe en attente (sera sauvegardé via SAVE)
                pendingPasswordChange = { currentPassword, newPassword };
                passwordInput.style.borderColor = '#22c55e';
                passwordInput.value = '';
                passwordInput.placeholder = '••••••••';
                passwordInput.blur();
                showMessage('Password change pending - click [SAVE] to apply');
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
        pendingPasswordChange = null;
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
                // Annuler le pending si on remet la valeur originale
                if (pendingUsernameChange) {
                    pendingUsernameChange = null;
                    usernameInput.style.borderColor = '';
                }
            }
            adjustInputWidth(usernameInput);
        });

        // Enter pour marquer comme pending
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newUsername = usernameInput.value.trim();
                
                // Vérifier si c'est différent de l'original
                if (newUsername === originalUsername || newUsername === '') {
                    showMessage('No changes to username', true);
                    return;
                }
                
                // Validation
                if (!isValidUsername(newUsername)) {
                    showMessage('Username must be 3-10 characters (letters, numbers, underscore only)', true);
                    return;
                }
                
                // Marquer comme pending
                pendingUsernameChange = newUsername;
                usernameInput.style.borderColor = '#22c55e';
                usernameInput.blur();
                showMessage('Username change pending - click [SAVE] to apply');
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
                // Annuler le pending si on remet la valeur originale
                if (pendingEmailChange) {
                    pendingEmailChange = null;
                    emailInput.style.borderColor = '';
                }
            }
            adjustInputWidth(emailInput);
        });

        // Enter pour marquer comme pending
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newEmail = emailInput.value.trim();
                
                // Vérifier si c'est différent de l'original
                if (newEmail === originalEmail || newEmail === '') {
                    showMessage('No changes to email', true);
                    return;
                }
                
                // Validation
                if (!isValidEmail(newEmail)) {
                    showMessage('Invalid email format', true);
                    return;
                }
                
                // Marquer comme pending
                pendingEmailChange = newEmail;
                emailInput.style.borderColor = '#22c55e';
                emailInput.blur();
                showMessage('Email change pending - click [SAVE] to apply');
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

// Fonction pour détecter les changements et sauvegarder uniquement ce qui a été modifié
async function saveChangedFields(): Promise<void> {
    const usernameInput = document.getElementById('settings-username') as HTMLInputElement;
    const emailInput = document.getElementById('settings-email') as HTMLInputElement;
    const codeInput = document.getElementById('twofa-code-input') as HTMLInputElement;

    if (!usernameInput || !emailInput) {
        showMessage('Form elements not found', true);
        return;
    }

    // Vérifier les changements via les variables pending
    const hasPendingUsername = pendingUsernameChange !== null;
    const hasPendingEmail = pendingEmailChange !== null;
    const hasPendingAvatar = window.hasPendingAvatar;
    const hasPendingPassword = pendingPasswordChange !== null;
    const hasPending2FA = pending2FAChange !== null;

    if (!hasPendingUsername && !hasPendingEmail && !hasPendingAvatar && !hasPendingPassword && !hasPending2FA) {
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
        
        if (hasPendingUsername && pendingUsernameChange) {
            profileData.username = pendingUsernameChange;
        }

        if (hasPendingEmail && pendingEmailChange) {
            profileData.email = pendingEmailChange;
        }

        // Sauvegarder le profil si des changements existent
        let profileSaveResult: { ok: boolean; error?: string; message?: string; twoFactorDisabled?: boolean } = { ok: true };
        if (hasPendingUsername || hasPendingEmail) {
            profileSaveResult = await updateProfile(profileData);
            if (!profileSaveResult.ok) {
                showMessage(profileSaveResult.error || 'Update failed', true);
                return;
            }
        }

        // Sauvegarder le mot de passe si changé
        let passwordSaveResult: { ok: boolean; error?: string } = { ok: true };
        if (hasPendingPassword && pendingPasswordChange) {
            const passwordResponse = await updateProfile({
                currentPassword: pendingPasswordChange.currentPassword,
                newPassword: pendingPasswordChange.newPassword
            });
            if (!passwordResponse.ok) {
                showMessage(passwordResponse.error || 'Password update failed', true);
                // Reset le champ password
                const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
                if (passwordInput && (passwordInput as any).resetPasswordField) {
                    (passwordInput as any).resetPasswordField();
                }
                return;
            }
            passwordSaveResult = passwordResponse;
            pendingPasswordChange = null;
            // Reset le champ password visuellement
            const passwordInput = document.getElementById('settings-password') as HTMLInputElement;
            if (passwordInput) {
                passwordInput.style.borderColor = '';
                passwordInput.placeholder = 'New password';
            }
        }

        // Sauvegarder les changements 2FA si demandé
        let twofaSaveResult: { ok: boolean; error?: string } = { ok: true };
        if (hasPending2FA && pending2FAChange) {
            if (pending2FAChange === 'disable') {
                // Désactiver la 2FA
                const response = await fetch('/auth/2fa/disable', {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await response.json();
                
                if (!response.ok) {
                    show2FAMessage(data.error || '2FA disable failed', true);
                    twofaSaveResult = { ok: false, error: data.error };
                } else {
                    if (window.currentUser) {
                        window.currentUser.twoFactorEnabled = false;
                    }
                    const toggle2FABtn = document.getElementById('toggle-2fa');
                    if (toggle2FABtn) {
                        toggle2FABtn.textContent = '[ENABLE]';
                        toggle2FABtn.setAttribute('data-enabled', 'false');
                        toggle2FABtn.style.color = '';
                    }
                    pending2FAChange = null;
                }
            } else if (pending2FAChange === 'enable') {
                // Vérifier le code 2FA
                const code = codeInput?.value.trim();
                if (!code || code.length !== 6) {
                    show2FAMessage('Please enter a valid 6-digit code', true);
                    return;
                }
                
                const verifyResponse = await fetch('/auth/2fa/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code })
                });
                const verifyData = await verifyResponse.json();
                
                if (!verifyResponse.ok) {
                    show2FAMessage(verifyData.error || 'Invalid verification code', true);
                    twofaSaveResult = { ok: false, error: verifyData.error };
                } else {
                    if (window.currentUser) {
                        window.currentUser.twoFactorEnabled = true;
                    }
                    const toggle2FABtn = document.getElementById('toggle-2fa');
                    if (toggle2FABtn) {
                        toggle2FABtn.textContent = '[DISABLE]';
                        toggle2FABtn.setAttribute('data-enabled', 'true');
                        toggle2FABtn.style.color = '';
                    }
                    show2FACodeField(false);
                    pending2FAChange = null;
                }
            }
        }

        // Construire le message de succès
        const successMessages = [];
        if (avatarSaveResult.ok && hasPendingAvatar) {
            successMessages.push('Avatar');
        }
        if (profileSaveResult.ok && (hasPendingUsername || hasPendingEmail)) {
            const fields = [];
            if (hasPendingUsername) fields.push('Username');
            if (hasPendingEmail) fields.push('Email');
            successMessages.push(...fields);
        }
        if (passwordSaveResult.ok && hasPendingPassword) {
            successMessages.push('Password');
        }
        if (twofaSaveResult.ok && hasPending2FA) {
            successMessages.push('2FA');
        }

        if (successMessages.length > 0) {
            // Message personnalisé si 2FA désactivée
            let message = `${successMessages.join(' and ')} updated successfully`;
            if (profileSaveResult.message) {
                message = profileSaveResult.message;
            }
            showMessage(message);
            
            // Mettre à jour l'utilisateur global si l'avatar a été sauvegardé
            if (avatarSaveResult.avatar_url && window.currentUser) {
                window.currentUser.avatar_url = avatarSaveResult.avatar_url;
            }
            
            // Mettre à jour l'email dans window.currentUser et cacher le message "temporary" si nécessaire
            if (hasPendingEmail && pendingEmailChange && window.currentUser) {
                window.currentUser.email = pendingEmailChange;
                
                // Si le nouvel email n'est plus temporaire, cacher le message d'avertissement
                const tempEmailWarning = document.getElementById('temp-email-warning');
                if (tempEmailWarning && !pendingEmailChange.endsWith('@oauth.local')) {
                    tempEmailWarning.remove();
                }
                
                // Reset pending et style
                pendingEmailChange = null;
                emailInput.style.borderColor = '';
            }
            
            // Mettre à jour le username dans window.currentUser
            if (hasPendingUsername && pendingUsernameChange && window.currentUser) {
                window.currentUser.username = pendingUsernameChange;
                
                // Reset pending et style
                pendingUsernameChange = null;
                usernameInput.style.borderColor = '';
            }
            
            // Si la 2FA a été désactivée, mettre à jour le bouton
            if (profileSaveResult.twoFactorDisabled) {
                const toggle2FABtn = document.getElementById('toggle-2fa');
                if (toggle2FABtn) {
                    toggle2FABtn.textContent = '[ENABLE]';
                    toggle2FABtn.setAttribute('data-enabled', 'false');
                }
            }
            
            // Refresh les données utilisateur
            if ((window as any).refreshUserStats) {
                await (window as any).refreshUserStats();
            }
            
            // NOTE: Le leaderboard est maintenant rafraîchi automatiquement via WebSocket
            // (événement 'leaderboardUpdated' reçu par tous les clients, géré dans websocket.ts)
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
        const toggle2FABtn = document.getElementById('toggle-2fa');
        // const goToMainBtn = document.getElementById('goToMain');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await saveChangedFields();
            });
        }

        if (toggle2FABtn) {
            toggle2FABtn.addEventListener('click', async () => {
                await toggle2FA();
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