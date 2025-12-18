// tournamentSocket.ts - legacy tournament websocket handlers removed

// The tournament socket listeners were part of the legacy tournament UI.
// These no-op functions are kept to avoid runtime import errors in other modules.

export function setupTournamentSocketListeners(): void {
    console.warn('Tournament websocket listeners disabled (feature removed).');
}

export function cleanupTournamentSocketListeners(): void {
    // No-op
}

export function joinTournamentRoom(_tournamentId: string): void {
    // No-op
}

export function leaveTournamentRoom(_tournamentId: string): void {
    // No-op
}
