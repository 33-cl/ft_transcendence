export function spectatorGameFinishedHTML(data?: any) {
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const numPlayers = data?.numPlayers || 2;
    const is4PlayerGame = numPlayers === 4;

    // Determine display names
    const winnerName = winner?.username || winner?.side || 'Winner';
    const loserName = loser?.username || loser?.side || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;

    // Layout for 4-player games - show only the winner
    if (is4PlayerGame) {
        return /*html*/`
            <div class="game-finished-overlay">
                <div class="game-finished-box">
                    <h2 class="game-finished-title">GAME OVER</h2>
                    <div class="game-finished-4player-result">
                        <div class="game-finished-winner-announcement">
                            ${winnerName} WINS!
                        </div>
                    </div>
                    <div class="game-finished-actions">
                        <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Use the same styles as gameFinished for visual consistency (1v1)
    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <h2 class="game-finished-title">
                    ${isForfeit ? 'VICTORY BY FORFEIT' : 'GAME OVER'}
                </h2>
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
                    <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                </div>
            </div>
        </div>
    `;
}
