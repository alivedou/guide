import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { api } from '../helpers/api.mjs';
import { FIXTURES } from '../helpers/paths.mjs';
import { startTestServer } from '../helpers/server.mjs';

const FIXTURE = path.join(FIXTURES, 'old-db.sqlite');

describe('phase 6 old-db upgrade (P6-3)', () => {
  it('fixture users table has no email column', () => {
    assert.equal(fs.existsSync(FIXTURE), true, 'missing tests/fixtures/old-db.sqlite');
    const db = new Database(FIXTURE, { readonly: true, fileMustExist: true });
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    db.close();
    assert.equal(cols.includes('email'), false);
  });

  let srv;
  let client;
  let dbPath;

  before(async () => {
    srv = await startTestServer({ runId: 'phase6-old', seedDb: FIXTURE });
    client = api(srv.baseUrl);
    dbPath = srv.paths.db;
  });

  after(async () => {
    if (srv) await srv.stop();
  });

  it('P6-3: starting on the old db adds users.email; register / login / config work', async () => {
    const reg = await client.post('/api/auth/register', {
      username: 'olddb-admin',
      password: 'olddb-pass-1',
    });
    assert.equal(reg.status, 200, JSON.stringify(reg.body));
    assert.equal(reg.body.role, 'admin');
    assert.equal(JSON.stringify(reg.body).includes('no such column'), false);

    const login = await client.post('/api/auth/login', {
      username: 'olddb-admin',
      password: 'olddb-pass-1',
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.ok(login.body.token);
    assert.equal(JSON.stringify(login.body).includes('no such column'), false);

    const cfg = await client.get('/api/config', { token: login.body.token });
    assert.equal(cfg.status, 200, JSON.stringify(cfg.body));
    assert.equal(JSON.stringify(cfg.body).includes('no such column'), false);

    const saved = await client.post(
      '/api/config',
      {
        categories: [{ id: 'old-cat', name: '旧库' }],
        items: [{ id: 'old-item', catId: 'old-cat', title: '书签', url: 'https://example.com' }],
        settings: cfg.body.settings || {},
      },
      { token: login.body.token }
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(JSON.stringify(saved.body).includes('no such column'), false);

    await srv.stop();
    srv = null;

    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    db.close();
    assert.ok(cols.includes('email'), `users columns=${cols.join(',')}`);
  });
});
