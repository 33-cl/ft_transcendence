export function spectatorGameFinishedHTML(data) {
    const winner = data?.winner;
    const loser = data?.loser;
    const winnerName = winner?.username || `Player ${winner?.side}` || 'Unknown';
    const loserName = loser?.username || `Player ${loser?.side}` || 'Unknown';
    const winnerScore = winner?.score || 0;
    const loserScore = loser?.score || 0;
    return /*html*/ `
        <div class="menu-container">
            <div class="menu-section">
                <h1>Match Finished</h1>
                <div class="game-result-info">
                    <p><strong>Winner:</strong> ${winnerName}</p>
                    <p><strong>Loser:</strong> ${loserName}</p>
                    <p><strong>Final Score:</strong> ${winnerScore} - ${loserScore}</p>
                </div>
                <div class="button-group">
                    <button id="mainMenuBtn" class="default-button">Main Menu</button>
                </div>
            </div>
        </div>
    `;
}
//# sourceMappingURL=spectatorGameFinished.html.js.map