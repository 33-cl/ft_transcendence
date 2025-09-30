export async function goToProfileHTML() {
    const username = window.currentUser?.username || 'a';
    const avatarUrl = window.currentUser?.avatar_url || './img/default-pp.jpg';
    // Vérifier si l'utilisateur est premier du leaderboard
    let crown = '';
    try {
        const response = await fetch('/users/leaderboard', {
            method: 'GET',
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            const leaderboard = data.leaderboard || [];
            // Si l'utilisateur actuel est premier du leaderboard
            if (leaderboard.length > 0 && leaderboard[0].username === username) {
                crown = '<img src="./img/gold-crown.png" alt="Gold Crown" class="crown" />';
            }
        }
    }
    catch (error) {
        console.warn('Failed to fetch leaderboard for crown check:', error);
    }
    return /*html*/ `
        <div id="goToProfile-component">
            <div class="profile-pic" style="display: inline-block;">
                <!-- ${crown} -->
                <img id="goToProfile" src="${avatarUrl}" alt="Profile Icon" onerror="this.onerror=null;this.src='./img/default-pp.jpg';" style="cursor: pointer;" />
            </div>
            <div class="goToProfile-info">
                <div class="goToProfile-username">${username}</div>
                <button class="goToProfile-logout default-button" id="logOutBtn">Log out</button>
            </div>
            <button id="settingsBtn" class="settingsBtn">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>
        </div>
    `;
}
//# sourceMappingURL=goToProfile.html.js.map