import { DatabaseSync as Database } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function openDatabase(path = process.env.DATABASE_PATH || './data/capsules.db') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS capsules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    prompt_title TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'v1',
    prompt_text TEXT NOT NULL,
    response_summary TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Coding',
    usefulness TEXT NOT NULL DEFAULT 'Unrated',
    reviewed INTEGER NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1)),
    improved INTEGER NOT NULL DEFAULT 0 CHECK(improved IN (0,1)),
    screenshot_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_capsules_user ON capsules(user_id, created_at DESC);`);
  return db;
}
