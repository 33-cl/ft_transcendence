// change_avatar.ts

import { load } from '../pages/utils.js';

// Fonction pour uploader l'avatar
async function uploadAvatar(file: File): Promise<{ ok: boolean; error?: string; message?: string; avatar_url?: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch('/auth/avatar', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            return { ok: false, error: data.error || 'Avatar update failed' };
        }

        return { ok: true, message: data.message || 'Avatar updated successfully', avatar_url: data.avatar_url };
    } catch (error) {
        console.error('Avatar upload error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Fonction pour initialiser les handlers du changement d'avatar
export function initAvatarHandlers(): void {
    const changeBtn = document.getElementById('change-pp');
    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement;
    const avatarPreview = document.getElementById('avatar-preview') as HTMLImageElement;
    const saveBtn = document.getElementById('save-avatar');
    const cancelBtn = document.getElementById('cancel-avatar');

    if (!changeBtn || !fileInput || !avatarPreview || !saveBtn || !cancelBtn) return;

    // Variables pour stocker l'état
    let selectedFile: File | null = null;
    let previewUrl: string | null = null;

    // Fonction pour réinitialiser l'état de preview
    function resetPreview() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        avatarPreview.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        selectedFile = null;
        fileInput.value = '';
        
        // Masquer les messages
        const messageEl = document.getElementById('settings-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    // Quand on clique sur [Change], on ouvre le file picker
    changeBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Quand un fichier est choisi - afficher le preview
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        // Nettoyer l'ancienne preview si elle existe
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        // Créer une preview de l'image
        previewUrl = URL.createObjectURL(file);
        avatarPreview.src = previewUrl;
        avatarPreview.style.display = 'inline-block';
        
        // Afficher les boutons Save/Cancel
        if (saveBtn) saveBtn.style.display = 'inline';
        if (cancelBtn) cancelBtn.style.display = 'inline';
        
        // Stocker le fichier sélectionné
        selectedFile = file;
        window.temporaryAvatarFile = file;

        // Afficher un message de preview
        const messageEl = document.getElementById('settings-message');
        if (messageEl) {
            messageEl.style.display = 'block';
            messageEl.style.color = '#3b82f6';
            messageEl.textContent = 'Avatar preview ready - click [Save] to confirm changes';
        }
    });

    // Quand on clique sur [Save] - uploader l'avatar
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            // Afficher un message de chargement
            const messageEl = document.getElementById('settings-message');
            if (messageEl) {
                messageEl.style.display = 'block';
                messageEl.style.color = '#3b82f6';
                messageEl.textContent = 'Uploading avatar...';
            }

            // Envoyer au serveur
            const result = await uploadAvatar(selectedFile);

            if (messageEl) {
                messageEl.style.color = result.ok ? '#22c55e' : '#ef4444';
                messageEl.textContent = result.ok ? result.message! : result.error!;
            }

            if (result.ok && result.avatar_url) {
                // Mettre à jour l'utilisateur global
                if (window.currentUser) {
                    window.currentUser.avatar_url = result.avatar_url;
                }

                // Réinitialiser le preview
                resetPreview();

                // Recharger la page settings après 1.5s pour afficher le nouvel avatar
                setTimeout(() => {
                    load('settings');
                }, 1500);
            } else {
                // En cas d'erreur, garder le preview pour permettre de réessayer
            }
        });
    }

    // Quand on clique sur [Cancel] - annuler les changements
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            resetPreview();
        });
    }
}
