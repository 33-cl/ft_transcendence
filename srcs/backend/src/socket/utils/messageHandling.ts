// ========================================
// MESSAGE HANDLING UTILITIES
// Parse et validation des messages clients
// ========================================

interface ClientMessage {
    type: string;
    data?: {
        player?: string;
        direction?: string;
    };
}

/**
 * Parse un message JSON du client de maniere securisee
 * 
 * @param msg - Le message JSON brut (string)
 * @returns L'objet parse ou null si erreur
 */
export function parseClientMessage(msg: string): ClientMessage | null
{
    try {
        return JSON.parse(msg);
    } catch (e) {
        return null;
    }
}

/**
 * Verifie si le message est un evenement clavier (keydown/keyup)
 * 
 * @param message - Le message parse
 * @returns true si c'est keydown ou keyup
 */
export function isKeyboardEvent(message: ClientMessage | null): boolean
{
    return message?.type === 'keydown' || message?.type === 'keyup';
}
