// DEPRECATED: Tournament detail view removed// File neutralized — legacy tournament detail implementation removed.

// Keep a minimal stub to avoid runtime import errors.// All previous helpers and rendering logic removed to eliminate old tournament UI.


export default async function renderTournamentDetail(_tournamentId: string): Promise<void> {
    // Optionally, navigate back to main menu if called
    try {
        const module = await import('../navigation/utils.js');
        module.load('mainMenu');
    } catch (e) {
        // ignore
    }
}
