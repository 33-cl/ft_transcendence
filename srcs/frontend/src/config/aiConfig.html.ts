export { initAIConfigManagers } from './config.js';

// Ai difficulty selection page
export const aiConfigHTML = /*html*/`
<div id="ai-config-page" class="ai-config-container">
    <h1>AI Difficulty</h1>
    <div class="ai-config-content">
        <div class="difficulty-section">
            <h2>Choose AI difficulty level:</h2>
            <div class="difficulty-options">
                <button id="ai-easy" class="game-config-button easy-button">
                    <span class="difficulty-name">EASY</span>
                    <span class="difficulty-desc"><i>For noobs</i></span>
                </button>
                <button id="ai-medium" class="game-config-button medium-button">
                    <span class="difficulty-name">MEDIUM</span>
                    <span class="difficulty-desc"><i>Feeling bold ?</i></span>
                </button>
                <button id="ai-hard" class="game-config-button hard-button">
                    <span class="difficulty-name">HARD</span>
                    <span class="difficulty-desc"><i>Might traumatize you</i></span>
                </button>
            </div>
        </div>
    </div>
</div>
`;
