export const tournamentFinalFinishedHTML = (data?: any) => {
    const winner = data?.winner;
    const loser = data?.loser;
    
    const winnerName = winner?.username || 'Champion';
    const loserName = loser?.username || 'Runner-up';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    // Déterminer si le joueur actuel a gagné
    const currentUsername = window.currentUser?.username;
    const isChampion = currentUsername === winnerName;
    
    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <div class="tournament-badge">
                    <span class="badge-text">FINAL</span>
                </div>
                
                <h2 class="game-finished-title">
                    ${isChampion ? 'CHAMPION' : 'RUNNER-UP'}
                </h2>
                
                <p class="tournament-result-message">
                    ${isChampion 
                        ? 'Congratulations! You won the tournament!' 
                        : 'Great run! You made it to the final!'}
                </p>
                
                <div class="game-finished-scores">
                    <div class="game-finished-player winner">
                        <span class="player-label">CHAMPION</span>
                        <span class="player-name">${winnerName}</span>
                        <span class="player-score">${winnerScore}</span>
                    </div>
                    
                    <div class="game-finished-vs">VS</div>
                    
                    <div class="game-finished-player loser">
                        <span class="player-label">RUNNER-UP</span>
                        <span class="player-name">${loserName}</span>
                        <span class="player-score">${loserScore}</span>
                    </div>
                </div>
                
                <div class="game-finished-actions">
                    <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                </div>
            </div>
        </div>
    `;
};
