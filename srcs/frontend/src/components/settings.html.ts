export function settingsHTML() {
    const username = window.currentUser?.username || 'a';
    const email = window.currentUser?.email;

    return /*html*/ `
    <h1>USER SETTINGS</h1>
    <div id="settings-form">
        <div class="settings-row">
            <span class="settings-label">USERNAME</span>
            <input type="text" id="username" placeholder="${username}">
        </div>
        <div class="settings-row">
            <span class="settings-label">AVATAR</span>
            <div class="avatar-change-container">
                <input type="file" id="avatarUpload" accept="image/*" style="display: none;">
                <span id="change-pp">[Change]</span>
            </div>
        </div>
        <div class="settings-row">
            <span class="settings-label">EMAIL</span>
            <input type="email" id="email" placeholder="${email}">
        </div>
        <div class="settings-row">
            <span class="settings-label">PASSWORD</span>
            <input type="password" id="passwordField" placeholder="New password">
        </div>
    </div>
    <div id="settings-buttons">
        <button id="goToMain">[BACK]</button>
        <button id="saveBtn">[SAVE]</button>
    </div>
    <div id="settings-message" style="margin-top: 20px; color: #22c55e; display: none;"></div>
    `;
}
