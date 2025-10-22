/**
 * UI Helper utilities
 * Fonctions pour gérer l'interface utilisateur (messages, inputs, etc.)
 */

/**
 * Récupère un élément input par son ID
 */
export function getInputElement(id: string): HTMLInputElement | null {
    return document.getElementById(id) as HTMLInputElement | null;
}

/**
 * Recupere la valeur d'un input sans white spaces au debut/fin
 */
export function getInputValue(id: string): string {
    return getInputElement(id)?.value?.trim() || '';
}

/**
 * Recupere la valeur d'un input password 
 */
export function getPasswordValue(id: string): string {
    return getInputElement(id)?.value || '';
}

/**
 * Crée ou récupère un élément de message pour afficher des erreurs/succès
 * @param messageId - ID de l'élément de message
 * @param buttonId - ID du bouton parent (pour insérer le message à côté)
 */
export function ensureMessageElement(messageId: string, buttonId: string): HTMLElement {
    let el = document.getElementById(messageId);
    if (!el) {
        el = document.createElement('div');
        el.id = messageId;
        el.style.marginTop = '8px';
        const container = document.getElementById(buttonId)?.parentElement;
        container?.appendChild(el);
    }
    return el;
}

/**
 * Affiche un message de succès (vert)
 */
export function showSuccessMessage(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = 'lightgreen';
}

/**
 * Affiche un message d'erreur (orange)
 */
export function showErrorMessage(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = 'orange';
}

/**
 * Affiche un message d'erreur critique (rouge)
 */
export function showCriticalError(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = 'red';
}

/**
 * Ajoute un event listener pour la touche Entrée sur un input
 * @param inputId - ID de l'input
 * @param callback - Fonction à appeler quand Entrée est pressée
 */
export function addEnterKeyListener(inputId: string, callback: () => void): void {
    const input = getInputElement(inputId);
    if (input && !(input as any)._enterBound) {
        (input as any)._enterBound = true;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                callback();
            }
        });
    }
}

/**
 * Ajoute des listeners Entrée sur plusieurs inputs
 */
export function addEnterKeyListeners(inputIds: string[], callback: () => void): void {
    inputIds.forEach(inputId => addEnterKeyListener(inputId, callback));
}
