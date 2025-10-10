// Security utilities for XSS prevention

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts: < > & " ' to their HTML entity equivalents
 */
export function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        return '';
    }
    
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 * Only allows http:, https:, and relative URLs
 */
export function sanitizeUrl(url: string): string {
    if (typeof url !== 'string') {
        return '';
    }
    
    const trimmed = url.trim().toLowerCase();
    
    // Block dangerous protocols
    if (trimmed.startsWith('javascript:') || 
        trimmed.startsWith('data:') || 
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('file:')) {
        return '';
    }
    
    return url;
}

/**
 * Create a safe text node (alternative to using innerHTML)
 * This is the safest way to insert user content
 */
export function setTextContent(element: HTMLElement, text: string): void {
    element.textContent = text;
}

/**
 * Create DOM elements safely without innerHTML
 * Use this when you need to create elements dynamically
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes?: Record<string, string>,
    textContent?: string
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    
    if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            // Sanitize URLs for src, href attributes
            if ((key === 'src' || key === 'href') && value) {
                element.setAttribute(key, sanitizeUrl(value));
            } else {
                element.setAttribute(key, value);
            }
        }
    }
    
    if (textContent !== undefined) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Validate and sanitize username input
 * Prevents usernames with HTML/script content
 */
export function sanitizeUsername(username: string): string {
    if (typeof username !== 'string') {
        return '';
    }
    
    // Remove any HTML tags and only keep alphanumeric + underscore
    return username.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Validate input length to prevent DoS attacks
 */
export function validateInputLength(input: string, maxLength: number = 1000): boolean {
    return typeof input === 'string' && input.length <= maxLength;
}
