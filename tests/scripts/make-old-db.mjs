/**
 * Build tests/fixtures/old-db.sqlite: a users table without email (and other later columns).
 * Used by P6-3 to prove runtime PATCH_SQL heals old files. Does not DROP production tables.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'tests/fixtures/old-db.sqlite');

const OLD_SCHEMA = `
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    icon TEXT
);
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    cat_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT
);
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY
);
CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE invitation_codes (
    code TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export function writeOldDb(dest = OUT) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const db = new Database(dest);
  db.exec(OLD_SCHEMA);
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  db.close();
  if (cols.includes('email')) {
    throw new Error('old-db fixture must not include users.email');
  }
  return dest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  console.log('wrote', writeOldDb());
}
