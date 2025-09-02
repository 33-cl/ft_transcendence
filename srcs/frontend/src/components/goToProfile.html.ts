export function goToProfileHTML() {
    const username = window.currentUser?.username || 'a';
    const avatarUrl = window.currentUser?.avatar_url || './img/default-pp.jpg';
    return /*html*/ `
        <div id="goToProfile-component">
            <img src="${avatarUrl}" alt="Profile Icon" onerror="this.onerror=null;this.src='./img/default-pp.jpg';" />
            <div class="goToProfile-info">
                <div class="goToProfile-username">${username}</div>
                <button class="goToProfile-logout default-button" id="logOutBtn">Log out</button>
            </div>
            <button id="settingsBtn" class="default-button" style="position:absolute; top:10px; right:10px; background:none; border:none; cursor:pointer;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>
        </div>
    `;
}