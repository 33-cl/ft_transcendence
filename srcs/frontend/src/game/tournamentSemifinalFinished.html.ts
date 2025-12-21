export const tournamentSemifinalFinishedHTML = (data?: any) => {
    const winner = data?.winner;
    const loser = data?.loser;
    const semifinalNumber = data?.semifinalNumber || 1;
    const otherSemifinal = data?.otherSemifinal;
    
    const winnerName = winner?.username || 'Winner';
    const loserName = loser?.username || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    // Déterminer si le joueur actuel a gagné
    const currentUsername = window.currentUser?.username;
    const isWinner = currentUsername === winnerName;
    
    // Construire le message de l'autre demi-finale
    let otherSemifinalMessage = 'Waiting for the other semi-final...';
    if (otherSemifinal) {
        if (otherSemifinal.finished) {
            otherSemifinalMessage = `Other semi-final: ${otherSemifinal.player1} vs ${otherSemifinal.player2} (${otherSemifinal.winner} won)`;
        } else {
            otherSemifinalMessage = `Other semi-final: ${otherSemifinal.player1} vs ${otherSemifinal.player2}`;
        }
    }
    
    // Le listener roomJoined principal de websocket.ts gérera le démarrage de la finale
    // On ne configure pas de listener ici pour éviter les conflits
    
    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <div class="tournament-badge">
                    <span class="badge-text">SEMI-FINAL ${semifinalNumber}</span>
                </div>
                
                <h2 class="game-finished-title">
                    ${isWinner ? 'VICTORY' : 'DEFEAT'}
                </h2>
                
                <p class="tournament-result-message">
                    ${isWinner 
                        ? 'You advance to the FINAL' 
                        : 'Better luck next time'}
                </p>
                
                <div class="game-finished-scores">
                    <div class="game-finished-player winner">
                        <span class="player-label">WINNER</span>
                        <span class="player-name">${winnerName}</span>
                        <span class="player-score">${winnerScore}</span>
                    </div>
                    
                    <div class="game-finished-vs">VS</div>
                    
                    <div class="game-finished-player loser">
                        <span class="player-label">LOSER</span>
                        <span class="player-name">${loserName}</span>
                        <span class="player-score">${loserScore}</span>
                    </div>
                </div>
                
                <div class="tournament-waiting-message">
                    ${isWinner 
                        ? `<p id="other-semifinal-waiting-text" class="waiting-text" style="color: #9ca3af; font-size: 0.875rem;">${otherSemifinalMessage}</p>`
                        : '<p class="eliminated-text">You have been eliminated.</p>'}
                </div>
                
                <div class="game-finished-actions">
                    ${isWinner 
                        ? `<div class="mini-pong-animation">
                            <div class="mini-pong-container">
                                <div class="mini-pong-paddle-left"></div>
                                <div class="mini-pong-paddle-right"></div>
                                <div class="mini-pong-ball"></div>
                            </div>
                        </div>`
                        : '<button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>'}
                </div>
            </div>
        </div>
    `;
};
