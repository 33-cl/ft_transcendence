export const matchmakingHTML = /*html*/`
    <div id="matchmaking-page">
        <h1 id="matchmakingTitle">MATCHMAKING</h1>
        <p id="searchingText">Searching for an opponent...</p>
        <p id="playersCount" style="display: none; font-size: 1.2rem; color: #aaa;"></p>
        <button id="cancelSearchBtn" class="default-button">Cancel Search</button>

        <div id="tips">
            <p id="tipText"></p>
        </div>
    </div>
`;

export function updateMatchmakingForTournament(players: number, maxPlayers: number) {
    const title = document.getElementById('matchmakingTitle');
    const searchText = document.getElementById('searchingText');
    const playersCount = document.getElementById('playersCount');
    
    if (title) title.textContent = 'TOURNAMENT';
    if (searchText) searchText.textContent = 'Waiting for players...';
    if (playersCount) {
        playersCount.style.display = 'block';
        playersCount.textContent = `${players}/${maxPlayers} players`;
    }
}

export function updateTournamentWaiting(message: string) {
    const searchText = document.getElementById('searchingText');
    const playersCount = document.getElementById('playersCount');
    
    if (searchText) searchText.textContent = message;
    if (playersCount) playersCount.style.display = 'none';
}

export function animateDots() {
    const p = document.getElementById('searchingText');
    if (!p) return;
  
    const baseText = "Searching for an opponent";
    const dotStates = [
        ".. ",
        ".  ",
        "   ",
        "...",
    ];
  
    let i = 0;
    setInterval(() => {
      p.textContent = baseText + dotStates[i];
      i = (i + 1) % dotStates.length;
    }, 600);
  }

export function switchTips() {
    const p = document.getElementById('tipText');
    if (!p) return;

    const tips = [
        "FUN FACT: At 131 years old, the Frenchman Quentin Ordoux is the oldest man in the world!",
        "TIP: Use the arrow keys to move.",
        "TIP: Your paddle might break if you hit too hard...",
        "WARNING: NEVER LET A SHOOTING STAR HIT THE BLACKHOLE... NEVER !!!"
    ];

    let idx;
    let lastIndex = -1;

    idx = Math.floor(Math.random() * tips.length);
    p.textContent = tips[idx] ?? "";
    lastIndex = idx;

    setInterval(() => {
        do {
            idx = Math.floor(Math.random() * tips.length);
        } while (tips.length > 1 && idx === lastIndex);
        p.textContent = tips[idx] ?? "";
        lastIndex = idx;
    }, 5000);
}