export const gameHTML = /*html*/`
    <canvas id="map" width="1200" height="800"></canvas>
    <div id="score" class="text-2xl"></div>
    
    <!-- Affichage de l'autre demi-finale (visible uniquement en tournoi) -->
    <div id="other-semifinal" class="other-semifinal-display" style="display: none;">
        <div id="other-semifinal-score" class="other-semifinal-score">Waiting for other semi-final...</div>
    </div>
    
    <!-- Sélecteur de difficulté IA -->
    <div id="ai-difficulty-selector" class="ai-difficulty-selector" style="display: none;">
        <label for="ai-difficulty" class="ai-difficulty-label">
            🤖 Difficulté IA :
        </label>
        <select id="ai-difficulty" class="ai-difficulty-select">
            <option value="easy">🟢 Facile</option>
            <option value="medium" selected>🟡 Moyen</option>
            <option value="hard">🔴 Difficile</option>
        </select>
    </div>
`;