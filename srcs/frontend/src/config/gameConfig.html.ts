export { initGameConfigManagers } from './config.js';

// Game mode selection page
export const gameConfigHTML = /*html*/`
<div id="game-config-page" class="ai-config-container">
    <h1>Game Configuration</h1>
    <div class="ai-config-content">
        <div class="game-mode-section">
            <h2>Choose game mode:</h2>
            <div class="game-mode-options">
                <button id="vs-ai" class="game-config-button">
                    <span class="difficulty-icon">
                        <img src="./img/bot.svg" alt="Bot icon" class="game-mode-icon"/>
                    </span>
                    <span class="difficulty-name">VS AI</span>
                    <span class="difficulty-desc">Fight the machine</span>
                </button>
                <button id="vs-player" class="game-config-button">
                    <span class="difficulty-icon">
                        <img src="./img/two-players.svg" alt="Two players icon" class="game-mode-icon"/>
                    </span>
                    <span class="difficulty-name">2 PLAYERS</span>
                    <span class="difficulty-desc" id="local2p">Local multiplayer</span>
                </button>
            </div>
        </div>
    </div>
</div>
`;
