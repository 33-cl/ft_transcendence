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
        <button id="ai-customize-btn" class="ai-customize-btn">⚙️ Personnaliser</button>
    </div>

    <!-- Modal de personnalisation IA -->
    <div id="ai-custom-modal" class="ai-custom-modal" style="display: none;">
        <div class="ai-custom-modal-content">
            <h3>🎛️ Personnaliser l'IA</h3>
            <button id="ai-custom-close" class="ai-custom-close">✕</button>
        </div>
    </div>
`; 