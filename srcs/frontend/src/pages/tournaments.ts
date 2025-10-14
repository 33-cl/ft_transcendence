import { show, load } from './utils.js';

// Page tournaments minimal (Hello world)
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
            <p class="mb-4">Hello world — page Tournois (étape minimal)</p>
            <button id="tournaments-back" class="px-4 py-2 bg-gray-700 text-white rounded">Retour</button>
        </div>
    `;

    const backBtn = document.getElementById('tournaments-back');
    if (backBtn) backBtn.addEventListener('click', async () => { await load('mainMenu'); });

    // Ensure the page is shown via existing SPA helpers
    show(containerId);
}
