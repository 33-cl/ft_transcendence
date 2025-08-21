export function settingsHTML() {
    const username = window.currentUser?.username || 'user666';
    const email = window.currentUser?.email || 'unknown@gmail.com';

    return /*html*/ `
    <div id="settings-form">
        <h1>USER SETTINGS</h1>
        <p>USERNAME     ${username}</p>
        <p>AVATAR       [Change]</p>
        <p>EMAIL        ${email}</p>
        

        <button id="goToMain">[BACK]</button>
    </div>
    `;
}