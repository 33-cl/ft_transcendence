import db from './db.js';

export function getUserById(id: string) {
  return db.prepare('SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?').get(id);
}
