import { getSafeAvatarUrl } from '../services/avatarProxy.js';

// Retrieves the match history for a specific user from the server
// Returns an array of match objects or an empty array if the request fails
export async function fetchUserMatches(userId: string)
{
    try
    {
        const response = await fetch(`/matches/history/${userId}?limit=50`);
        
        if (response.ok)
        {
            const data = await response.json();
            return data.matches || [];
        }
    }
    catch (error)
    {
    }
    
    return [];
}

// Stores match data globally to enable access when a match item is clicked
// This avoids redundant API calls when displaying match details
let cachedMatches: any[] = [];

export function getCachedMatches()
{
    return cachedMatches;
}

// Generates the main profile page HTML showing user stats and match history
// If targetUser is provided, displays that user's profile instead of the current user
export async function profileHTML(targetUser?: any)
{
    const user = targetUser || window.currentUser;
    const username = user?.username || 'user';
    const wins = user?.wins || 0;
    const losses = user?.losses || 0;
    const avatarUrl = getSafeAvatarUrl(user?.avatar_url);
    
    // Fetch the actual match data from the server for this user
    const matches = user?.id ? await fetchUserMatches(user.id) : [];
    cachedMatches = matches;
    
    // Build the match history list with clickable items containing match data
    const matchesHTML = matches.length > 0 
        ? matches.map((match: any, index: number) =>
        {
            const isWinner = match.winner_id === user?.id;
            const opponent = isWinner ? match.loser_username : match.winner_username;
            const userScore = isWinner ? match.winner_score : match.loser_score;
            const opponentScore = isWinner ? match.loser_score : match.winner_score;
            const result = isWinner ? 'Win' : 'Loss';
            const matchClass = isWinner ? 'win' : 'loss';
            
            return `<li class="match-item ${matchClass}" data-match-index="${index}" data-match-id="${match.id}">${result} vs. ${opponent} (${userScore}-${opponentScore})</li>`;
        }).join('')
        : '<li class="match-item no-click">No matches played yet</li>';
    
    return /*html*/ `
    <div class="profile-container">
        <h1 class="username-title">${username}</h1>
        
        <div class="profile-stats">
            <div class="avatar-container">
                <img src="${avatarUrl}" alt="User Avatar" class="profile-pic" onerror="this.onerror=null;this.src='/img/planet.gif';">
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

// Generates the dashboard section HTML with a canvas element for statistics chart
// Displays the calculated win rate percentage based on total games played
export function profileDashboardHTML(targetUser?: any)
{
    const user = targetUser || window.currentUser;
    const wins = user?.wins || 0;
    const losses = user?.losses || 0;
    const totalGames = wins + losses;
    
    // Calculate win rate as a percentage, avoiding division by zero
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
    
    return /*html*/ `
    <div class="dashboard-container">
        <canvas id="stats-chart"></canvas>
        <div class="dashboard-stats">
            <div class="dashboard-stat">
                <span class="dashboard-label">Win Rate</span>
                <span class="dashboard-value">${winRate}%</span>
            </div>
        </div>
    </div>
    `;
}

// Generates HTML for the win rate evolution chart section
// Provides a canvas element where the win rate history graph will be rendered
export function profileWinRateHistoryHTML()
{
    return /*html*/ `
    <div class="winrate-history-container">
        <h2 class="winrate-history-title">Win Rate Evolution</h2>
        <canvas id="winrate-history-chart"></canvas>
    </div>
    `;
}