export function goToProfileHTML() {
    const username = window.currentUser?.username || 'user';
    return /*html*/ `
        <div id="goToProfile-component">
            <img src="./img/default-pp.jpg" alt="Profile Icon" />
            <div class="goToProfile-info">
                <div class="goToProfile-username">${username}</div>
                <button class="goToProfile-logout" id="logOutBtn">Log out</button>
            </div>
        </div>
    `;
}