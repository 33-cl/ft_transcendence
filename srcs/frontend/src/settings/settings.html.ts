export function settingsHTML() {
    const username = window.currentUser?.username || 'a';
    const email = window.currentUser?.email || '';
    const is2FAEnabled = window.currentUser?.twoFactorEnabled || false;
    
    // Vérifier si l'utilisateur a un email temporaire (créé quand leur email Google était déjà pris)
    const hasTemporaryEmail = email.endsWith('@oauth.local');

    return /*html*/ `
    <h1>USER SETTINGS</h1>
    <div id="settings-form">
        <div class="settings-row">
            <span class="settings-label">USERNAME</span>
            <input type="text" id="settings-username" placeholder="${username}" maxlength="10">
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
            <input type="email" id="settings-email" placeholder="${email}" maxlength="255">
            ${hasTemporaryEmail ? '<span id="temp-email-warning" style="color: #f59e0b; font-size: 0.8em; margin-left: 10px;">[Update required]</span>' : ''}
        </div>
        <div class="settings-row">
            <span class="settings-label">PASSWORD</span>
            <input type="password" id="settings-password" placeholder="New password" maxlength="255">
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
