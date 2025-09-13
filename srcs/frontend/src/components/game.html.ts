export const gameHTML = /*html*/`
    <canvas id="map" width="850px" height="650px"></canvas>
    <div id="score" class="text-2xl"></div>
    
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

    <!-- Modal de personnalisation IA -->
    <div id="ai-custom-modal" class="ai-custom-modal" style="display: none;">
        <div class="ai-custom-modal-content">
            <h3>🎛️ Personnaliser l'IA</h3>
            <div class="ai-param">
                <label>⏱️ Temps de réaction (ms):</label>
                <input type="range" id="ai-reaction-time" min="300" max="700" value="500" step="50">
                <span id="ai-reaction-value">500</span>
            </div>
            <div class="ai-param">
                <label>🎯 Marge d'erreur (px):</label>
                <input type="range" id="ai-error-margin" min="5" max="15" value="10" step="1">
                <span id="ai-error-value">10</span>
            </div>
            <button id="ai-custom-close" class="ai-custom-close">✕</button>
        </div>
    </div>
`; 