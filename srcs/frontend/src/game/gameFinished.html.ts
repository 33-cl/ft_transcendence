export const gameFinishedHTML = (data?: any) =>
{
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    // Robust cross-browser check for draw - checks the draw flag or winner.isDraw
    const isDraw = (data?.draw === true) || (winner?.isDraw === true);
    const mode = data?.mode; // 'ai', 'local', or undefined for online
    const numPlayers = data?.numPlayers || 2;
    const is4PlayerGame = numPlayers === 4;

    // Detect if this is a tournament match
    const isTournamentMatch = !!window.currentTournamentId || !!window.currentMatchId;

    // Determine if this is a local/AI game (side-based) or online game (username-based)
    const isLocalOrAIGame = (winner?.side && !winner?.username) || mode === 'ai' || mode === 'local';

    // Determine display names based on mode
    let winnerName = winner?.username || winner?.side || 'Winner';
    let loserName = loser?.username || loser?.side || 'Loser';

    // Convert sides to readable names for local mode
    const sideNames: { [key: string]: string } = {
        'LEFT': 'LEFT PLAYER',
        'RIGHT': 'RIGHT PLAYER',
        'TOP': 'TOP PLAYER',
        'DOWN': 'BOTTOM PLAYER'
    };

    // For AI mode, customize names
    if (mode === 'ai')
    {
        const isPlayerWinner = winnerName === 'RIGHT'; // The player controls the right paddle
        winnerName = isPlayerWinner ? 'YOU' : 'AI';
        loserName = isPlayerWinner ? 'AI' : 'YOU';
    }
    else if (isLocalOrAIGame && sideNames[winnerName])
    {
        // Local mode: convert sides
        winnerName = sideNames[winnerName] || winnerName;
        loserName = sideNames[loserName] || loserName;
    }

    // Show restart button for local/AI games AND multiplayer non-tournament games
    const showRestartBtn = !isTournamentMatch;

    // Layout for 4-player games (local or online) - show only the winner
    if (is4PlayerGame)
    {
        // If draw (isDraw), show "Draw", otherwise show the winner's name
        let displayText = '';

        if (isDraw)
        {
            displayText = 'Draw';
        }
        else
        {
            const displayWinnerName = isLocalOrAIGame ? (sideNames[winner?.side] || winnerName) : winnerName;
            displayText = `${displayWinnerName} WINS!`;
        }

        return /*html*/`
            <div class="game-finished-overlay">
                <div class="game-finished-box">
                    <h2 class="game-finished-title">GAME OVER</h2>
                    <div class="game-finished-4player-result">
                        <div class="game-finished-winner-announcement">
                            ${displayText}
                        </div>
                    </div>
                    <div class="game-finished-actions">
                        ${showRestartBtn ? '<button id="localGameBtn" class="game-finished-btn">PLAY AGAIN</button>' : ''}
                        <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Unified layout for 2-player games (local, AI, and multiplayer) - same format as spectator
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;

    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <h2 class="game-finished-title">
                    ${isTournamentMatch ? 'MATCH FINISHED' : (isForfeit ? 'VICTORY BY FORFEIT' : 'GAME OVER')}
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
                    ${showRestartBtn ? '<button id="localGameBtn" class="game-finished-btn">PLAY AGAIN</button>' : ''}
                    ${isTournamentMatch 
                        ? '<button id="backToTournamentBtn" class="game-finished-btn">BACK TO TOURNAMENT</button>' 
                        : '<button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>'}
                </div>
            </div>
        </div>
    `;
};