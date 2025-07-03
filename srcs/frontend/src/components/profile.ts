export const profileHTML = /*html*/`
    <div class="profile-container">
        <h1 class="username-title">tung_sahur92</h1>
        
        <div class="profile-stats">
            <div class="avatar-container">
                <img src="./img/tung-tung-tung-sahur.jpeg" alt="User Avatar" class="profile-pic">
            </div>
            
            <div class="stats-container">
                <div class="stat-row">
                    <h2 class="stat-label">WINS</h2>
                    <span class="stat-value">100</span>
                </div>
                <div class="stat-row">
                    <h2 class="stat-label">LOSSES</h2>
                    <span class="stat-value">84</span>
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