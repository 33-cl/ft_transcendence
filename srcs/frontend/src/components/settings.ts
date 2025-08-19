export function settingsHTML() {
    const username = window.currentUser?.username || 'user666';
    return /*html*/ `
    <div id="settings-form">
        <h1>USER SETTINGS</h1>
        <p>USERNAME     ${username}</p>
        

        <button id="goToMain">[BACK]</button>
    </div>
    `;
}