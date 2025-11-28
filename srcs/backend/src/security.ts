// Backend security utilities

/**
 * Sanitize username: remove HTML tags and enforce alphanumeric + underscore only
 * This prevents XSS attacks through usernames
 */
export function sanitizeUsername(username: string): string {
    if (typeof username !== 'string') {
        throw new Error('Username must be a string');
    }
    
    // Remove HTML tags
    const noHtml = username.replace(/<[^>]*>/g, '');
    
    // Only keep alphanumeric and underscore
    const sanitized = noHtml.replace(/[^a-zA-Z0-9_]/g, '');
    
    return sanitized;
}

/**
 * Sanitize email: basic validation and normalization
 */
export function sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
        throw new Error('Email must be a string');
    }
    
    // Remove HTML tags
    const noHtml = email.replace(/<[^>]*>/g, '');
    
    // Trim and lowercase
    return noHtml.trim().toLowerCase();
}

/**
 * Validate string length to prevent DoS attacks
 */
export function validateLength(input: string, minLength: number, maxLength: number): boolean {
    if (typeof input !== 'string') {
        return false;
    }
    
    return input.length >= minLength && input.length <= maxLength;
}

/**
 * Rate limiting configurations
 * Adapted limits based on action sensitivity and normal user behavior
 */
export const RATE_LIMITS = {
    // 🔴 CRITICAL - Very strict limits for security-sensitive actions
    LOGIN: { max: 10, window: 60000 },              // 5 attempts per minute - brute-force protection
    REGISTER: { max: 10, window: 60000 },           // 3 accounts per minute - spam prevention
    TWO_FA: { max: 10, window: 60000 },            // 10 attempts per minute - 2FA verification (allows typos)
    PASSWORD_RESET: { max: 10, window: 60000 },     // 3 resets per minute - abuse prevention
    
    // 🟡 MODERATE - Balanced limits for social actions
    FRIEND_REQUEST: { max: 10, window: 60000 },    // 10 requests per minute - spam prevention
    FRIEND_ACCEPT: { max: 20, window: 60000 },     // 20 accepts per minute - batch accepting OK
    FRIEND_REJECT: { max: 20, window: 60000 },     // 20 rejects per minute - batch rejecting OK
    FRIEND_REMOVE: { max: 10, window: 60000 },     // 10 removals per minute - prevent mass unfriend
    SEARCH_USERS: { max: 30, window: 60000 },      // 30 searches per minute - typing queries OK
    UPLOAD_AVATAR: { max: 5, window: 60000 },      // 5 uploads per minute - bandwidth protection
    
    // 🟢 PERMISSIVE - Higher limits for read-only or frequent actions
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

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = rateLimitMap.get(key) || [];
    
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    // Check if limit exceeded
    if (recentTimestamps.length >= maxRequests) {
        return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    rateLimitMap.set(key, recentTimestamps);
    
    return true;
}

/**
 * Validate and sanitize file paths to prevent directory traversal attacks
 */
export function sanitizeFilePath(filePath: string): string {
    if (typeof filePath !== 'string') {
        throw new Error('File path must be a string');
    }
    
    // Remove any attempts at directory traversal
    const sanitized = filePath.replace(/\.\./g, '').replace(/\\/g, '/');
    
    // Ensure it doesn't start with /
    return sanitized.replace(/^\/+/, '');
}

/**
 * Validate JWT token format (basic check before verification)
 */
export function isValidJwtFormat(token: string): boolean {
    if (typeof token !== 'string') {
        return false;
    }
    
    // JWT has 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
}

/**
 * Validate and parse ID parameter (for routes with :id)
 * Returns the ID as number if valid, null otherwise
 */
export function validateId(id: any): number | null {
    // Try to parse as integer
    const parsed = parseInt(id);
    
    // Check if it's a valid positive integer
    if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
        return null;
    }
    
    return parsed;
}

/**
 * Validate UUID format for tournament IDs
 */
export function validateUUID(id: any): boolean {
    if (typeof id !== 'string') {
        return false;
    }
    
    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    return uuidRegex.test(id);
}

/**
 * Validate room name format
 * Only allows alphanumeric, hyphens, and underscores
 */
export function validateRoomName(roomName: string): boolean {
    if (typeof roomName !== 'string') {
        return false;
    }
    
    // Check length
    if (roomName.length < 1 || roomName.length > 50) {
        return false;
    }
    
    // Only alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(roomName);
}

/**
 * Validate max players for a game room
 */
export function validateMaxPlayers(maxPlayers: any): boolean {
    const parsed = parseInt(maxPlayers);
    
    // Must be 2 or 4
    return parsed === 2 || parsed === 4;
}

/**
 * Clean up expired entries from rate limit map (run periodically)
 */
export function cleanupRateLimitMap(windowMs: number): void {
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
