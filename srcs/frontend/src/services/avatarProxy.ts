// Converts Google avatar URLs to use the local proxy endpoint to avoid rate limiting
// Returns the original URL for non-Google avatars or the default if no URL is provided
export function getProxiedAvatarUrl(avatarUrl: string | null | undefined): string
{
    const defaultAvatar = '/img/planet.gif';
    
    if (!avatarUrl)
        return defaultAvatar;
    
    // Route Google-hosted avatars through the backend proxy to prevent rate limiting issues
    if (avatarUrl.includes('googleusercontent.com'))
        return `/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`;
    
    return avatarUrl;
}

// Sanitizes and proxies an avatar URL to ensure it is safe and properly routed
// Validates the URL format and protocol before returning it for use
export function getSafeAvatarUrl(avatarUrl: string | null | undefined): string
{
    const url = getProxiedAvatarUrl(avatarUrl);
    
    // Allow relative paths, absolute paths, and data URIs without further validation
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('data:'))
        return url;
    
    // Verify that external URLs use a safe protocol
    try
    {
        const parsed = new URL(url);
        
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:')
            return url;
    }
    catch
    {
        // Return the default avatar if URL parsing fails
        return '/img/planet.gif';
    }
    
    return '/img/planet.gif';
}