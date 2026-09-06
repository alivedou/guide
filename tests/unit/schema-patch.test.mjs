import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { applySchemaPatches, isIgnorablePatchError, PATCH_SQL } from '../../nav-main/shared/schema-patch.js';

describe('schema-patch', () => {
  it('PATCH_SQL has ALTER and CREATE statements', () => {
    assert.ok(PATCH_SQL.some((s) => s.includes('ALTER TABLE users ADD COLUMN status')));
    assert.ok(PATCH_SQL.some((s) => s.includes('announcement_read_states')));
  });

  it('ignores duplicate column errors', () => {
    assert.equal(isIgnorablePatchError('duplicate column name: status'), true);
    assert.equal(isIgnorablePatchError('index idx already exists'), true);
    assert.equal(isIgnorablePatchError('UNIQUE constraint failed'), false);
  });

  it('second apply on the same sqlite is swallowed', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE categories (id TEXT PRIMARY KEY);
      CREATE TABLE items (id TEXT PRIMARY KEY);
      CREATE TABLE user_settings (user_id TEXT PRIMARY KEY);
      CREATE TABLE announcements (id INTEGER PRIMARY KEY);
      CREATE TABLE invitation_codes (code TEXT PRIMARY KEY);
    `);
    const first = await applySchemaPatches((sql) => db.exec(sql));
    const second = await applySchemaPatches((sql) => db.exec(sql));
    assert.equal(first.errors.length, 0);
    assert.equal(second.errors.length, 0);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    assert.ok(cols.includes('email'));
    assert.ok(cols.includes('has_invite'));
    db.close();
  });
});
