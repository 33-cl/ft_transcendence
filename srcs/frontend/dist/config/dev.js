// Configuration pour les fonctionnalités de développement
// Pour désactiver le bouton Skip Login en production, changez DEV_MODE à false
export const DEV_CONFIG = {
    // Activer/désactiver le bouton Skip Login
    SKIP_LOGIN_ENABLED: true, // Changez à false pour désactiver en production
    // Données de l'utilisateur de test
    DEV_USER: {
        id: 999,
        email: 'dev@test.com',
        username: 'DevUser',
        avatar_url: '/avatars/avatar_1_1756652941263.jpeg',
        wins: 5,
        losses: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
};
//# sourceMappingURL=dev.js.map