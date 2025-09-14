export async function friendListHTML() {
    try {
        const response = await fetch('/users', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        const users = data.users || [];
        
        let userItems = '';
        
        users.forEach((user: any) => {
            const avatarUrl = user.avatar_url || './img/default-pp.jpg';
            
            userItems += `
                <div id="profileBtn" class="friend" data-username="${user.username}">
                    <img src="${avatarUrl}" alt="${user.username} Avatar" class="profile-pic" 
                         onerror="this.onerror=null;this.src='./img/default-pp.jpg';">
                    <p class="friend-name">${user.username}</p>
                </div>
            `;
        });
        
        if (userItems === '') {
            userItems = '<p style="text-align: center; color: #ccc; margin-top: 20px;">No users yet...</p>';
        }
        
        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Recent Users</h2>
                <hr>
                ${userItems}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading users:', error);
        return /*html*/`
            <div id="friendList" class="user-list">
                <h2>Recent Users</h2>
                <hr>
                <p style="text-align: center; color: #f00; margin-top: 20px;">Error loading users</p>
            </div>
        `;
    }
}