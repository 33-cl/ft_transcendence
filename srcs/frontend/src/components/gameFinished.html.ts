export const gameFinishedHTML = (data?: any) => {
    console.log('🎮 [gameFinishedHTML] Rendering with data:', data);
    
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    const mode = data?.mode; // 'ai', 'local', ou undefined pour online
    
    console.log('🎮 Winner object:', winner);
    console.log('🎮 Loser object:', loser);
    console.log('🎮 Is forfeit:', isForfeit);
    console.log('🎮 Mode:', mode);
    
    // Determine if this is a local/AI game (side-based) or online game (username-based)
    const isLocalOrAIGame = (winner?.side && !winner?.username) || mode === 'ai' || mode === 'local';
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
        // Déterminer le texte du gagnant
        let winnerText = '';
        // Les sides peuvent être 'A' (gauche), 'C' (droite), 'left', ou 'right'
        const isLeftWinner = winnerName === 'left' || winnerName === 'A';
        
        if (mode === 'local') {
            // Mode local : afficher LEFT/RIGHT PLAYER
            winnerText = isLeftWinner ? 'LEFT PLAYER WINS!' : 'RIGHT PLAYER WINS!';
        } else if (mode === 'ai') {
            // Mode IA : afficher YOU WIN/LOSE
            // L'IA contrôle le paddle GAUCHE (A), le joueur contrôle le paddle DROIT (C)
            // Donc si le gagnant est à gauche (A), le joueur a perdu
            winnerText = isLeftWinner ? 'YOU LOSE!' : 'YOU WIN!';
        } else {
            // Fallback si mode n'est pas spécifié - supposer local
            winnerText = isLeftWinner ? 'LEFT PLAYER WINS!' : 'RIGHT PLAYER WINS!';
        }
        
        return /*html*/`
            <div class="game-finished-overlay">
                <div class="game-finished-box">
                    <h2 class="game-finished-title">GAME OVER</h2>
                    
                    <div class="game-finished-local-result">
                        <div class="game-finished-winner-announcement">
                            ${winnerText}
                        </div>
                        
                        <div class="game-finished-final-score">
                            <span class="score-number ${isLeftWinner ? 'winner-score' : ''}">${winnerScore}</span>
                            <span class="score-separator">-</span>
                            <span class="score-number ${!isLeftWinner ? 'winner-score' : ''}">${loserScore}</span>
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