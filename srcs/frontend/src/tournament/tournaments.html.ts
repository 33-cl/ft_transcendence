export function tournamentsHTML() {
    return `
        <div class="tournament-container">
            <div class="tournament-header">
                <h1 class="tournament-title">Tournois 4-Player</h1>
                <button id="create-tournament-btn" class="tournament-create-btn">
                    ➕ Créer Tournoi
                </button>
            </div>
            
            <!-- Formulaire de création inline (caché par défaut) -->
            <div id="tournament-create-form" class="tournament-create-form" style="display: none;">
                <input 
                    type="text" 
                    id="tournament-name-input" 
                    class="tournament-name-input" 
                    placeholder="Nom du tournoi (max 50 caractères)..."
                    maxlength="50"
                />
                <div class="tournament-create-actions">
                    <button id="confirm-create-btn" class="tournament-btn-small tournament-btn-confirm">✓</button>
                    <button id="cancel-create-btn" class="tournament-btn-small tournament-btn-cancel">✕</button>
                </div>
            </div>
            
            <div id="tournaments-list" class="tournament-list">
                <div class="tournament-loading">
                    <p class="tournament-loading-text">Chargement des tournois...</p>
                </div>
            </div>
        </div>
    `;
}
