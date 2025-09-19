export async function friendListHTML() {
    try {
        // Récupérer les utilisateurs récents
        const usersResponse = await fetch('/users', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!usersResponse.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const usersData = await usersResponse.json();
        const users = usersData.users || [];

        // Récupérer le leaderboard pour identifier le premier
        const leaderboardResponse = await fetch('/users/leaderboard?limit=1', {
            method: 'GET',
            credentials: 'include'
        });

        let firstRankUserId = null;
        if (leaderboardResponse.ok) {
            const leaderboardData = await leaderboardResponse.json();
            if (leaderboardData.leaderboard && leaderboardData.leaderboard.length > 0) {
                firstRankUserId = leaderboardData.leaderboard[0].id;
            }
        }
        
        let userItems = '';
        
        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/default-pp.jpg';
            const isFirstRank = user.id === firstRankUserId;
            const crownIcon = isFirstRank ? '<img src="./img/gold-crown.png" alt="First place" class="crown-icon crown" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; z-index: 10;">' : '';
            
            userItems += `
                <div id="profileBtn" class="friend" data-username="${user.username}" style="position: relative;">
                    <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                         onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                    <p class="friend-name">${user.username}</p>
                    ${crownIcon}
                </div>
            `;
        });
        
        if (userItems === '') {
            userItems = '<p style="text-align: center; color: #ccc; margin-top: 20px;">No friends yet...</p>';
        }
        
        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Friends</h2>
                <hr>
                ${userItems}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading friends:', error);
        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Friends</h2>
                <hr>
                <p style="text-align: center; color: #f00; margin-top: 20px;">Error loading friends</p>
            </div>
        `;
    }
}