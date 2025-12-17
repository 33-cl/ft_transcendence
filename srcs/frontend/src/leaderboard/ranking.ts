export interface UserRanking
{
    id: number;
    username: string;
    avatar_url: string | null;
    wins: number;
    losses: number;
    rank: number;
    winRate: number;
}

export interface LeaderboardStats
{
    totalPlayers: number;
    totalGames: number;
    averageWinRate: number;
}

// Retrieve the global leaderboard data from the backend with pagination support to handle large datasets.
export async function fetchLeaderboard(limit: number = 10, offset: number = 0)
{
    try
    {
        const response = await fetch(`/users/leaderboard?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok)
            throw new Error('Failed to fetch leaderboard');

        return await response.json();
    }
    catch (error)
    {
        return { leaderboard: [], stats: { totalPlayers: 0, totalGames: 0, averageWinRate: 0 } };
    }
}

// Convert a decimal win rate into a readable percentage string with configurable precision.
export function formatWinRate(winRate: number, decimals: number = 1): string
{
    return (winRate * 100).toFixed(decimals) + '%';
}

// Generate a summary string displaying wins, losses, and calculated win rate for UI display.
export function formatUserStats(user: { wins: number; losses: number }): string
{
    const total = user.wins + user.losses;

    if (total === 0)
        return '0W - 0L';

    const winRate = user.wins / total;
    return `${user.wins}W - ${user.losses}L (${formatWinRate(winRate)})`;
}

// Determine the ranking order between two users based on wins, then losses, and finally alphabetical order for tie-breaking.
export function compareUsersByRanking(userA: { wins: number; losses: number; username: string },
    userB: { wins: number; losses: number; username: string }): number
{
    // Prioritize users with a higher win count.
    if (userA.wins !== userB.wins)
        return userB.wins - userA.wins;

    // If win counts are equal, prioritize users with fewer losses.
    if (userA.losses !== userB.losses)
        return userA.losses - userB.losses;

    // Resolve final ties using alphabetical order of the username.
    return userA.username.localeCompare(userB.username);
}