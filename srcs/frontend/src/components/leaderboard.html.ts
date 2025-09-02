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
        
        let leaderboardItems = '';
        
        leaderboard.forEach((user: any, index: number) => {
            const position = index + 1;
            
            leaderboardItems += `
                <div class="friend">
                    <div class="position-number">${position}.</div>
                    <div class="friend-info">
                        <p class="friend-name">${user.username}</p>
                        <p class="friend-stats">${user.wins}W - ${user.losses}L</p>
                    </div>
                </div>
            `;
        });
        
        if (leaderboardItems === '') {
            leaderboardItems = '<p style="text-align: center; color: #ccc; margin-top: 20px;">Empty...</p>';
        }
        
        return /*html*/`
            <div id="leaderboard" class="user-list">
                <h2>Leaderboard</h2>
                <hr>
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