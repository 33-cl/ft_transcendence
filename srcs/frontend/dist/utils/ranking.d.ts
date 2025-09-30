/**
 * Utilitaires pour le système de ranking côté frontend
 */
export interface UserRanking {
    id: number;
    username: string;
    avatar_url: string | null;
    wins: number;
    losses: number;
    rank: number;
    winRate: number;
}
export interface LeaderboardStats {
    totalPlayers: number;
    totalGames: number;
    averageWinRate: number;
}
/**
 * Récupère le leaderboard avec pagination
 * @param limit Nombre d'utilisateurs à récupérer
 * @param offset Décalage pour la pagination
 */
export declare function fetchLeaderboard(limit?: number, offset?: number): Promise<any>;
/**
 * Récupère le rang et les informations de classement d'un utilisateur
 * @param userId ID de l'utilisateur
 */
export declare function fetchUserRank(userId: number): Promise<UserRanking | null>;
/**
 * Récupère le classement autour d'un rang donné
 * @param rank Position centrale
 * @param radius Nombre d'utilisateurs avant et après
 */
export declare function fetchLeaderboardAroundRank(rank: number, radius?: number): Promise<any>;
/**
 * Formate le taux de victoire en pourcentage
 * @param winRate Taux de victoire (0.0 à 1.0)
 * @param decimals Nombre de décimales
 */
export declare function formatWinRate(winRate: number, decimals?: number): string;
/**
 * Formate les statistiques d'un utilisateur
 * @param user Données utilisateur avec wins/losses
 */
export declare function formatUserStats(user: {
    wins: number;
    losses: number;
}): string;
/**
 * Compare deux utilisateurs selon les règles de classement
 * (utilisé pour le tri côté client si nécessaire)
 */
export declare function compareUsersByRanking(userA: {
    wins: number;
    losses: number;
    username: string;
}, userB: {
    wins: number;
    losses: number;
    username: string;
}): number;
//# sourceMappingURL=ranking.d.ts.map