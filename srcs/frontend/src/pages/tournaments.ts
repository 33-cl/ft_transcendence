import { show, load } from './utils.js';

// Page tournaments: liste minimale (fetch /tournaments)
export default async function tournamentsPage() {
    const containerId = 'tournamentsPage';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'p-4';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-bold mb-4">Tournois</h1>
            <div id="tournaments-list">Chargement...</div>
            <div class="mt-4">
                <button id="tournaments-back" class="px-4 py-2 bg-gray-700 text-white rounded">Retour</button>
            </div>
        </div>
    `;

    const backBtn = document.getElementById('tournaments-back');
    if (backBtn) backBtn.addEventListener('click', async () => { await load('mainMenu'); });

    const listContainer = document.getElementById('tournaments-list');
    try {
        const res = await fetch('/tournaments', { method: 'GET', credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data = await res.json();
        const tournaments = data.tournaments || [];

        if (tournaments.length === 0) {
            listContainer!.innerHTML = '<p>Aucun tournoi disponible.</p>';
        } else {
            const rows = tournaments.map((t: any) => `
                <div class="p-3 border-b flex justify-between items-center">
                    <div>
                        <div class="font-medium">${t.name}</div>
                        <div class="text-sm text-gray-400">Status: ${t.status} — ${t.current_players}/${t.max_players} joueurs</div>
                    </div>
                    <div>
                        <button data-id="${t.id}" class="view-tournament px-3 py-1 bg-blue-600 text-white rounded">Voir</button>
                    </div>
                </div>
            `).join('');
            listContainer!.innerHTML = `<div class="bg-white shadow rounded">${rows}</div>`;

            // Attach click handlers
            document.querySelectorAll('.view-tournament').forEach(btn => {
                (btn as HTMLElement).addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                    if (id) {
                        // Pour l'instant, on load la page detail si elle existe
                        // TODO: implémenter load('tournamentDetail') plus tard
                        alert('Ouvrir le tournoi: ' + id);
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error loading tournaments:', error);
        listContainer!.innerHTML = '<p>Erreur lors du chargement des tournois.</p>';
    }

    // Ensure the page is shown via existing SPA helpers
    show(containerId as any);
}
