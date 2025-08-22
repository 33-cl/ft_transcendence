import db from './db.js';
export function getUserById(id) {
    return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE id = ?').get(id);
}
export function getUserByUsername(username) {
    return db.prepare('SELECT id, username, email, avatar_url, wins, losses, created_at FROM users WHERE username = ?').get(username);
}
export function updateUserStats(winnerId, loserId, winnerScore, loserScore, matchType = 'online') {
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
export function getUserStats(id) {
    return db.prepare('SELECT username, wins, losses FROM users WHERE id = ?').get(id);
}
export function getMatchHistory(userId, limit = 10) {
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
