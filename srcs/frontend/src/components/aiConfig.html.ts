export const aiConfigHTML = /*html*/`
<div id="ai-config-page" class="ai-config-container">
    <h1>AI Configuration</h1>
    <div class="ai-config-content">
        <div class="difficulty-section">
            <h2>Choose your difficulty level:</h2>
            <div class="difficulty-options">
                <button id="ai-easy" class="difficulty-button easy-button">
                    <span class="difficulty-icon">🟢</span>
                    <span class="difficulty-name">EASY</span>
                    <span class="difficulty-desc">Slow and inaccurate AI</span>
                </button>
                <button id="ai-medium" class="difficulty-button medium-button selected">
                    <span class="difficulty-icon">🟡</span>
                    <span class="difficulty-name">MEDIUM</span>
                    <span class="difficulty-desc">Balanced AI</span>
                </button>
                <button id="ai-hard" class="difficulty-button hard-button">
                    <span class="difficulty-icon">🔴</span>
                    <span class="difficulty-name">HARD</span>
                    <span class="difficulty-desc">Fast and accurate AI</span>
                </button>
            </div>
        </div>
        <div class="action-buttons">
            <button id="startAIGame" class="default-button start-button">START GAME</button>
            <button id="backToMainMenu" class="default-button back-button">Back to main menu</button>
        </div>
    </div>
</div>
`;

