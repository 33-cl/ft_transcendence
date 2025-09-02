// change_avatar.ts

// Extend window interface to include temporary avatar URL
declare global {
    interface Window {
        tempAvatarUrl?: string;
        temporaryAvatarFile?: File;
        hasPendingAvatar?: boolean;
    }
}

// Fonction pour uploader temporairement l'avatar
async function uploadTempAvatar(file: File): Promise<{ ok: boolean; error?: string; message?: string; temp_avatar_url?: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch('/auth/avatar/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            return { ok: false, error: data.error || 'Avatar upload failed' };
        }

        return { ok: true, message: data.message || 'Avatar uploaded', temp_avatar_url: data.temp_avatar_url };
    } catch (error) {
        console.error('Avatar upload error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Fonction pour confirmer et sauvegarder l'avatar
export async function saveAvatar(): Promise<{ ok: boolean; error?: string; message?: string; avatar_url?: string }> {
    const tempAvatarUrl = window.tempAvatarUrl;
    
    if (!tempAvatarUrl) {
        return { ok: false, error: 'No temporary avatar to save' };
    }

    try {
        const response = await fetch('/auth/avatar/save', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ temp_avatar_url: tempAvatarUrl })
        });

        const data = await response.json();

        if (!response.ok) {
            return { ok: false, error: data.error || 'Avatar save failed' };
        }

        // Clear temporary avatar data on successful save
        delete window.tempAvatarUrl;
        window.hasPendingAvatar = false;

        return { ok: true, message: data.message || 'Avatar saved successfully', avatar_url: data.avatar_url };
    } catch (error) {
        console.error('Avatar save error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Fonction pour supprimer l'avatar et remettre l'avatar par défaut
async function resetAvatar(): Promise<{ ok: boolean; error?: string; message?: string; avatar_url?: string }> {
    try {
        const response = await fetch('/auth/avatar/reset', {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            return { ok: false, error: data.error || 'Avatar reset failed' };
        }

        return { ok: true, message: data.message || 'Avatar reset successfully', avatar_url: data.avatar_url };
    } catch (error) {
        console.error('Avatar reset error:', error);
        return { ok: false, error: 'Network error' };
    }
}

// Fonction pour initialiser les handlers du changement d’avatar
export function initAvatarHandlers(): void {
    const changeBtn = document.getElementById('change-pp');
    const deleteBtn = document.getElementById('delete-pp');
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

        // Upload temporairement au serveur
        const result = await uploadTempAvatar(file);

        const messageEl = document.getElementById('settings-message');
        if (messageEl) {
            messageEl.style.display = 'block';
            if (result.ok) {
                messageEl.style.color = '#22c55e';
                messageEl.textContent = 'Photo uploaded, click Save to confirm';
                // Store temporary avatar URL for later confirmation
                if (result.temp_avatar_url) {
                    window.tempAvatarUrl = result.temp_avatar_url;
                    window.hasPendingAvatar = true;
                }
            } else {
                messageEl.style.color = '#ef4444';
                messageEl.textContent = result.error!;
                window.hasPendingAvatar = false;
            }
        }

        // Reset input pour pouvoir reuploader la même image plus tard si besoin
        fileInput.value = '';
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const result = await resetAvatar();
            
            const messageEl = document.getElementById('settings-message');
            if (messageEl) {
                messageEl.style.display = 'block';
                if (result.ok) {
                    messageEl.style.color = '#22c55e';
                    messageEl.textContent = 'Avatar reset to default';
                    if (result.avatar_url && window.currentUser) {
                        window.currentUser.avatar_url = result.avatar_url;
                    }
                    // Force refresh des composants qui utilisent l'avatar
                    if ((window as any).refreshUserStats) {
                        (window as any).refreshUserStats();
                    }
                } else {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = result.error!;
                }
            }
        });
    }
}
