export async function fetchUserMatches(userId) {
    try {
        const response = await fetch(`/matches/history/${userId}?limit=5`);
        if (response.ok) {
            const data = await response.json();
            return data.matches || [];
        }
    }
    catch (error) {
        console.error('Error fetching user matches:', error);
    }
    return [];
}
export async function profileHTML(targetUser) {
    // Si un utilisateur cible est spécifié, l'afficher, sinon afficher l'utilisateur actuel
    const user = targetUser || window.currentUser;
    const username = user?.username || 'user';
    const wins = user?.wins || 0;
    const losses = user?.losses || 0;
    const avatarUrl = user?.avatar_url || './img/default-pp.jpg';
    // Récupérer les vrais matchs de l'utilisateur
    const matches = user?.id ? await fetchUserMatches(user.id) : [];
    // Générer le HTML des matchs
    const matchesHTML = matches.length > 0
        ? matches.map((match) => {
            const isWinner = match.winner_id === user?.id;
            const opponent = isWinner ? match.loser_username : match.winner_username;
            const userScore = isWinner ? match.winner_score : match.loser_score;
            const opponentScore = isWinner ? match.loser_score : match.winner_score;
            const result = isWinner ? 'Win' : 'Loss';
            const matchClass = isWinner ? 'win' : 'loss';
            return `<li class="match-item ${matchClass}">${result} vs. ${opponent} (${userScore}-${opponentScore})</li>`;
        }).join('')
        : '<li class="match-item">No matches played yet</li>';
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
                ${matchesHTML}
            </ul>
        </div>
    </div>
    `;
}
//# sourceMappingURL=profile.html.js.map