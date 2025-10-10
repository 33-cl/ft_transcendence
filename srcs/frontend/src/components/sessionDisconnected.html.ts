// Session Disconnected Overlay Component

export function sessionDisconnectedHTML(message: string): string {
    return `
        <div class="session-overlay">
            <div class="session-message-box">
                <h2 class="session-title">
                    SESSION BLOCKED
                </h2>
                <p class="session-description">
                    ${message}
                </p>
            </div>
        </div>
    `;
}

export function initializeSessionDisconnectedListeners() {
    // Plus de listener nécessaire - l'overlay reste affiché jusqu'à ce que l'utilisateur ferme l'onglet
}
