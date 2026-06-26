import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

// Single-file DB. DELETE journal mode keeps it one ordinary file (no -wal/-shm).
const DB_PATH = process.env.CFE_DB_PATH || join(import.meta.dirname, '..', 'cfe.sqlite')

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = DELETE;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    zooniverse_id TEXT PRIMARY KEY,
    login         TEXT,
    display_name  TEXT,
    avatar_url    TEXT,
    last_seen     TEXT
  );

  CREATE TABLE IF NOT EXISTS roles (
    zooniverse_id TEXT PRIMARY KEY,
    role          TEXT NOT NULL,        -- 'admin' | 'contributor'
    granted_by    TEXT,
    granted_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    zooniverse_id TEXT NOT NULL,
    token         TEXT,
    expiry        INTEGER,
    created_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS content (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    slug          TEXT,
    body_markdown TEXT NOT NULL DEFAULT '',
    parent_id     INTEGER,
    position      INTEGER NOT NULL DEFAULT 0,
    author_id     TEXT,
    status        TEXT NOT NULL DEFAULT 'published',  -- 'draft' | 'published'
    metadata      TEXT NOT NULL DEFAULT '{}',         -- JSON (image base64 lives here)
    created_at    TEXT,
    updated_at    TEXT,
    last_activity_at TEXT
  );

  -- FTS5 trigram for case-insensitive substring match; 'body' is derived in app code (excludes base64 images).
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    content_id UNINDEXED, type, title, body, tokenize='trigram'
  );
`)

export function healthy() {
  try {
    db.prepare('SELECT 1').get()
    return true
  } catch {
    return false
  }
}

// Seed admins from SEED_ADMINS; stored by login, reconciled to id on first sign-in (see auth.upsertUser).
export function seedAdmins() {
  const logins = (process.env.SEED_ADMINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const now = new Date().toISOString()
  const ins = db.prepare(
    `INSERT OR IGNORE INTO roles (zooniverse_id, role, granted_by, granted_at)
     VALUES (?, 'admin', 'seed', ?)`,
  )
  for (const login of logins) ins.run(`login:${login}`, now)
}
seedAdmins()
