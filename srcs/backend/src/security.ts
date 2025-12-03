// Backend security utilities

/**
 * Sanitize username: remove HTML tags and enforce alphanumeric + underscore only
 * This prevents XSS attacks through usernames
 */
export function sanitizeUsername(username: string): string
{
    if (typeof username !== 'string')
        throw new Error('Username must be a string');
    
    // Remove HTML tags by extracting only text content
    let result = '';
    let inTag = false;
    for (const char of username)
    {
        if (char === '<')
            inTag = true;
        else if (char === '>')
            inTag = false;
        else if (!inTag)
            result += char;
    }
    
    // Only keep alphanumeric and underscore (a-z, A-Z, 0-9, _)
    let sanitized = '';
    for (const char of result)
    {
        const isLowercase = char >= 'a' && char <= 'z';
        const isUppercase = char >= 'A' && char <= 'Z';
        const isDigit = char >= '0' && char <= '9';
        const isUnderscore = char === '_';
        
        if (isLowercase || isUppercase || isDigit || isUnderscore)
            sanitized += char;
    }
    
    return sanitized;
}

/**
 * Sanitize email: basic validation and normalization
 */
export function sanitizeEmail(email: string): string
{
    if (typeof email !== 'string')
        throw new Error('Email must be a string');
    
    // Remove HTML tags by extracting only text content
    let result = '';
    let inTag = false;
    for (const char of email)
    {
        if (char === '<')
            inTag = true;
        else if (char === '>')
            inTag = false;
        else if (!inTag)
            result += char;
    }
    
    // Trim and lowercase
    return result.trim().toLowerCase();
}

/**
 * Validate string length to prevent DoS attacks
 */
export function validateLength(input: string, minLength: number, maxLength: number): boolean
{
    if (typeof input !== 'string')
        return false;
    
    return input.length >= minLength && input.length <= maxLength;
}

/**
 * Rate limiting configurations
 * Adapted limits based on action sensitivity and normal user behavior
 */
export const RATE_LIMITS = {
    // CRITICAL - Very strict limits for security-sensitive actions
    LOGIN: { max: 10, window: 60000 },              // 5 attempts per minute - brute-force protection
    REGISTER: { max: 10, window: 60000 },           // 3 accounts per minute - spam prevention
    TWO_FA: { max: 10, window: 60000 },            // 10 attempts per minute - 2FA verification (allows typos)
    PASSWORD_RESET: { max: 10, window: 60000 },     // 3 resets per minute - abuse prevention
    
    // MODERATE - Balanced limits for social actions
    FRIEND_REQUEST: { max: 10, window: 60000 },    // 10 requests per minute - spam prevention
    FRIEND_ACCEPT: { max: 20, window: 60000 },     // 20 accepts per minute - batch accepting OK
    FRIEND_REJECT: { max: 20, window: 60000 },     // 20 rejects per minute - batch rejecting OK
    FRIEND_REMOVE: { max: 10, window: 60000 },     // 10 removals per minute - prevent mass unfriend
    SEARCH_USERS: { max: 30, window: 60000 },      // 30 searches per minute - typing queries OK
    UPLOAD_AVATAR: { max: 5, window: 60000 },      // 5 uploads per minute - bandwidth protection
    PROFILE_UPDATE: { max: 10, window: 60000 },    // 10 updates per minute - prevent spam
    
    //PERMISSIVE - Higher limits for read-only or frequent actions
    GET_FRIENDS: { max: 60, window: 60000 },       // 60 per minute - auto-refresh OK
    GET_STATUS: { max: 60, window: 60000 },        // 60 per minute - real-time status OK
    GET_LEADERBOARD: { max: 30, window: 60000 },   // 30 per minute - dashboard views OK
    GET_PROFILE: { max: 40, window: 60000 },       // 40 per minute - browsing profiles OK
    CHAT_MESSAGE: { max: 60, window: 60000 },      // 60 messages per minute - active chat OK
} as const;

/**
 * Rate limiting helper: check if an action is allowed based on timestamp
 * Returns true if action is allowed, false if rate limited
 */
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean
{
    const now = Date.now();
    const timestamps = rateLimitMap.get(key) || [];
    
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    // Check if limit exceeded
    if (recentTimestamps.length >= maxRequests)
        return false;
    
    // Add current timestamp
    recentTimestamps.push(now);
    rateLimitMap.set(key, recentTimestamps);
    
    return true;
}

