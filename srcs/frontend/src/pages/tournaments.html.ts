export function tournamentsHTML() {
    return `
        <div class="max-w-3xl mx-auto p-4">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-3xl font-bold">Tournois 4-Player</h1>
                <button id="create-tournament-btn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                    ➕ Créer Tournoi
                </button>
            </div>
            <div id="tournaments-list">
                <div class="text-center py-8">
                    <p class="text-gray-500">Chargement des tournois...</p>
                </div>
            </div>
            <div class="mt-4">
                <button id="tournaments-back" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Retour</button>
            </div>
        </div>
    `;
}