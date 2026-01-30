const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../data.sqlite'), (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err);
    process.exit(1);
  }
});

// Initialize the animes table
db.run(`
  CREATE TABLE IF NOT EXISTS animes (
    animeId TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- Ensure no duplicate names
    episodes TEXT NOT NULL DEFAULT '[]',
    isMovie BOOLEAN DEFAULT 0
  )
`);

module.exports = {
  async getAnimeByName(name) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM animes WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  async searchAnimeByName(name) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM animes WHERE name LIKE ?', [`%${name}%`], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  async getAnimeById(animeId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM animes WHERE animeId = ?', [animeId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  async getAllAnimes() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM animes', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  async saveAnime(animeId, name, part, episodes, isMovie = false) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO animes (animeId, name, episodes, isMovie) VALUES (?, ?, ?, ?)',
        [animeId, name, JSON.stringify(episodes), isMovie ? 1 : 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Close database on process exit
  close() {
    db.close((err) => {
      if (err) console.error('Error closing SQLite database:', err);
    });
  },
};

// Ensure database closes gracefully
process.on('SIGINT', () => {
  module.exports.close();
  process.exit(0);
});