/*
    Validate and sanitize file paths to prevent directory traversal attacks
    "../../../etc/passwd"  →  "///etc/passwd"
 */
export function sanitizeFilePath(filePath: string): string
{
    if (typeof filePath !== 'string')
        throw new Error('File path must be a string');
    
    // Remove directory traversal attempts (..)
    let sanitized = '';
    let i = 0;
    while (i < filePath.length)
    {
        // Skip ".." sequences
        if (filePath[i] === '.' && filePath[i + 1] === '.')
        {
            i += 2;
            continue;
        }
        // Convert backslashes to forward slashes
        if (filePath[i] === '\\')
            sanitized += '/';
        else
            sanitized += filePath[i];
        i++;
    }
    
    // Remove leading slashes
    while (sanitized.startsWith('/'))
        sanitized = sanitized.slice(1);
    
    return sanitized;
}

/**
 * Validate JWT token format (basic check before verification)
 */
export function isValidJwtFormat(token: string): boolean
{
    if (typeof token !== 'string')
        return false;
    
    // JWT has 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
}

/**
 * Validate and parse ID parameter (for routes with :id)
 * Returns the ID as number if valid, null otherwise
 * @param id - URL parameter (always string) or body value
 */
export function validateId(id: string | number | undefined | null): number | null
{
    if (id === undefined || id === null)
        return null;
    
    // Try to parse as integer
    const parsed = parseInt(String(id));
    
    // Check if it's a valid positive integer
    if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed))
        return null;
    
    return parsed;
}

/**
 * Validate UUID format for tournament IDs
 * UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is hex digit (0-9, a-f) and y is 8, 9, a, or b
 * @param id - URL parameter or body value to validate
 */
export function validateUUID(id: string | undefined | null): boolean
{
    if (typeof id !== 'string')
        return false;
    
    if (id.length !== 36)
        return false;
    
    if (id[8] !== '-' || id[13] !== '-' || id[18] !== '-' || id[23] !== '-')
        return false;
    
    const isHex = (char: string): boolean => {
        return (char >= '0' && char <= '9') || 
               (char >= 'a' && char <= 'f') || 
               (char >= 'A' && char <= 'F');
    };
    
    for (let i = 0; i < id.length; i++)
    {
        if (i === 8 || i === 13 || i === 18 || i === 23)
            continue;
        
        if (i === 14)
        {
            if (id[i] !== '4')
                return false;
            continue;
        }
        
        if (i === 19)
        {
            const char = id[i].toLowerCase();
            if (char !== '8' && char !== '9' && char !== 'a' && char !== 'b')
                return false;
            continue;
        }
        
        if (!isHex(id[i]))
            return false;
    }
    
    return true;
}

/**
 * Validate room name format
 * Only allows alphanumeric, hyphens, and underscores
 */
export function validateRoomName(roomName: string): boolean
{
    if (typeof roomName !== 'string')
        return false;
    
    // Check length
    if (roomName.length < 1 || roomName.length > 50)
        return false;
    
    // Only alphanumeric, hyphens, and underscores
    for (const char of roomName)
    {
        const isLowercase = char >= 'a' && char <= 'z';
        const isUppercase = char >= 'A' && char <= 'Z';
        const isDigit = char >= '0' && char <= '9';
        const isAllowed = char === '_' || char === '-';
        
        if (!isLowercase && !isUppercase && !isDigit && !isAllowed)
            return false;
    }
    
    return true;
}

/**
 * Validate max players for a game room
 * @param maxPlayers - Body value from request (can be string from form or number from JSON)
 */
export function validateMaxPlayers(maxPlayers: string | number | undefined | null): boolean
{
    if (maxPlayers === undefined || maxPlayers === null)
        return false;
    
    const parsed = parseInt(String(maxPlayers));
    
    // Must be 2 or 4
    return parsed === 2 || parsed === 4;
}

/*
    nettoie le tableau qui enregistre les timestamps des requêtes pour le rate limiting
 */
export function cleanupRateLimitMap(windowMs: number): void
{
    const now = Date.now();
    for (const [key, timestamps] of rateLimitMap.entries()) {
        const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
        if (recentTimestamps.length === 0) {
            rateLimitMap.delete(key);
        } else {
            rateLimitMap.set(key, recentTimestamps);
        }
    }
}

// Clean up rate limit map every 5 minutes
setInterval(() => cleanupRateLimitMap(5 * 60 * 1000), 5 * 60 * 1000);
