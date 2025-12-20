export async function leaderboardHTML() {
    try {
        const response = await fetch('/users/leaderboard?limit=8', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        
        const data = await response.json();
        const leaderboard = data.leaderboard || [];
        const stats = data.stats || { totalPlayers: 0, totalGames: 0 };
        
        let leaderboardItems = '';
        
        leaderboard.forEach((user: any) => {            
            leaderboardItems += `
                <div id="profileBtn" class="friend" data-username="${user.username}">
                    <div class="position-number">${user.rank}.</div>
                    <div class="friend-info">
                        <p class="friend-name">${user.username}</p>
                        <p class="friend-stats">${user.wins}W - ${user.losses}L</p>
                    </div>
                </div>
            `;
        });
        
        if (leaderboardItems === '') {
            leaderboardItems = `<p class="text-center text-gray-400 mt-5">No players on the leaderboard yet...</p>'`;
        }

        // Display stats only if there are players
        const statsSection = stats.totalPlayers > 0 ? `
        ` : '';
        
        return /*html*/`
            <div id="leaderboard" class="user-list">
                <h2>Leaderboard</h2>
                <hr>
                ${statsSection}
                ${leaderboardItems}
            </div>
        `;
        
    } catch (error) {
        return /*html*/`
            <div id="leaderboard" class="user-list">
                <h2>Leaderboard</h2>
                <hr>
                <p style="text-align: center; color: #f00; margin-top: 20px;">Erreur lors du chargement</p>
            </div>
        `;
    }
}