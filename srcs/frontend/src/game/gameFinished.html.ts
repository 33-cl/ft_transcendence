export const gameFinishedHTML = (data?: any) => {
    
    const winner = data?.winner;
    const loser = data?.loser;
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    const mode = data?.mode; // 'ai', 'local', ou undefined pour online
    const numPlayers = data?.numPlayers || 2;
    const is4PlayerGame = numPlayers === 4;
    
    // Détecter si c'est un match de tournoi
    const isTournamentMatch = !!window.currentTournamentId || !!window.currentMatchId;
    
    // Determine if this is a local/AI game (side-based) or online game (username-based)
    const isLocalOrAIGame = (winner?.side && !winner?.username) || mode === 'ai' || mode === 'local';
    
    // Determine display names
    const winnerName = winner?.username || winner?.side || 'Winner';
    const loserName = loser?.username || loser?.side || 'Loser';
    const winnerScore = winner?.score ?? 0;
    const loserScore = loser?.score ?? 0;
    
    // Show restart button only for local/AI games, NEVER for tournament matches or online games
    const showRestartBtn = !isTournamentMatch && isLocalOrAIGame;
    
    // Layout pour parties 4 joueurs (local ou online) - afficher seulement le gagnant
    if (is4PlayerGame) {
        // Convertir le side en nom lisible pour le mode local
        const sideNames: { [key: string]: string } = {
            'LEFT': 'LEFT PLAYER',
            'RIGHT': 'RIGHT PLAYER', 
            'TOP': 'TOP PLAYER',
            'DOWN': 'BOTTOM PLAYER'
        };
        const displayWinnerName = isLocalOrAIGame ? (sideNames[winnerName] || winnerName) : winnerName;
        
        return /*html*/`
            <div class="game-finished-overlay">
                <div class="game-finished-box">
                    <h2 class="game-finished-title">GAME OVER</h2>
                    
                    <div class="game-finished-4player-result">
                        <div class="game-finished-winner-announcement">
                            ${displayWinnerName} WINS!
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
    
    // Layout pour parties locales/IA 2 joueurs (plus simple, centré)
    if (isLocalOrAIGame) {
        // Déterminer le texte du gagnant
        let winnerText = '';
        // Les sides peuvent être 'LEFT' (gauche) ou 'RIGHT' (droite)
        const isLeftWinner = winnerName === 'LEFT';
        
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
                        ${showRestartBtn ? '<button id="localGameBtn" class="game-finished-btn">PLAY AGAIN</button>' : ''}
                        <button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Layout pour parties en ligne 1v1 (avec noms de joueurs)
    return /*html*/`
        <div class="game-finished-overlay">
            <div class="game-finished-box">
                <h2 class="game-finished-title">
                    ${isTournamentMatch ? 'MATCH FINISHED' : (isForfeit ? 'VICTORY BY FORFEIT' : 'GAME OVER')}
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
                    ${isTournamentMatch 
                        ? '<button id="backToTournamentBtn" class="game-finished-btn">BACK TO TOURNAMENT</button>' 
                        : '<button id="mainMenuBtn" class="game-finished-btn">MAIN MENU</button>'}
                </div>
            </div>
        </div>
    `;
}; 