type RulesContext = 'all' | 'local' | 'multiplayer' | 'tournament';

function getRulesContext(): RulesContext {
    const value = (window as any)?.rulesContext;
    if (value === 'local' || value === 'multiplayer' || value === 'tournament') return value;
    return 'all';
}

export function rulesHTML() {
    const ctx = getRulesContext();

    const title =
        ctx === 'local' ? 'LOCAL'
        : ctx === 'multiplayer' ? 'MULTIPLAYER'
        : ctx === 'tournament' ? 'TOURNAMENT'
        : 'RULES &amp; CONTROLS';

    const controlsAll = /*html*/`
        <p class="rules-mode-title first">Local 2 Player</p>
        <p class="rules-line">Player 1 (LEFT): <span class="rules-key">W</span> / <span class="rules-key">S</span></p>
        <p class="rules-line spaced">Player 2 (RIGHT): <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Local vs AI</p>
        <p class="rules-line spaced">You control the RIGHT paddle: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Local 4 Player</p>
        <p class="rules-line">LEFT: <span class="rules-key">W</span> / <span class="rules-key">S</span></p>
        <p class="rules-line">RIGHT: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>
        <p class="rules-line">DOWN (bottom paddle): <span class="rules-key">V</span> (left) / <span class="rules-key">B</span> (right)</p>
        <p class="rules-line spaced">TOP (top paddle): <span class="rules-key">O</span> (left) / <span class="rules-key">P</span> (right)</p>

        <p class="rules-mode-title">Online 2 Player</p>
        <p class="rules-line spaced">Your paddle: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Online 4 Player</p>
        <p class="rules-line">Your paddle is shown at the bottom: <span class="rules-key">ArrowLeft</span> / <span class="rules-key">ArrowRight</span></p>
    `;

    const controlsLocal = /*html*/`
        <p class="rules-mode-title first">Local 2 Player</p>
        <p class="rules-line">Player 1 (LEFT): <span class="rules-key">W</span> / <span class="rules-key">S</span></p>
        <p class="rules-line spaced">Player 2 (RIGHT): <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Local vs AI</p>
        <p class="rules-line spaced">You control the RIGHT paddle: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Local 4 Player</p>
        <p class="rules-line">LEFT: <span class="rules-key">W</span> / <span class="rules-key">S</span></p>
        <p class="rules-line">RIGHT: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>
        <p class="rules-line">DOWN (bottom paddle): <span class="rules-key">V</span> (left) / <span class="rules-key">B</span> (right)</p>
        <p class="rules-line spaced">TOP (top paddle): <span class="rules-key">O</span> (left) / <span class="rules-key">P</span> (right)</p>
    `;

    const controlsMultiplayer = /*html*/`
        <p class="rules-mode-title first">Online 2 Player</p>
        <p class="rules-line spaced">Your paddle: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>

        <p class="rules-mode-title">Online 4 Player</p>
        <p class="rules-line">Your paddle is shown at the bottom: <span class="rules-key">ArrowLeft</span> / <span class="rules-key">ArrowRight</span></p>
    `;

    const controlsTournament = /*html*/`
        <p class="rules-mode-title first">Tournament (matches)</p>
        <p class="rules-line spaced">Your paddle: <span class="rules-key">ArrowUp</span> / <span class="rules-key">ArrowDown</span></p>
    `;

    const rulesCommon = /*html*/`
        <p class="rules-line">First to 3 points wins.</p>
        <p class="rules-line">A point is scored when half of the ball crosses the border.</p>
        <p class="rules-line">If the ball exits your side, your opponent scores.</p>
    `;

    const rulesTournament = /*html*/`
        <p class="rules-line"><span class="rules-key">Tournament</span>: 4-player bracket (two semifinals then a final).</p>
        <p class="rules-line">Each match uses the same scoring rules.</p>
    `;

    const controlsHtml =
        ctx === 'local' ? controlsLocal
        : ctx === 'multiplayer' ? controlsMultiplayer
        : ctx === 'tournament' ? controlsTournament
        : controlsAll;

    const rulesHtml =
        ctx === 'tournament' ? `${rulesCommon}${rulesTournament}`
        : rulesCommon;

    return /*html*/`
        <div class="rules-overlay">
            <div class="rules-box">
                <h2 class="rules-title">${title}</h2>

                <div class="rules-content">
                    <div>
                        ${controlsHtml}
                    </div>

                    <h3 class="rules-section-title spaced">Rules</h3>
                    <div>
                        ${rulesHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}
