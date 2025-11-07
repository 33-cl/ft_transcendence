export function tournamentsHTML() {
    return `
        <div class="tournament-container">
            <div class="tournament-header">
                <h1 class="tournament-title">Tournois 4-Player</h1>
                <button id="create-tournament-btn" class="tournament-create-btn">
                    ➕ Créer Tournoi
                </button>
            </div>
            <div id="tournaments-list" class="tournament-list">
                <div class="tournament-loading">
                    <p class="tournament-loading-text">Chargement des tournois...</p>
                </div>
            </div>
        </div>
    `;
}
