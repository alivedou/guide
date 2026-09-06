import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { startTestServer } from '../helpers/server.mjs';
import { api } from '../helpers/api.mjs';

describe('phase 2 http smoke after server split', () => {
  let srv;
  let client;

  before(async () => {
    srv = await startTestServer({ runId: 'phase2-http' });
    client = api(srv.baseUrl);
  });

  after(async () => {
    if (srv) await srv.stop();
  });

  it('P2-2 empty login body is 400 ERR_MISSING_USERNAME and process stays up', async () => {
    const empty = await client.post('/api/auth/login', {});
    assert.equal(empty.status, 400);
    assert.equal(empty.body.code, 'ERR_MISSING_USERNAME');

    const noPassword = await client.post('/api/auth/login', { username: 'alice' });
    assert.equal(noPassword.status, 400);
    assert.equal(noPassword.body.code, 'ERR_MISSING_PASSWORD');

    const stillUp = await client.get('/api/config');
    assert.equal(stillUp.status, 200);
  });

  it('P2-3 first register is admin; login writes config; anonymous POST stays 401', async () => {
    const reg = await client.post('/api/auth/register', {
      username: 'split-admin',
      password: 'split-pass-1',
    });
    assert.equal(reg.status, 200);
    assert.equal(reg.body.role, 'admin');

    const login = await client.post('/api/auth/login', {
      username: 'split-admin',
      password: 'split-pass-1',
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    const token = login.body.token;

    const before = await client.get('/api/config', { token });
    assert.equal(before.status, 200);

    const posted = await client.post(
      '/api/config',
      {
        categories: [{ id: 'c1', name: '拆分验证' }],
        items: [{ id: 'i1', catId: 'c1', title: '书签', url: 'https://example.com' }],
        settings: before.body.settings || {},
      },
      { token }
    );
    assert.equal(posted.status, 200);

    const after = await client.get('/api/config', { token });
    assert.equal(after.status, 200);
    assert.equal(after.body.categories.some((c) => c.name === '拆分验证'), true);

    const anon = await client.post('/api/config', { categories: [] });
    assert.equal(anon.status, 401);
  });

  it('P2-5 unauthenticated GET /api/admin/users is 403', async () => {
    const res = await client.get('/api/admin/users');
    assert.equal(res.status, 403);
  });
});
