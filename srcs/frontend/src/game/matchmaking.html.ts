export const matchmakingHTML = /*html*/`
    <div id="matchmaking-page">
        <h1 id="matchmakingTitle">MATCHMAKING</h1>
        <p id="searchingText">Searching for an opponent...</p>
        <button id="cancelSearchBtn" class="default-button">Cancel Search</button>

        <div id="tips">
            <p id="tipText"></p>
        </div>
    </div>
`;

// Store interval IDs for cleanup
let dotsIntervalId: number | null = null;
let tipsIntervalId: number | null = null;

export function updateMatchmakingForTournament(players: number, maxPlayers: number) {
    const title = document.getElementById('matchmakingTitle');
    const searchText = document.getElementById('searchingText');
    
    if (title) title.textContent = 'TOURNAMENT';
    if (searchText) searchText.textContent = 'Waiting for players...';
}

export function updateTournamentWaiting(message: string) {
    const searchText = document.getElementById('searchingText');
    
    if (searchText) searchText.textContent = message;
}

export function animateDots() {
    // Clear any existing interval first
    if (dotsIntervalId !== null) {
        clearInterval(dotsIntervalId);
        dotsIntervalId = null;
    }
    
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
    dotsIntervalId = window.setInterval(() => {
      // Stop if element no longer exists
      if (!document.getElementById('searchingText')) {
          if (dotsIntervalId !== null) {
              clearInterval(dotsIntervalId);
              dotsIntervalId = null;
          }
          return;
      }
      p.textContent = baseText + dotStates[i];
      i = (i + 1) % dotStates.length;
    }, 600);
  }

export function switchTips() {
    // Clear any existing interval first
    if (tipsIntervalId !== null) {
        clearInterval(tipsIntervalId);
        tipsIntervalId = null;
    }
    
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

    tipsIntervalId = window.setInterval(() => {
        // Stop if element no longer exists
        if (!document.getElementById('tipText')) {
            if (tipsIntervalId !== null) {
                clearInterval(tipsIntervalId);
                tipsIntervalId = null;
            }
            return;
        }
        do {
            idx = Math.floor(Math.random() * tips.length);
        } while (tips.length > 1 && idx === lastIndex);
        p.textContent = tips[idx] ?? "";
        lastIndex = idx;
    }, 5000);
}

// Cleanup function to stop all matchmaking intervals
export function cleanupMatchmakingIntervals(): void {
    if (dotsIntervalId !== null) {
        clearInterval(dotsIntervalId);
        dotsIntervalId = null;
    }
    if (tipsIntervalId !== null) {
        clearInterval(tipsIntervalId);
        tipsIntervalId = null;
    }
}

// Expose cleanup globally
window.cleanupMatchmakingIntervals = cleanupMatchmakingIntervals;