import db from './db.js';

export function getUserById(id: string)
{
  return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username: string) {
  return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE username = ?').get(username);
}

// Fonction pour mettre à jour les statistiques des utilisateurs après un match
export function updateUserStats(winnerId: number, loserId: number, winnerScore: number, loserScore: number, matchType: string = 'online') {
  try {

    if (winnerId === loserId)
      return;

    const winner = getUserById(winnerId.toString()) as any;
    const loser = getUserById(loserId.toString()) as any;

    if (!winner || !loser)
      return;

    // Créer la table matches si elle n'existe pas
    db.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_id INTEGER NOT NULL,
        loser_id INTEGER NOT NULL,
        winner_score INTEGER NOT NULL,
        loser_score INTEGER NOT NULL,
        match_type TEXT DEFAULT 'online',
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(winner_id) REFERENCES users(id),
        FOREIGN KEY(loser_id) REFERENCES users(id)
      )
    `);

    // Mettre à jour les stats des utilisateurs et enregistrer le match dans une transaction
    const updateWinner = db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?');
    const updateLoser = db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?');
    const insertMatch = db.prepare(`
      INSERT INTO matches (winner_id, loser_id, winner_score, loser_score, match_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Transaction -> toutes les opérations réussissent ou aucune
    const transaction = db.transaction(() => {
      updateWinner.run(winnerId);
      updateLoser.run(loserId);
      insertMatch.run(winnerId, loserId, winnerScore, loserScore, matchType);
    });

    transaction();

  } catch (error) {
  }
}

export function getUserStats(id: string) {
  return db.prepare('SELECT username, wins, losses FROM users WHERE id = ?').get(id);
}

// Fonction pour récupérer l'historique des matchs d'un utilisateur
export function getMatchHistory(userId: string, limit: number = 10) {
  try {
    const matches = db.prepare(`
      SELECT 
        m.*,
        winner.username as winner_username,
        loser.username as loser_username
      FROM matches m
      LEFT JOIN users winner ON winner.id = m.winner_id
      LEFT JOIN users loser ON loser.id = m.loser_id
      WHERE m.winner_id = ? OR m.loser_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(userId, userId, limit);

    return matches;
  } catch (error) {
    return [];
  }
}
