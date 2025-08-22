export function settingsHTML() {
    const username = window.currentUser?.username || 'error';
    const email = window.currentUser?.email || 'error';

    return /*html*/ `
    <h1>USER SETTINGS</h1>
    <div id="settings-form">
        <div class="settings-row">
            <span class="settings-label">USERNAME</span>
            <input type="text" id="username" placeholder="${username}">
        </div>
        <div class="settings-row">
            <span class="settings-label">AVATAR</span>
            <span id="change-pp">[Change]</span>
        </div>
        <div class="settings-row">
            <span class="settings-label">EMAIL</span>
            <input type="text" id="email" placeholder="${email}">
        </div>
    </div>
    <div id="settings-buttons">
        <button id="goToMain">[BACK]</button>
        <button id="saveBtn">[SAVE]</button>
    </div>
    `;
}