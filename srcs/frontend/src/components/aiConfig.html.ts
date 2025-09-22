
export const aiConfigHTML = /*html*/`
<div id="ai-config-page" class="ai-config-container">
    <h1>Configuration IA</h1>
    <div class="ai-config-content">
        <div class="difficulty-section">
            <h2>Choisissez votre niveau de difficulté :</h2>
            <div class="difficulty-options">
                <button id="ai-easy" class="difficulty-button easy-button">
                    <span class="difficulty-icon">🟢</span>
                    <span class="difficulty-name">FACILE</span>
                    <span class="difficulty-desc">IA lente et imprécise</span>
                </button>
                <button id="ai-medium" class="difficulty-button medium-button selected">
                    <span class="difficulty-icon">🟡</span>
                    <span class="difficulty-name">MOYEN</span>
                    <span class="difficulty-desc">IA équilibrée</span>
                </button>
                <button id="ai-hard" class="difficulty-button hard-button">
                    <span class="difficulty-icon">🔴</span>
                    <span class="difficulty-name">DIFFICILE</span>
                    <span class="difficulty-desc">IA rapide et précise</span>
                </button>
            </div>
        </div>
        <div class="action-buttons">
            <button id="startAIGame" class="default-button start-button">COMMENCER LA PARTIE</button>
            <button id="backToMainMenu" class="default-button back-button">Retour au menu principal</button>
        </div>
    </div>
</div>
`;

