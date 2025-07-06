// Importation du module better-sqlite3
import Database from 'better-sqlite3';
// Ouvre (ou crée) le fichier de base de données pong.db
const db = new Database('pong.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS games(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1 TEXT NOT NULL,
        player2 TEXT NOT NULL,
        score TEXT DEFAULT '0-0'
    )
`);
export default db;
