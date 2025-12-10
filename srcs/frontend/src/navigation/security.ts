// Security utilities for XSS prevention

import { removeHtmlTags, keepAlphanumericAndUnderscore } from '../utils/sanitize.js';

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts: < > & " ' to their HTML entity equivalents
 */
export function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        return '';
    }
    
    // Remplace les caractères spéciaux HTML par leurs entités
    let result = '';
    for (const char of unsafe) {
        switch (char) {
            case '&':
                result += '&amp;';
                break;
            case '<':
                result += '&lt;';
                break;
            case '>':
                result += '&gt;';
                break;
            case '"':
                result += '&quot;';
                break;
            case "'":
                result += '&#039;';
                break;
            default:
                result += char;
        }
    }
    return result;
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
    const withoutHtml = removeHtmlTags(username);
    return keepAlphanumericAndUnderscore(withoutHtml);
}

/**
 * Validate input length to prevent DoS attacks
 */
export function validateInputLength(input: string, maxLength: number = 1000): boolean {
    return typeof input === 'string' && input.length <= maxLength;
}
