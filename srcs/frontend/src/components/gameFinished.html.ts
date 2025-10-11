export const gameFinishedHTML = (data?: any) => {
    console.log('🎮 [gameFinishedHTML] Rendering with data:', data);
    
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    
    console.log('🎮 Winner object:', winner);
    console.log('🎮 Loser object:', loser);
    console.log('🎮 Is forfeit:', isForfeit);
    
    // Determine display names
    const winnerName = winner?.username || winner?.side || 'Winner';
    const loserName = loser?.username || loser?.side || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    console.log('🎮 Winner name:', winnerName, '| Score:', winnerScore);
    console.log('🎮 Loser name:', loserName, '| Score:', loserScore);
    
    // Show restart button only for local games or if no forfeit
    const isOnlineGame = winner?.username && loser?.username;
    const showRestartBtn = !isOnlineGame || !isForfeit;
    
    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <h2 class="game-finished-title">
                    ${isForfeit ? 'VICTORY BY FORFEIT' : 'GAME OVER'}
                </h2>
                
                ${isForfeit ? `
                    <p class="game-finished-forfeit-msg">
                        ${forfeitMessage}
                    </p>
                ` : ''}
                
                <div class="game-finished-scores">
                    <div class="game-finished-player winner">
                        <span class="player-label">WINNER</span>
                        <span class="player-name">${winnerName}</span>
                        <span class="player-score">${winnerScore}</span>
                    </div>
                    
                    <div class="game-finished-vs">VS</div>
                    
                    <div class="game-finished-player loser">
                        <span class="player-label">${isForfeit ? 'FORFEIT' : 'LOSER'}</span>
                        <span class="player-name">${loserName}</span>
                        <span class="player-score">${loserScore}</span>
                    </div>
                </div>
                
                <div class="game-finished-actions">
                    ${showRestartBtn ? '<button id="localGameBtn" class="game-finished-btn">PLAY AGAIN</button>' : ''}
                    <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                </div>
            </div>
        </div>
    `;
}; 