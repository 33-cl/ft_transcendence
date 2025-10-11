export function spectatorGameFinishedHTML(data?: any) {
    console.log('👁️ [spectatorGameFinishedHTML] Rendering with data:', data);
    
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    
    console.log('👁️ Winner object:', winner);
    console.log('👁️ Loser object:', loser);
    console.log('👁️ Is forfeit:', isForfeit);
    
    // Determine display names
    const winnerName = winner?.username || winner?.side || 'Winner';
    const loserName = loser?.username || loser?.side || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    console.log('👁️ Winner name:', winnerName, '| Score:', winnerScore);
    console.log('👁️ Loser name:', loserName, '| Score:', loserScore);

    return /*html*/`
        <div class="spectator-game-finished-overlay">
            <div class="spectator-game-finished-box">
                <h2 class="spectator-game-finished-title">
                    ${isForfeit ? 'MATCH ENDED - FORFEIT' : 'MATCH FINISHED'}
                </h2>
                
                ${isForfeit ? `
                    <p class="spectator-game-finished-forfeit-msg">
                        ${forfeitMessage}
                    </p>
                ` : ''}
                
                <div class="spectator-game-finished-scores">
                    <div class="spectator-game-finished-player winner">
                        <span class="player-label">WINNER</span>
                        <span class="player-name">${winnerName}</span>
                        <span class="player-score">${winnerScore}</span>
                    </div>
                    
                    <div class="spectator-game-finished-vs">VS</div>
                    
                    <div class="spectator-game-finished-player loser">
                        <span class="player-label">${isForfeit ? 'FORFEIT' : 'LOSER'}</span>
                        <span class="player-name">${loserName}</span>
                        <span class="player-score">${loserScore}</span>
                    </div>
                </div>
                
                <div class="spectator-game-finished-actions">
                    <button id="mainMenuBtn" class="spectator-game-finished-btn">MAIN MENU</button>
                </div>
            </div>
        </div>
    `;
}
