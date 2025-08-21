export function settingsHTML() {
    const username = window.currentUser?.username || 'user666';
    const email = window.currentUser?.email || 'unknown@gmail.com';
    

    return /*html*/ `
    <div id="settings-form">
        <h1>USER SETTINGS</h1>
        <p>USERNAME&emsp;&emsp;&emsp;${username}</p>
        <p>AVATAR&emsp;&emsp;&emsp;&emsp;<span id="change-pp">[Change]</span></p>
        <p>EMAIL&emsp;&emsp;&emsp;&emsp;&emsp;${email}</p>
        

        <div id="settings-buttons">
            <button id="goToMain">[BACK]</button>
            <button id="saveBtn">[SAVE]</button>
        </div>
    </div>
    `;
}