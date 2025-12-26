/**
 * UI Helper utilities
 * Functions to manage the user interface (messages, inputs, etc.)
 */

/**
 * Get an input element by its ID
 */
export function getInputElement(id: string): HTMLInputElement | null {
    return document.getElementById(id) as HTMLInputElement | null;
}

/**
 * Get the value of an input without leading/trailing white spaces
 */
export function getInputValue(id: string): string {
    return getInputElement(id)?.value?.trim() || '';
}

/**
 * Get the value of a password input
 */
export function getPasswordValue(id: string): string {
    return getInputElement(id)?.value || '';
}

/**
 * Create or get a message element to display errors/success
 * @param messageId - ID of the message element
 * @param buttonId - ID of the parent button (to insert the message next to it)
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
 * Show a success message (green)
 */
export function showSuccessMessage(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = 'lightgreen';
}

/**
 * Show an error message (red)
 */
export function showErrorMessage(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = '#ef4444'; // Red for better visibility
    element.style.display = 'block';
}

/**
 * Show a critical error message (red)
 */
export function showCriticalError(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.color = '#ef4444';
    element.style.display = 'block';
}

/**
 * Add an event listener for the Enter key on an input
 * @param inputId - ID of the input
 * @param callback - Function to call when Enter is pressed
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
 * Add Enter key listeners to multiple inputs
 */
export function addEnterKeyListeners(inputIds: string[], callback: () => void): void {
    inputIds.forEach(inputId => addEnterKeyListener(inputId, callback));
}
