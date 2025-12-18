// toast.ts - Simple toast notification system

interface ToastOptions {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number; // milliseconds
    action?: {
        label: string;
        onClick: () => void;
    } | undefined;
}

/**
 * Affiche une notification toast
 */
export function showToast(options: ToastOptions): void {
    const { message, type = 'info', duration = 5000, action } = options;
    
    // Créer le conteneur de toasts s'il n'existe pas
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // Couleurs selon le type
    const colors = {
        info: 'bg-blue-600',
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        error: 'bg-red-600'
    };
    
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    // Créer le toast
    const toast = document.createElement('div');
    toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[400px] animate-slide-in`;
    
    toast.innerHTML = `
        <span class="text-xl">${icons[type]}</span>
        <span class="flex-1">${message}</span>
        ${action ? `<button class="toast-action px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm font-medium">${action.label}</button>` : ''}
        <button class="toast-close ml-2 text-white/70 hover:text-white">✕</button>
    `;
    
    // Ajouter le toast au conteneur
    container.appendChild(toast);
    
    // Event listeners
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => removeToast(toast));
    }
    
    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn && action) {
        actionBtn.addEventListener('click', () => {
            action.onClick();
            removeToast(toast);
        });
    }
    
    // Auto-remove après duration
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }
}

/**
 * Supprime un toast avec animation
 */
function removeToast(toast: HTMLElement): void {
    toast.classList.add('animate-slide-out');
    setTimeout(() => {
        toast.remove();
        
        // Supprimer le conteneur s'il est vide
        const container = document.getElementById('toast-container');
        if (container && container.children.length === 0) {
            container.remove();
        }
    }, 300);
}

/**
 * Raccourcis pour les différents types de toast
 */
export const toast = {
    info: (message: string, action?: ToastOptions['action']) => showToast({ message, type: 'info', action }),
    success: (message: string, action?: ToastOptions['action']) => showToast({ message, type: 'success', action }),
    warning: (message: string, action?: ToastOptions['action']) => showToast({ message, type: 'warning', action }),
    error: (message: string, action?: ToastOptions['action']) => showToast({ message, type: 'error', action }),
    
    // Toast spécial pour les matchs de tournoi
    matchReady: (_tournamentId: string, _matchId: number, roundName: string) => {
        showToast({
            message: `🎮 Your ${roundName} match is ready!`,
            type: 'success',
            duration: 10000,
            action: {
                label: 'Go to Match',
                onClick: () => {
                    // Tournament pages removed — go to main menu instead
                    import('../navigation/utils.js').then(module => {
                        module.load('mainMenu');
                    });
                }
            }
        });
    },
    
    // Toast pour le champion
    champion: (championName: string) => {
        showToast({
            message: `🏆 ${championName} is the tournament champion!`,
            type: 'success',
            duration: 8000
        });
    }
};
