import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.DB_PATH);

// Optimize SQLite for high concurrency and resilience
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      duration_sec REAL DEFAULT 0,
      media_type TEXT NOT NULL CHECK(media_type IN ('audio', 'video')),
      mime TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      source TEXT NOT NULL CHECK(source IN ('upload', 'online', 'soundcloud', 'youtube')),
      source_url TEXT,
      original_ext TEXT,
      created_at TEXT NOT NULL,
      last_played_at TEXT
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('online', 'soundcloud', 'convert', 'youtube')),
      url TEXT,
      media_type TEXT,
      quality TEXT,
      status TEXT NOT NULL CHECK(status IN ('queued', 'downloading', 'processing', 'done', 'error', 'canceled')),
      progress REAL DEFAULT 0,
      speed TEXT,
      eta TEXT,
      error TEXT,
      track_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      track_id TEXT,
      position_sec REAL DEFAULT 0,
      queue TEXT DEFAULT '[]',
      loop_mode TEXT DEFAULT 'off',
      shuffle INTEGER DEFAULT 0,
      rate REAL DEFAULT 1.0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT,
      name TEXT NOT NULL,
      avatar TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_player_state (
      user_id TEXT PRIMARY KEY,
      track_id TEXT,
      position_sec REAL DEFAULT 0,
      queue TEXT DEFAULT '[]',
      loop_mode TEXT DEFAULT 'off',
      shuffle INTEGER DEFAULT 0,
      rate REAL DEFAULT 1.0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tracks_type ON tracks(media_type);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position ASC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  `);

  // Migrations for user_id column
  try { db.exec(`ALTER TABLE tracks ADD COLUMN user_id TEXT DEFAULT 'default'`); } catch {}
  try { db.exec(`ALTER TABLE playlists ADD COLUMN user_id TEXT DEFAULT 'default'`); } catch {}
  try { db.exec(`ALTER TABLE playlists ADD COLUMN cover_path TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE playlists ADD COLUMN avatar TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN user_id TEXT DEFAULT 'default'`); } catch {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN extra TEXT DEFAULT '{}'`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id)`); } catch {}

  // Migrate jobs table CHECK constraint to include 'soundcloud' if needed
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('soundcloud')) {
      db.exec(`
        CREATE TABLE jobs_new (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK(kind IN ('youtube', 'convert', 'soundcloud')),
          url TEXT,
          media_type TEXT,
          quality TEXT,
          status TEXT NOT NULL CHECK(status IN ('queued', 'downloading', 'processing', 'done', 'error', 'canceled')),
          progress REAL DEFAULT 0,
          speed TEXT,
          eta TEXT,
          error TEXT,
          track_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          user_id TEXT DEFAULT 'default',
          extra TEXT DEFAULT '{}'
        );
        INSERT INTO jobs_new SELECT id, kind, url, media_type, quality, status, progress, speed, eta, error, track_id, created_at, updated_at, user_id, extra FROM jobs;
        DROP TABLE jobs;
        ALTER TABLE jobs_new RENAME TO jobs;
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
      `);
    }
  } catch (migErr) {
    console.warn('[DB Migration] jobs table notice:', migErr.message);
  }

  // Migrate tracks table CHECK constraint to include 'soundcloud' if needed
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tracks'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('soundcloud')) {
      db.exec(`
        CREATE TABLE tracks_new (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT,
          album TEXT,
          duration_sec REAL DEFAULT 0,
          media_type TEXT NOT NULL CHECK(media_type IN ('audio', 'video')),
          mime TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER DEFAULT 0,
          thumbnail_path TEXT,
          width INTEGER,
          height INTEGER,
          source TEXT NOT NULL CHECK(source IN ('upload', 'youtube', 'soundcloud')),
          source_url TEXT,
          original_ext TEXT,
          created_at TEXT NOT NULL,
          last_played_at TEXT,
          user_id TEXT DEFAULT 'default'
        );
        INSERT INTO tracks_new SELECT id, title, artist, album, duration_sec, media_type, mime, file_path, file_size, thumbnail_path, width, height, source, source_url, original_ext, created_at, last_played_at, user_id FROM tracks;
        DROP TABLE tracks;
        ALTER TABLE tracks_new RENAME TO tracks;
        CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tracks_type ON tracks(media_type);
        CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id);
      `);
    }
  } catch (migErr) {
    console.warn('[DB Migration] tracks table notice:', migErr.message);
  }

  // User-specific settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_user_settings_uid ON user_settings(user_id);
  `);

  // Auto-migrate legacy 'default' library items to primary Google user if available
  try {
    const primaryUser = db.prepare("SELECT id FROM users WHERE google_id IS NOT NULL ORDER BY created_at ASC LIMIT 1").get();
    if (primaryUser && primaryUser.id) {
      db.prepare("UPDATE tracks SET user_id = ? WHERE user_id = 'default'").run(primaryUser.id);
      db.prepare("UPDATE playlists SET user_id = ? WHERE user_id = 'default'").run(primaryUser.id);
      db.prepare("UPDATE jobs SET user_id = ? WHERE user_id = 'default'").run(primaryUser.id);
    }
  } catch (migErr) {
    console.warn('[DB Migration] Notice:', migErr.message);
  }

  // Ensure default local user exists
  db.prepare(`
    INSERT OR IGNORE INTO users (id, google_id, email, name, avatar, created_at, updated_at)
    VALUES ('default', NULL, 'user@muzifi.local', 'Người dùng chính', '', datetime('now'), datetime('now'))
  `).run();

  // Default settings
  const defaultSettings = [
    ['unknown_format_policy', 'convert'], // 'convert' | 'reject'
    ['default_video_quality', '720p'],
    ['seek_step', '10'],
    ['max_concurrent_jobs', '2'],
    ['theme', 'dark'],
    ['google_client_id', config.GOOGLE_CLIENT_ID || ''],
    ['google_client_secret', config.GOOGLE_CLIENT_SECRET || ''],
    ['google_redirect_uri', config.GOOGLE_REDIRECT_URI || ''],
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  for (const [key, val] of defaultSettings) {
    insertSetting.run(key, val);
  }

  // If env variables exist, ensure they populate settings if currently blank
  if (config.GOOGLE_CLIENT_ID) {
    const cur = db.prepare('SELECT value FROM settings WHERE key = ?').get('google_client_id');
    if (!cur || !cur.value) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(config.GOOGLE_CLIENT_ID, 'google_client_id');
    }
  }
  if (config.GOOGLE_CLIENT_SECRET) {
    const cur = db.prepare('SELECT value FROM settings WHERE key = ?').get('google_client_secret');
    if (!cur || !cur.value) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(config.GOOGLE_CLIENT_SECRET, 'google_client_secret');
    }
  }
  if (config.GOOGLE_REDIRECT_URI) {
    const cur = db.prepare('SELECT value FROM settings WHERE key = ?').get('google_redirect_uri');
    if (!cur || !cur.value) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(config.GOOGLE_REDIRECT_URI, 'google_redirect_uri');
    }
  }

  // Ensure 1 row in player_state
  const existingPlayerState = db.prepare('SELECT id FROM player_state WHERE id = 1').get();
  if (!existingPlayerState) {
    db.prepare(`
      INSERT INTO player_state (id, track_id, position_sec, queue, loop_mode, shuffle, rate, updated_at)
      VALUES (1, NULL, 0, '[]', 'off', 0, 1.0, datetime('now'))
    `).run();
  }

  // Handle unfinished jobs from previous runs
  db.prepare(`
    UPDATE jobs 
    SET status = 'error', error = 'Interrupted by server restart', updated_at = datetime('now')
    WHERE status IN ('queued', 'downloading', 'processing')
  `).run();
}

export function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const row of rows) {
    obj[row.key] = row.value;
  }
  return obj;
}

export function getUserSetting(userId, key, defaultValue = '') {
  if (!userId) return getSetting(key, defaultValue);
  const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, key);
  if (row) return row.value;
  return getSetting(key, defaultValue);
}

export function setUserSetting(userId, key, value) {
  if (!userId || userId === 'default') {
    setSetting(key, value);
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO user_settings (user_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(userId, key, String(value), now);
}

export function getAllUserSettings(userId) {
  const settings = getAllSettings();
  if (!userId) return settings;
  const userRows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId);
  for (const row of userRows) {
    settings[row.key] = row.value;
  }
  return settings;
}
