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

export function validateLength(input: string, minLength: number, maxLength: number): boolean
{
    if (typeof input !== 'string')
        return false;
    
    return input.length >= minLength && input.length <= maxLength;
}

export const RATE_LIMITS = {
    LOGIN: { max: 10, window: 60000 },
    REGISTER: { max: 10, window: 60000 },
    TWO_FA: { max: 10, window: 60000 },
    PASSWORD_RESET: { max: 10, window: 60000 },
    FRIEND_REQUEST: { max: 10, window: 60000 },
    FRIEND_ACCEPT: { max: 20, window: 60000 },
    FRIEND_REJECT: { max: 20, window: 60000 },
    FRIEND_REMOVE: { max: 10, window: 60000 },
    SEARCH_USERS: { max: 30, window: 60000 },
    UPLOAD_AVATAR: { max: 5, window: 60000 },
    PROFILE_UPDATE: { max: 10, window: 60000 },
    GET_FRIENDS: { max: 60, window: 60000 },
    GET_STATUS: { max: 60, window: 60000 },
    GET_LEADERBOARD: { max: 30, window: 60000 },
    GET_PROFILE: { max: 40, window: 60000 },
    CHAT_MESSAGE: { max: 60, window: 60000 },
} as const;

const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean
{
    const now = Date.now();
    const timestamps = rateLimitMap.get(key) || [];
    
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    if (recentTimestamps.length >= maxRequests)
        return false;
    
    recentTimestamps.push(now);
    rateLimitMap.set(key, recentTimestamps);
    
    return true;
}

export function isValidJwtFormat(token: string): boolean
{
    if (typeof token !== 'string')
        return false;
    
    const parts = token.split('.');
    return parts.length === 3;
}

export function validateId(id: string | number | undefined | null): number | null
{
    if (id === undefined || id === null)
        return null;
    
    const parsed = parseInt(String(id));
    
    if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed))
        return null;
    
    return parsed;
}

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

export function validateRoomName(roomName: string): boolean
{
    if (typeof roomName !== 'string')
        return false;
    
    if (roomName.length < 1 || roomName.length > 50)
        return false;
    
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

export function validateMaxPlayers(maxPlayers: string | number | undefined | null): boolean
{
    if (maxPlayers === undefined || maxPlayers === null)
        return false;
    
    const parsed = parseInt(String(maxPlayers));
    
    return parsed === 2 || parsed === 4;
}

export function cleanupRateLimitMap(windowMs: number): void
{
    const now = Date.now();
    for (const [key, timestamps] of rateLimitMap.entries())
    {
        const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
        if (recentTimestamps.length === 0)
            rateLimitMap.delete(key);
        else
            rateLimitMap.set(key, recentTimestamps);
    }
}

setInterval(() => cleanupRateLimitMap(5 * 60 * 1000), 5 * 60 * 1000);
