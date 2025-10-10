// Session Disconnected Overlay Component

export function sessionDisconnectedHTML(message: string): string {
    return `
        <div class="session-overlay">
            <div class="session-message-box">
                <h2 class="session-title">
                    SESSION DISCONNECTED
                </h2>
                <p class="session-description">
                    ${message}
                </p>
                <button id="backToLoginBtn" class="session-reload-btn">
                    LOGIN
                </button>
            </div>
        </div>
    `;
}

export function initializeSessionDisconnectedListeners() {
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', async () => {
            // Clear user data and redirect to login
            window.currentUser = null;
            
            // Clear storage
            if (typeof(Storage) !== "undefined") {
                localStorage.clear();
                sessionStorage.clear();
            }
            
            // Remove overlay
            const overlay = document.getElementById('sessionDisconnectedOverlay');
            if (overlay) {
                overlay.remove();
            }
            
            // Navigate to login
            const { load } = await import('../pages/utils.js');
            await load('signIn');
        });
    }
}
