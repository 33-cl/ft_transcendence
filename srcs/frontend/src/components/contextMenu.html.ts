export const contextMenuHTML = (isInGame: boolean = false) => /*html*/ `
    <div id="context-menu" class="context-menu">
        <ul>
            <li id="profileBtn">Profile</li>
            ${isInGame ? '<li id="spectateBtn">Spectate</li>' : ''}
            <li id="challengeBtn">Invite</li>
            <li id="removeFriendBtn">Remove friend</li>
            <li>Block</li>
        </ul>
    </div>
`;