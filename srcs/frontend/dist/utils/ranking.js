/**
 * Utilitaires pour le système de ranking côté frontend
 */
/**
 * Récupère le leaderboard avec pagination
 * @param limit Nombre d'utilisateurs à récupérer
 * @param offset Décalage pour la pagination
 */
export async function fetchLeaderboard(limit = 10, offset = 0) {
    try {
        const response = await fetch(`/users/leaderboard?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        return { leaderboard: [], stats: { totalPlayers: 0, totalGames: 0, averageWinRate: 0 } };
    }
}
/**
 * Récupère le rang et les informations de classement d'un utilisateur
 * @param userId ID de l'utilisateur
 */
export async function fetchUserRank(userId) {
    try {
        const response = await fetch(`/users/${userId}/rank`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            if (response.status === 404) {
                return null; // Utilisateur pas trouvé ou pas de données de classement
            }
            throw new Error('Failed to fetch user rank');
        }
        const data = await response.json();
        return data.ranking;
    }
    catch (error) {
        console.error('Error fetching user rank:', error);
        return null;
    }
}
/**
 * Récupère le classement autour d'un rang donné
 * @param rank Position centrale
 * @param radius Nombre d'utilisateurs avant et après
 */
export async function fetchLeaderboardAroundRank(rank, radius = 2) {
    try {
        const response = await fetch(`/users/leaderboard/around/${rank}?radius=${radius}`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard around rank');
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching leaderboard around rank:', error);
        return { leaderboard: [], centerRank: rank, radius };
    }
}
/**
 * Formate le taux de victoire en pourcentage
 * @param winRate Taux de victoire (0.0 à 1.0)
 * @param decimals Nombre de décimales
 */
export function formatWinRate(winRate, decimals = 1) {
    return (winRate * 100).toFixed(decimals) + '%';
}
/**
 * Formate les statistiques d'un utilisateur
 * @param user Données utilisateur avec wins/losses
 */
export function formatUserStats(user) {
    const total = user.wins + user.losses;
    if (total === 0)
        return '0W - 0L';
    const winRate = user.wins / total;
    return `${user.wins}W - ${user.losses}L (${formatWinRate(winRate)})`;
}
/**
 * Compare deux utilisateurs selon les règles de classement
 * (utilisé pour le tri côté client si nécessaire)
 */
export function compareUsersByRanking(userA, userB) {
    // D'abord comparer par nombre de victoires (décroissant)
    if (userA.wins !== userB.wins) {
        return userB.wins - userA.wins;
    }
    // Si même nombre de victoires, comparer par nombre de défaites (croissant)
    if (userA.losses !== userB.losses) {
        return userA.losses - userB.losses;
    }
    // Si même wins et losses, ordre alphabétique par username
    return userA.username.localeCompare(userB.username);
}
//# sourceMappingURL=ranking.js.map