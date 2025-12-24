export function settingsHTML() {
    const username = window.currentUser?.username || 'a';
    const email = window.currentUser?.email || '';
    const is2FAEnabled = window.currentUser?.twoFactorEnabled || false;
    
    // Check if the email ends with '@oauth.local' (indicating a temporary email)
    const hasTemporaryEmail = email.endsWith('@oauth.local');

    return /*html*/ `
    <h1>USER SETTINGS</h1>
    <div id="settings-form">
        <div class="settings-row">
            <span class="settings-label">USERNAME</span>
            <input type="text" id="settings-username" placeholder="${username}">
        </div>
        <div class="settings-row">
            <span class="settings-label">AVATAR</span>
            <div class="avatar-change-container">
                <input type="file" id="avatarUpload" accept="image/*" style="display: none;">
                <span id="avatar-buttons"><span id="delete-pp">x</span><span id="change-pp">[Change]</span></span>
            </div>
        </div>
        <div class="settings-row">
            <span class="settings-label">EMAIL</span>
            <input type="email" id="settings-email" placeholder="${email}">
            ${hasTemporaryEmail ? '<span id="temp-email-warning" style="color: #f59e0b; font-size: 0.8em; margin-left: 10px;">[Update required]</span>' : ''}
        </div>
        <div class="settings-row">
            <span class="settings-label">PASSWORD</span>
            <div style="display: flex; align-items: center;">
                <input type="password" id="settings-password" placeholder="Current password">
                <button id="password-action-btn" style="display: none; margin-left: 10px; background: none; border: none; cursor: pointer;">
                    <svg width="24" height="24" viewBox="0 0 16 16" version="1.1" style="fill: currentColor;">
                        <path d="M4 0v6h-3v10h14v-16h-11zM12 11h-5v2l-3-2.5 3-2.5v2h4v-3h1v4z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="settings-row">
            <span class="settings-label">2 Factor Auth</span>
            <div id="twofa-container">
                <button id="toggle-2fa" class="settings-2fa-btn" data-enabled="${is2FAEnabled}">
                    [${is2FAEnabled ? 'DISABLE' : 'ENABLE'}]
                </button>
                <input type="text" id="twofa-code-input" style="display: none;" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}">
            </div>
        </div>
    </div>
    <div id="settings-buttons">
        <button id="goToMain">[BACK]</button>
        <button id="saveBtn">[SAVE]</button>
    </div>
    <div id="settings-message" style="margin-top: 20px; color: #22c55e; display: none;"></div>
    <div id="twofa-message" style="margin-top: 10px; display: none;"></div>
    `;
}
