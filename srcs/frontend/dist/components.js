"use strict";
// Ce fichier injecte le HTML et déclenche un événement pour notifier script_work.js
// Contenu HTML pour la page d'accueil
const landingHTML = `
  <button id="startBtn">Play</button>
`;
// Contenu HTML pour le jeu
const gameHTML = `
  <canvas id="map" width="850px" height="650px" style="display: none;"></canvas>
  <div id="score" style="display: none;">
    <span id="leftScore">0</span> -  <span id="rightScore">0</span>
  </div>
  <p id="winnerDisplay"></p>
`;
// Fonction pour initialiser les composants
function initializeComponents() {
    // Injecter le contenu dans les divs
    const landingDiv = document.getElementById('landing');
    const gameDiv = document.getElementById('game');
    if (landingDiv) {
        landingDiv.innerHTML = landingHTML;
    }
    if (gameDiv) {
        gameDiv.innerHTML = gameHTML;
    }
    // Déclencher un événement personnalisé pour notifier que les éléments sont prêts
    setTimeout(() => {
        const event = new CustomEvent('componentsReady');
        document.dispatchEvent(event);
    }, 0);
}
// Initialiser dès que possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
}
else {
    initializeComponents();
}
//# sourceMappingURL=components.js.map