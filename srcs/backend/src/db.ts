import Database from 'better-sqlite3';

// Ouvre (ou crée) la base SQLite dans le volume persistant
const db = new Database('/app/db/pong.db');

// Schéma minimal pour user management (étape 1)
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    provider TEXT DEFAULT 'local',
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner_id INTEGER NOT NULL,
    loser_id INTEGER NOT NULL,
    winner_score INTEGER NOT NULL,
    loser_score INTEGER NOT NULL,
    match_type TEXT NOT NULL, -- 'online', 'tournament' (pas de 'local' car jamais enregistré)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(winner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(loser_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS active_tokens (
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME,
    PRIMARY KEY(user_id, token),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(sender_id, receiver_id)
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('registration', 'active', 'completed', 'cancelled')),
    max_players INTEGER NOT NULL DEFAULT 8,
    current_players INTEGER DEFAULT 0,
    winner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(winner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Table pour lister les participants d'un tournoi
  CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, user_id),
    UNIQUE(tournament_id, alias)
  );

  -- Table pour stocker les matches d'un tournoi (bracket)
  CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL,
    round INTEGER NOT NULL, -- 1 = premier tour, etc.
    player1_id INTEGER, -- peut être NULL si bye
    player2_id INTEGER, -- peut être NULL si bye
    winner_id INTEGER, -- NULL tant que non joué
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'finished', 'cancelled')),
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY(player1_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(player2_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(winner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tm_tournament_id ON tournament_matches(tournament_id);

  -- Table pour les codes de verification 2FA par email
  CREATE TABLE IF NOT EXISTS two_factor_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_2fa_user_id ON two_factor_codes(user_id);
  CREATE INDEX IF NOT EXISTS idx_2fa_expires_at ON two_factor_codes(expires_at);
`);

export default db;