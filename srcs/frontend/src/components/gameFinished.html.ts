export const gameFinishedHTML = (data?: any) => {
    console.log('🎮 [gameFinishedHTML] Rendering with data:', data);
    
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    
    console.log('🎮 Winner object:', winner);
    console.log('🎮 Loser object:', loser);
    console.log('🎮 Is forfeit:', isForfeit);
    
    // Determine if this is a local/AI game (side-based) or online game (username-based)
    const isLocalOrAIGame = winner?.side && !winner?.username;
    const isOnlineGame = winner?.username && loser?.username;
    
    // Determine display names
    const winnerName = winner?.username || winner?.side || 'Winner';
    const loserName = loser?.username || loser?.side || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    console.log('🎮 Winner name:', winnerName, '| Score:', winnerScore);
    console.log('🎮 Loser name:', loserName, '| Score:', loserScore);
    console.log('🎮 Is local/AI game:', isLocalOrAIGame);
    
    // Show restart button only for local games or if no forfeit
    const showRestartBtn = !isOnlineGame || !isForfeit;
    
    // Layout pour parties locales/IA (plus simple, centré)
    if (isLocalOrAIGame) {
        return /*html*/`
            <div class="game-finished-overlay">
                <div class="game-finished-box">
                    <h2 class="game-finished-title">GAME OVER</h2>
                    
                    <div class="game-finished-local-result">
                        <div class="game-finished-winner-announcement">
                            ${winnerName === 'left' ? 'LEFT PLAYER' : winnerName === 'right' ? 'RIGHT PLAYER' : winnerName.toUpperCase()} WINS!
                        </div>
                        
                        <div class="game-finished-final-score">
                            <span class="score-number">${winnerScore}</span>
                            <span class="score-separator">-</span>
                            <span class="score-number">${loserScore}</span>
                        </div>
                    </div>
                    
                    <div class="game-finished-actions">
                        <button id="localGameBtn" class="game-finished-btn">PLAY AGAIN</button>
                        <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Layout pour parties en ligne (avec noms de joueurs)
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