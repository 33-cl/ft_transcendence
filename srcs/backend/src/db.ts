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

// ============================================================================
// ANCIENNES MIGRATIONS (commentées car tous les champs sont déjà dans CREATE TABLE)
// Ces migrations étaient utiles pendant le développement pour ajouter des colonnes
// sans perdre les données existantes. Maintenant tout est dans le schéma initial.
// ============================================================================

/*
// Migration: Add google_id and provider columns if they don't exist
try {
  // Check if columns exist
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string, notnull: number }>;
  const hasGoogleId = tableInfo.some(col => col.name === 'google_id');
  const hasProvider = tableInfo.some(col => col.name === 'provider');
  const hasDisplayName = tableInfo.some(col => col.name === 'display_name');
  const passwordHashCol = tableInfo.find(col => col.name === 'password_hash');
  
  if (!hasGoogleId) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');
  }
  
  if (!hasProvider) {
    db.exec("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local'");
  }
  
  if (!hasDisplayName) {
    db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  }
  
  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table if password_hash is NOT NULL
  if (passwordHashCol && passwordHashCol.notnull === 1) {
    db.exec(`
      BEGIN TRANSACTION;
      
      -- Create new table with password_hash as nullable
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        avatar_url TEXT,
        google_id TEXT,
        provider TEXT DEFAULT 'local',
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Copy data from old table
      INSERT INTO users_new SELECT * FROM users;
      
      -- Drop old table
      DROP TABLE users;
      
      -- Rename new table
      ALTER TABLE users_new RENAME TO users;
      
      -- Recreate indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
      
      COMMIT;
    `);
  }
} catch (err) {
  console.error('Migration error:', err);
}

// Migration: Add winner_id column to tournaments table if it doesn't exist
try {
  const tournamentsTableInfo = db.prepare("PRAGMA table_info(tournaments)").all() as Array<{ name: string }>;
  const hasWinnerId = tournamentsTableInfo.some(col => col.name === 'winner_id');
  
  if (!hasWinnerId) {
    db.exec('ALTER TABLE tournaments ADD COLUMN winner_id INTEGER');
  }
} catch (error) {
  console.error('❌ Migration failed for tournaments.winner_id:', error);
}

// Migration pour ajouter creator_id à la table tournaments
try {
  const columns = db.prepare(`PRAGMA table_info(tournaments)`).all() as { name: string }[];
  const hasCreatorId = columns.some((col) => col.name === 'creator_id');
    
  if (!hasCreatorId) {
    db.exec(`
      BEGIN TRANSACTION;
      
      -- Add creator_id column with a default value (we'll update it below)
      ALTER TABLE tournaments ADD COLUMN creator_id INTEGER;
      
      -- Set a default creator_id for existing tournaments (first user in db)
      UPDATE tournaments SET creator_id = (SELECT id FROM users LIMIT 1) WHERE creator_id IS NULL;
      
      -- Now we can't easily add the NOT NULL constraint and FOREIGN KEY to existing table
      -- We'll handle the constraint in the application logic for now
      
      COMMIT;
    `);
  }
} catch (err) {
  console.error('Creator_id migration error:', err);
}

// Migration: Add two_factor_enabled column to users table
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  //verifie si la colonne existe deja
  const hasTwoFactorEnabled = tableInfo.some(col => col.name === 'two_factor_enabled');
  
  if (!hasTwoFactorEnabled)
  {
    db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0');
  }
} catch (error) {
  console.error('❌ Migration failed for users.two_factor_enabled:', error);
}
*/

export default db;