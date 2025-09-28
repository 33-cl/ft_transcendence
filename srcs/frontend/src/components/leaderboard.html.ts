export async function leaderboardHTML() {
    try {
        const response = await fetch('/users/leaderboard', {
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
            leaderboardItems = '<p style="text-align: center; color: #ccc; margin-top: 20px;">Aucun joueur avec des matchs joués...</p>';
        }

        // Afficher les statistiques globales
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
        console.error('Error loading leaderboard:', error);
        return /*html*/`
            <div id="leaderboard" class="user-list">
                <h2>Leaderboard</h2>
                <hr>
                <p style="text-align: center; color: #f00; margin-top: 20px;">Erreur lors du chargement</p>
            </div>
        `;
    }
}