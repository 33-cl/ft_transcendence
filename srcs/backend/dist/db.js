"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Importation du module better-sqlite3
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// Ouvre (ou crée) le fichier de base de données pong.db
const db = new better_sqlite3_1.default('pong.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS games(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1 TEXT NOT NULL,
        player2 TEXT NOT NULL,
        score TEXT DEFAULT '0-0'
    )
`);
exports.default = db;
