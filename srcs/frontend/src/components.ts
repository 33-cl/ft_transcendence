
// Landing page
const landingHTML = `
  <button id="startBtn">Play</button>
`;

// Game
const gameHTML = `
  <canvas id="map" width="850px" height="650px" style="display: none;"></canvas>
  <div id="score" style="display: none;">
    <span id="leftScore">0</span> -  <span id="rightScore">0</span>
  </div>
  <p id="winnerDisplay"></p>
`;

// Init components
function initializeComponents(): void 
{
  const landingDiv = document.getElementById('landing');
  const gameDiv = document.getElementById('game');
  
  if (landingDiv) {
    landingDiv.innerHTML = landingHTML;
  }
  
  if (gameDiv) {
    gameDiv.innerHTML = gameHTML;
  }
  
  // Notifies each element is ready
  setTimeout(() => {
    const event = new CustomEvent('componentsReady');
    document.dispatchEvent(event);
  }, 0);
}

// Init as soon as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
  initializeComponents();
}