export interface MatchData {
    id: number;
    winner_id: number;
    loser_id: number;
    winner_username: string;
    loser_username: string;
    winner_score: number;
    loser_score: number;
    match_type: string;
    created_at: string;
    duration?: number;
}

export function gameStatsHTML(match: MatchData, _currentUserId: number): string {
    // Protection against missing match data
    if (!match) {
        return /*html*/ `
        <div class="gamestats-container">
            <div class="gamestats-header">
                <h1 class="gamestats-title">Match Statistics</h1>
                <p class="gamestats-error">No match data available</p>
            </div>
        </div>
        `;
    }
    
    // Format the date
    const matchDate = new Date(match.created_at);
    const formattedDate = matchDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Calculate statistics
    const totalPoints = match.winner_score + match.loser_score;
    const winnerPointsPercentage = totalPoints > 0 ? ((match.winner_score / totalPoints) * 100).toFixed(1) : '0';
    const loserPointsPercentage = totalPoints > 0 ? ((match.loser_score / totalPoints) * 100).toFixed(1) : '0';
    const pointDifference = match.winner_score - match.loser_score;

    return /*html*/ `
    <div class="gamestats-container">
        <div class="gamestats-header">
            <h1 class="gamestats-title">Match Statistics</h1>
            <p class="gamestats-date">${formattedDate}</p>
        </div>
        
        <div class="gamestats-score-section">
            <div class="gamestats-player winner">
                <span class="player-name">${match.winner_username}</span>
                <span class="player-score">${match.winner_score}</span>
            </div>
            <div class="gamestats-vs">VS</div>
            <div class="gamestats-player loser">
                <span class="player-name">${match.loser_username}</span>
                <span class="player-score">${match.loser_score}</span>
            </div>
        </div>
        
        <div class="gamestats-charts">
            <div class="gamestats-chart-container">
                <h3>Points Distribution</h3>
                <canvas id="points-distribution-chart"></canvas>
            </div>
            
            <div class="gamestats-chart-container">
                <h3>Score Progression</h3>
                <canvas id="score-progression-chart"></canvas>
            </div>
        </div>
        
        <div class="gamestats-details">
            <div class="gamestats-detail-item">
                <span class="detail-label">${match.winner_username}</span>
                <span class="detail-value">${match.winner_score} (${winnerPointsPercentage}%)</span>
            </div>
            <div class="gamestats-detail-item">
                <span class="detail-label">${match.loser_username}</span>
                <span class="detail-value">${match.loser_score} (${loserPointsPercentage}%)</span>
            </div>
            <div class="gamestats-detail-item">
                <span class="detail-label">Total Points</span>
                <span class="detail-value">${totalPoints}</span>
            </div>
            <div class="gamestats-detail-item">
                <span class="detail-label">Point Difference</span>
                <span class="detail-value">+${pointDifference}</span>
            </div>
        </div>
    </div>
    `;
}
