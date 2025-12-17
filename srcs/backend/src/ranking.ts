import db from './db.js';

export interface UserRanking {
  id: number;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  rank: number;
  winRate: number;
}

export interface RankingOptions {
  limit?: number;
  offset?: number;
}

/**
 * Classe pour gérer le système de classement des utilisateurs
 * Logique : Classé par nombre de victoires, à victoires égales celui qui a le moins de défaites est au-dessus
 */
export class RankingSystem {
  
  /**
   * Récupère le leaderboard complet avec le classement
   * @param options Options de pagination et de tri
   * @returns Liste des utilisateurs classés
   */
  public static getLeaderboard(options: RankingOptions = {}): UserRanking[] {
    const { limit = 100, offset = 0 } = options;
    
    try {
      // Requête SQL avec classement : ORDER BY wins DESC (plus de victoires), puis losses ASC (moins de défaites)
      const query = `
        SELECT 
          id, 
          username, 
          avatar_url, 
          wins, 
          losses,
          CASE 
            WHEN wins + losses = 0 THEN 0.0
            ELSE CAST(wins AS REAL) / (wins + losses)
          END as win_rate
        FROM users 
        WHERE wins > 0 OR losses > 0
        ORDER BY wins DESC, losses ASC, username ASC
        LIMIT ? OFFSET ?
      `;
      
      const users = db.prepare(query).all(limit, offset) as any[];
      
      // Ajouter le rang à chaque utilisateur
      return users.map((user, index) => ({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        wins: user.wins,
        losses: user.losses,
        rank: offset + index + 1,
        winRate: parseFloat(user.win_rate.toFixed(3))
      }));
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Récupère le classement d'un utilisateur spécifique
   * @param userId ID de l'utilisateur
   * @returns Position de l'utilisateur dans le classement ou null si non trouvé
   */
  public static getUserRank(userId: number): number | null {
    try {
      // Sous-requête pour calculer le rang de l'utilisateur
      const query = `
        WITH ranked_users AS (
          SELECT 
            id,
            wins,
            losses,
            ROW_NUMBER() OVER (ORDER BY wins DESC, losses ASC, username ASC) as rank
          FROM users
          WHERE wins > 0 OR losses > 0
        )
        SELECT rank FROM ranked_users WHERE id = ?
      `;
      
      const result = db.prepare(query).get(userId) as any;
      return result ? result.rank : null;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Récupère les informations de classement détaillées d'un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Informations complètes de classement ou null si non trouvé
   */
  public static getUserRankingInfo(userId: number): UserRanking | null
  {
    try {
      const rank = this.getUserRank(userId);
      if (rank === null)
        return null;
      
      const userQuery = `
        SELECT 
          id, 
          username, 
          avatar_url, 
          wins, 
          losses,
          CASE 
            WHEN wins + losses = 0 THEN 0.0
            ELSE CAST(wins AS REAL) / (wins + losses)
          END as win_rate
        FROM users 
        WHERE id = ?
      `;
      
      const user = db.prepare(userQuery).get(userId) as any;
      
      if (!user) return null;
      
      return {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        wins: user.wins,
        losses: user.losses,
        rank: rank,
        winRate: parseFloat(user.win_rate.toFixed(3))
      };
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Récupère les utilisateurs autour d'une position donnée dans le classement
   * @param rank Position centrale
   * @param radius Nombre d'utilisateurs avant et après
   * @returns Liste des utilisateurs autour de cette position
   */
  public static getLeaderboardAroundRank(rank: number, radius: number = 2): UserRanking[] {
    const startRank = Math.max(1, rank - radius);
    const limit = (radius * 2) + 1;
    const offset = startRank - 1;
    
    return this.getLeaderboard({ limit, offset });
  }

  /**
   * Compare deux utilisateurs selon les règles de classement
   * @param userA Premier utilisateur
   * @param userB Deuxième utilisateur  
   * @returns Valeur négative si A > B, positive si B > A, 0 si égaux
   */
  public static compareUsers(userA: { wins: number; losses: number; username: string }, 
                            userB: { wins: number; losses: number; username: string }): number {
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

  /**
   * Récupère les statistiques globales du classement
   * @returns Statistiques du leaderboard
   */
  public static getLeaderboardStats(): { totalPlayers: number; totalGames: number; averageWinRate: number } {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_players,
          SUM(wins + losses) as total_games,
          AVG(CASE 
            WHEN wins + losses = 0 THEN 0.0
            ELSE CAST(wins AS REAL) / (wins + losses)
          END) as avg_win_rate
        FROM users
        WHERE wins > 0 OR losses > 0
      `;
      
      const stats = db.prepare(statsQuery).get() as any;
      
      return {
        totalPlayers: stats.total_players || 0,
        totalGames: Math.floor((stats.total_games || 0) / 2), // Diviser par 2 car chaque match compte pour 2 (un win et un loss)
        averageWinRate: parseFloat((stats.avg_win_rate || 0).toFixed(3))
      };
      
    } catch (error) {
      return { totalPlayers: 0, totalGames: 0, averageWinRate: 0 };
    }
  }
}

export default RankingSystem;