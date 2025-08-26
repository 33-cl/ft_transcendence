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

// Fonction pour initialiser les handlers du changement d’avatar
export function initAvatarHandlers(): void {
    const changeBtn = document.getElementById('change-pp');
    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement;

    if (!changeBtn || !fileInput) return;

    // Quand on clique sur [Change], on ouvre le file picker
    changeBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Quand un fichier est choisi
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return; // sécurité

        window.temporaryAvatarFile = file;

        // Envoyer directement au serveur
        const result = await uploadAvatar(file);

        const messageEl = document.getElementById('settings-message');
        if (messageEl) {
            messageEl.style.display = 'block';
            messageEl.style.color = result.ok ? '#22c55e' : '#ef4444';
            messageEl.textContent = result.ok ? result.message! : result.error!;
        }

        if (result.ok && result.avatar_url) {
            // Mettre à jour l'utilisateur global
            if (window.currentUser) {
                window.currentUser.avatar_url = result.avatar_url;
            }

            // Recharger la page settings après 1s pour afficher le nouvel avatar
            setTimeout(() => {
                load('settings');
            }, 1000);
        }

        // Reset input pour pouvoir reuploader la même image plus tard si besoin
        fileInput.value = '';
    });
}
