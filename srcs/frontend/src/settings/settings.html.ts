export function settingsHTML() {
    const username = window.currentUser?.username || 'a';
    const email = window.currentUser?.email;
    const isGoogleAuth = window.currentUser?.provider === 'google';
    const is2FAEnabled = window.currentUser?.twoFactorEnabled || false;

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
            <input type="email" id="settings-email" placeholder="${email}"${isGoogleAuth ? ' disabled' : ''}>
        </div>
        <div class="settings-row">
            <span class="settings-label">PASSWORD</span>
            <input type="password" id="settings-password" placeholder="New password">
        </div>
        <div class="settings-row">
            <span class="settings-label">2 Factor Auth</span>
            <button id="toggle-2fa" class="settings-2fa-btn" data-enabled="${is2FAEnabled}">
                [${is2FAEnabled ? 'DISABLE' : 'ENABLE'}]
            </button>
        </div>
        <div id="twofa-code-row" class="settings-row" style="display: none;">
            <span class="settings-label">VERIFICATION CODE</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" id="twofa-code-input" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}">
                <button id="verify-2fa-code" class="settings-verify-btn">[VERIFY]</button>
                <button id="cancel-2fa-code" class="settings-cancel-btn">[CANCEL]</button>
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
