export function profileHTML() {
    const username = window.currentUser?.username || 'user';
    const wins = window.currentUser?.wins || 0;
    const losses = window.currentUser?.losses || 0;
    const avatarUrl = window.currentUser?.avatar_url || './img/default-pp.jpg';
    return /*html*/ `
    <div class="profile-container">
        <h1 class="username-title">${username}</h1>
        
        <div class="profile-stats">
            <div class="avatar-container">
                <img src="${avatarUrl}" alt="User Avatar" class="profile-pic" onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
            </div>
            
            <div class="stats-container">
                <div class="stat-row">
                    <h2 class="stat-label">WINS</h2>
                    <span class="stat-value">${wins}</span>
                </div>
                <div class="stat-row">
                    <h2 class="stat-label">LOSSES</h2>
                    <span class="stat-value">${losses}</span>
                </div>
                <div class="stat-row">
                    <h2 class="stat-label">TITLE</h2>
                </div>
                <div class="stat-row">
                    <span class="title-value">BRONZE IV</span>
                </div>
            </div>
        </div>
        
        <div class="match-history">
            <h2>Recent Matches</h2>
            <ul id="match-list">
                <li class="match-item win">Win vs. Player2 (10-8)</li>
                <li class="match-item loss">Loss vs. Player3 (7-10)</li>
                <li class="match-item win">Win vs. Player4 (10-5)</li>
            </ul>
        </div>
    </div>
    `;
}