export function tournamentsHTML() {
    return `
        <div class="w-full max-w-4xl text-center">
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-white mb-4">Tournois 4-Player</h1>
                <button id="create-tournament-btn" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
                    ➕ Créer Tournoi
                </button>
            </div>
            <div id="tournaments-list" class="mb-6 min-h-[200px]">
                <div class="text-center py-8">
                    <p class="text-gray-300">Chargement des tournois...</p>
                </div>
            </div>
            <div class="text-center">
                <button id="tournaments-back" class="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">Retour</button>
            </div>
        </div>
    `;
}