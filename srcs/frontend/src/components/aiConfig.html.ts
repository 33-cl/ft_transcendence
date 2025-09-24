export const aiConfigHTML = /*html*/`
<div id="ai-config-page" class="ai-config-container">
    <h1>Game Configuration</h1>
    <div class="ai-config-content">
        <div class="game-mode-section">
            <h2>Choose game mode:</h2>
            <div class="game-mode-options" style="display: flex; gap: 20px; justify-content: center;">
                <button id="vs-ai" class="game-config-button">
                    <span class="difficulty-icon">🤖</span>
                    <span class="difficulty-name">VS AI</span>
                    <span class="difficulty-desc">Fight the machine</span>
                </button>
                <button id="vs-player" class="game-config-button">
                    <span class="difficulty-icon">👥</span>
                    <span class="difficulty-name">2 PLAYERS</span>
                    <span class="difficulty-desc" id="local2p">Local multiplayer</span>
                </button>
            </div>
        </div>
        
        <div id="difficulty-section" class="difficulty-section" style="display: none;">
            <h2>Choose AI difficulty level:</h2>
            <div class="difficulty-options">
                <button id="ai-easy" class="game-config-button easy-button">
                    <span class="difficulty-icon">🟢</span>
                    <span class="difficulty-name">EASY</span>
                    <span class="difficulty-desc">For noobs</span>
                </button>
                <button id="ai-medium" class="game-config-button medium-button">
                    <span class="difficulty-icon">🟡</span>
                    <span class="difficulty-name">MEDIUM</span>
                    <span class="difficulty-desc">Mid.</span>
                </button>
                <button id="ai-hard" class="game-config-button hard-button">
                    <span class="difficulty-icon">🔴</span>
                    <span class="difficulty-name">HARD</span>
                    <span class="difficulty-desc">Might traumatize you</span>
                </button>
            </div>
        </div>
        
    </div>
</div>
`;

