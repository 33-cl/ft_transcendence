export const matchmakingHTML = /*html*/`
    <div id="matchmaking-page">
        <h1>MATCHMAKING</h1>
        <p id="searchingText">Searching for an opponent...</p>
        <button id="cancelSearchBtn" class="default-button">Cancel Search</button>

        <div id="tips">
            <p id="tipText"></p>
        </div>
    </div>
`;

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