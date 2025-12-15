export const rulesHTML = /*html*/`
    <div class="rules-overlay">
        <div class="rules-box">
            <h2 class="rules-title">RULES &amp; CONTROLS</h2>

            <div class="rules-content">
                <h3 class="rules-section-title">Controls</h3>
                <p class="rules-muted">Keyboard only.</p>

                <div>
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
                </div>

                <h3 class="rules-section-title spaced">Rules</h3>
                <div>
                    <p class="rules-line">First to <span class="rules-key">3</span> points wins.</p>
                    <p class="rules-line">A point is scored when <span class="rules-key">half of the ball</span> crosses the border.</p>
                    <p class="rules-line">If the ball exits your side, your opponent scores.</p>
                    <p class="rules-line"><span class="rules-key">Tournament</span>: 4-player bracket (two semifinals then a final). Each match uses the same scoring rules.</p>
                </div>
            </div>
        </div>
    </div>
`;
