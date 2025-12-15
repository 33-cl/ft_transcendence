/**
 * Helper pour obtenir l'URL d'avatar correcte
 * Utilise le proxy backend pour les avatars Google afin d'éviter le rate-limiting
 */

/**
 * Convertit une URL d'avatar Google en URL proxy locale
 * @param avatarUrl L'URL de l'avatar (peut être Google ou locale)
 * @returns L'URL à utiliser (proxy pour Google, originale sinon)
 */
export function getProxiedAvatarUrl(avatarUrl: string | null | undefined): string {
    const defaultAvatar = './img/planet.gif';
    
    if (!avatarUrl) {
        return defaultAvatar;
    }
    
    // Si c'est une URL Google, utiliser le proxy
    if (avatarUrl.includes('googleusercontent.com')) {
        return `/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`;
    }
    
    // Sinon, retourner l'URL originale
    return avatarUrl;
}

/**
 * Sanitize et proxy une URL d'avatar
 * Combine sanitization et proxy en une seule fonction
 */
export function getSafeAvatarUrl(avatarUrl: string | null | undefined): string {
    const url = getProxiedAvatarUrl(avatarUrl);
    
    // Validation basique de l'URL
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('data:')) {
        return url;
    }
    
    // Pour les URLs externes non-Google, vérifier le protocole
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return url;
        }
    } catch {
        // URL invalide, retourner l'avatar par défaut
        return './img/planet.gif';
    }
    
    return './img/planet.gif';
}
