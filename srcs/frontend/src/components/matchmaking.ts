export const matchmakingHTML = /*html*/`
    <div id="matchmaking-page">
        <h2>MATCHMAKING</h2>
        <p id="searchingText">Searching for an opponent...</p>
        <button id="cancelSearchBtn">Cancel Search</button>
<!--
        <div id="tips">
            <p id="tipText">TIP: You can add friends while waiting!</p>
        </div>
    </div>
-->
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