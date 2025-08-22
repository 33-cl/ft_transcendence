import db from './db.js';

export function getUserById(id: string) {
  return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username: string) {
  return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE username = ?').get(username);
}

export function updateUserStats(winnerId: number, loserId: number, winnerScore: number, loserScore: number, matchType: string = 'online') {
  const updateWinner = db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?');
  const updateLoser = db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?');
  const insertMatch = db.prepare(`
    INSERT INTO matches (winner_id, loser_id, winner_score, loser_score, match_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Transaction pour s'assurer que tout se passe bien
  const transaction = db.transaction(() => {
    updateWinner.run(winnerId);
    updateLoser.run(loserId);
    insertMatch.run(winnerId, loserId, winnerScore, loserScore, matchType);
  });

  transaction();
}

export function getUserStats(id: string) {
  return db.prepare('SELECT username, wins, losses FROM users WHERE id = ?').get(id);
}

export function getMatchHistory(userId: string, limit: number = 10) {
  return db.prepare(`
    SELECT 
      m.*,
      winner.username as winner_name,
      loser.username as loser_name
    FROM matches m
    JOIN users winner ON m.winner_id = winner.id
    JOIN users loser ON m.loser_id = loser.id
    WHERE m.winner_id = ? OR m.loser_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(userId, userId, limit);
}

export function getUserByUsername(username: string) {
  return db.prepare('SELECT id, username, email, avatar_url, created_at FROM users WHERE username = ?').get(username);
}

// Fonction pour mettre à jour les statistiques des utilisateurs après un match
export function updateUserStats(winnerId: number, loserId: number, winnerScore: number, loserScore: number, matchType: string = 'online') {
  try {
    // Protection anti-triche : vérifier que ce ne sont pas le même utilisateur
    if (winnerId === loserId) {
      console.log(`[BACKEND] Même utilisateur détecté - pas d'enregistrement de statistiques (winnerId=${winnerId}, loserId=${loserId})`);
      return;
    }

    const winner = getUserById(winnerId.toString()) as any;
    const loser = getUserById(loserId.toString()) as any;

    if (!winner || !loser) {
      console.error(`[BACKEND] Utilisateur(s) non trouvé(s) pour les statistiques: winner=${winner}, loser=${loser}`);
      return;
    }

    console.log(`[BACKEND] Enregistrement match: ${winner.username} (${winnerScore}) vs ${loser.username} (${loserScore}) - type: ${matchType}`);

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

    // Enregistrer le match
    const insertMatch = db.prepare(`
      INSERT INTO matches (winner_id, loser_id, winner_score, loser_score, match_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertMatch.run(winnerId, loserId, winnerScore, loserScore, matchType);

    console.log(`[BACKEND] Match enregistré avec succès: ${winner.username} vs ${loser.username}`);

  } catch (error) {
    console.error(`[BACKEND] Erreur lors de l'enregistrement des statistiques:`, error);
  }
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
      ORDER BY m.played_at DESC
      LIMIT ?
    `).all(userId, userId, limit);

    return matches;
  } catch (error) {
    console.error(`[BACKEND] Erreur lors de la récupération de l'historique:`, error);
    return [];
  }
}
