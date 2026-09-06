import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { saveConfig, readConfig } from '../../nav-main/shared/config-core.js';
import { defaultData } from '../../nav-main/shared/default-data.js';
import { REPO_ROOT } from '../helpers/paths.mjs';
import { resetTestData } from '../helpers/reset-db.mjs';

function createSqlitePort(dbFile) {
  const db = new Database(dbFile);
  const initSql = fs.readFileSync(path.join(REPO_ROOT, 'migrations', '0000_init.sql'), 'utf8');
  db.exec(initSql);
  const kv = new Map();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role) VALUES ('u1', 'alice', 'x', 'user')"
  ).run();
  db.prepare("INSERT INTO user_settings (user_id) VALUES ('u1')").run();

  return {
    db,
    kv,
    newId() {
      return globalThis.crypto.randomUUID();
    },
    async readGuestConfig() {
      return JSON.parse(JSON.stringify(defaultData));
    },
    async readUserConfig(userId) {
      const raw = kv.get(userId);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaultData));
    },
    async persistSavedConfig(userId, { remapped, lastUpdated, requestBody }) {
      const data = { ...requestBody, categories: remapped.categories, items: remapped.items, lastUpdated };
      kv.set(userId, JSON.stringify(data));
      return data;
    },
    async persistResetConfig() {},
    async loadOnboarding() {
      return defaultData;
    },
    async runMany(stmts) {
      db.transaction(() => {
        for (const { sql, params } of stmts) {
          db.prepare(sql).run(...(params || []));
        }
      })();
    }
  };
}

describe('phase 3 config-core handler', () => {
  let port;
  let paths;

  before(() => {
    paths = resetTestData('phase3-handler');
    port = createSqlitePort(path.join(paths.root, 'handler.db'));
  });

  after(() => {
    if (port?.db) port.db.close();
  });

  it('P3-1 two saves with the same payload ids do not UNIQUE-fail and SQL ids change', async () => {
    const user = { id: 'u1', role: 'user', username: 'alice' };
    const payload = {
      categories: [{ id: 'dup-cat', name: '重映射', icon: '📌' }],
      items: [{ id: 'dup-item', catId: 'dup-cat', title: '书签', url: 'https://example.com' }],
      settings: {}
    };

    const first = await saveConfig(port, user, payload);
    assert.equal(first.ok, true, first.error);
    const ids1 = port.db.prepare('SELECT id FROM categories WHERE user_id = ?').all('u1').map((r) => r.id);

    const second = await saveConfig(port, user, payload);
    assert.equal(second.ok, true, second.error);
    const ids2 = port.db.prepare('SELECT id FROM categories WHERE user_id = ?').all('u1').map((r) => r.id);

    assert.equal(ids1.length, 1);
    assert.equal(ids2.length, 1);
    assert.notEqual(ids1[0], 'dup-cat');
    assert.notEqual(ids2[0], ids1[0]);
    assert.notEqual(second.remapped.categories[0].id, first.remapped.categories[0].id);
  });

  it('P3-2 over-quota save is 403 and leaves previous rows', async () => {
    const user = { id: 'u1', role: 'user', username: 'alice' };
    const ok = await saveConfig(port, user, {
      categories: [{ id: 'a', name: '仅一份' }],
      items: [],
      settings: {}
    });
    assert.equal(ok.ok, true, ok.error);
    const before = port.db.prepare('SELECT name FROM categories WHERE user_id = ?').all('u1');

    const cats = Array.from({ length: 13 }, (_, i) => ({ id: `x${i}`, name: `超${i}` }));
    const over = await saveConfig(port, user, { categories: cats, items: [], settings: {} });
    assert.equal(over.ok, false);
    assert.equal(over.status, 403);
    assert.equal(over.code, 'ERR_QUOTA_EXCEEDED');

    const after = port.db.prepare('SELECT name FROM categories WHERE user_id = ?').all('u1');
    assert.deepEqual(after, before);
  });

  it('guest GET hides hidden categories', async () => {
    const body = await readConfig(port, { role: 'guest', id: 'guest' });
    assert.equal(body.user, 'guest');
    assert.ok(body.categories.some((c) => c.name === '社交'));
    assert.equal(body.quota.maxCategories, 6);
  });
});
