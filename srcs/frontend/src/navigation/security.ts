import { removeHtmlTags, keepAlphanumericAndUnderscore } from '../utils/sanitize.js';

// Converts potentially dangerous characters into safe HTML entities to neutralize script injection.
export function escapeHtml(unsafe: string): string
{
    if (typeof unsafe !== 'string')
        return '';

    let result = '';

    for (const char of unsafe)
    {
        switch (char)
        {
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

// Validates URLs by rejecting schemes that execute code, such as javascript: or vbscript:.
export function sanitizeUrl(url: string): string
{
    if (typeof url !== 'string')
        return '';

    const trimmed = url.trim().toLowerCase();

    if (trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('file:'))
        return '';

    return url;
}

// Safely inserts text into a DOM node using the textContent property to avoid parsing HTML.
export function setTextContent(element: HTMLElement, text: string): void
{
    element.textContent = text;
}

// Programmatically constructs a DOM element and safely applies attributes to prevent injection attacks.
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes?: Record<string, string>,
    textContent?: string
): HTMLElementTagNameMap[K]
{
    const element = document.createElement(tag);

    if (attributes)
    {
        for (const [key, value] of Object.entries(attributes))
        {
            if ((key === 'src' || key === 'href') && value)
                element.setAttribute(key, sanitizeUrl(value));
            else
                element.setAttribute(key, value);
        }
    }

    if (textContent !== undefined)
        element.textContent = textContent;

    return element;
}

// Enforces strict formatting on usernames by stripping HTML and non-alphanumeric characters.
export function sanitizeUsername(username: string): string
{
    if (typeof username !== 'string')
        return '';

    const withoutHtml = removeHtmlTags(username);
    return keepAlphanumericAndUnderscore(withoutHtml);
}

// Checks input string length to prevent resource exhaustion or buffer overflow issues.
export function validateInputLength(input: string, maxLength: number = 1000): boolean
{
    return typeof input === 'string' && input.length <= maxLength;
}