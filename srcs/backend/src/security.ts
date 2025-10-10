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
