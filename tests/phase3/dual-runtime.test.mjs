import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { after, before, describe, it } from 'node:test';
import { api } from '../helpers/api.mjs';
import { startTestServer } from '../helpers/server.mjs';
import { startWranglerPreview } from '../helpers/wrangler.mjs';

function namesAndUrls(body) {
  return {
    names: (body.categories || []).map((c) => c.name).sort(),
    urls: (body.items || []).map((i) => i.url).sort()
  };
}

async function registerLoginSave(client, username) {
  const password = 'Passw0rd!dual';
  const reg = await client.post('/api/auth/register', { username, password });
  const login = await client.post('/api/auth/login', { username, password });
  const token = login.body?.token;
  const payload = {
    categories: [{ id: 'same-cat', name: '双端分类', icon: '📌' }],
    items: [{ id: 'same-item', catId: 'same-cat', title: '双端书签', url: 'https://dual.example/' }],
    settings: {}
  };
  const post1 = await client.post('/api/config', payload, { token });
  const post2 = await client.post('/api/config', payload, { token });
  const got = await client.get('/api/config', { token });
  return { reg, login, token, post1, post2, got };
}

describe('phase 3 dual runtime', () => {
  let node;
  let cf;
  let nodeClient;
  let cfClient;

  before(async () => {
    node = await startTestServer({ runId: 'dual-node' });
    nodeClient = api(node.baseUrl);
    cf = await startWranglerPreview({ runId: 'dual-cf' });
    cfClient = api(cf.baseUrl);
  });

  after(async () => {
    if (cf) await cf.stop();
    if (node) await node.stop();
  });

  it('P3-3 Node and wrangler preview agree on guest GET and save/remap', async () => {
    const nodeGuest = await nodeClient.get('/api/config');
    const cfGuest = await cfClient.get('/api/config');
    assert.equal(nodeGuest.status, 200);
    assert.equal(cfGuest.status, 200);
    assert.deepEqual(namesAndUrls(nodeGuest.body).names, namesAndUrls(cfGuest.body).names);

    const nodeFlow = await registerLoginSave(nodeClient, 'dual_node');
    const cfFlow = await registerLoginSave(cfClient, 'dual_cf');

    assert.equal(nodeFlow.reg.status, 200, JSON.stringify(nodeFlow.reg.body));
    assert.equal(cfFlow.reg.status, 200, JSON.stringify(cfFlow.reg.body));
    assert.equal(nodeFlow.reg.body.role, 'admin');
    assert.equal(cfFlow.reg.body.role, 'admin');
    assert.equal(nodeFlow.post1.status, 200);
    assert.equal(cfFlow.post1.status, 200);
    assert.equal(nodeFlow.post2.status, 200, JSON.stringify(nodeFlow.post2.body));
    assert.equal(cfFlow.post2.status, 200, JSON.stringify(cfFlow.post2.body) + '\n' + cf.output());
    assert.equal(nodeFlow.got.status, 200);
    assert.equal(cfFlow.got.status, 200);

    assert.deepEqual(namesAndUrls(nodeFlow.got.body), namesAndUrls(cfFlow.got.body));

    const nodeDb = new Database(node.paths.db, { readonly: true });
    const rows = nodeDb.prepare('SELECT id FROM categories').all();
    nodeDb.close();
    assert.equal(rows.some((r) => r.id === 'same-cat'), false);

    const nodeShareEnable = await nodeClient.post(
      '/api/user/profile',
      { username: 'dual_node', isShared: true, shareSlug: 'dual-node' },
      { token: nodeFlow.token }
    );
    const cfShareEnable = await cfClient.post(
      '/api/user/profile',
      { username: 'dual_cf', isShared: true, shareSlug: 'dual-cf' },
      { token: cfFlow.token }
    );
    assert.equal(nodeShareEnable.status, 200, JSON.stringify(nodeShareEnable.body));
    assert.equal(cfShareEnable.status, 200, JSON.stringify(cfShareEnable.body));

    const nodeShare = await nodeClient.get('/api/share?slug=dual-node');
    const cfShare = await cfClient.get('/api/share?slug=dual-cf');
    assert.equal(nodeShare.status, 200, JSON.stringify(nodeShare.body));
    assert.equal(cfShare.status, 200, JSON.stringify(cfShare.body) + '\n' + cf.output());
    assert.equal((nodeShare.body.categories || []).some((c) => c.name === '双端分类'), true);
    assert.equal((cfShare.body.categories || []).some((c) => c.name === '双端分类'), true);
    assert.equal((nodeShare.body.categories || []).some((c) => c.name === '社交'), false);
    assert.equal((cfShare.body.categories || []).some((c) => c.name === '社交'), false);
  });
});
