import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { defaultData } from '../../nav-main/shared/default-data.js';
import { api } from '../helpers/api.mjs';
import { startTestServer } from '../helpers/server.mjs';

describe('share page serves live SQL nav, not stale default KV', () => {
  let srv;
  let client;

  before(async () => {
    srv = await startTestServer({ runId: 'share-page-node' });
    client = api(srv.baseUrl);
  });

  after(async () => {
    if (srv) await srv.stop();
  });

  it('GET /api/share returns customized cats after KV is poisoned with the default template', async () => {
    const username = 'share_owner';
    const password = 'Passw0rd!share';
    const slug = 'adou-share';

    const reg = await client.post('/api/auth/register', { username, password });
    assert.equal(reg.status, 200, JSON.stringify(reg.body));

    const login = await client.post('/api/auth/login', { username, password });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.token;
    const userId = login.body.user.id;

    const saved = await client.post(
      '/api/config',
      {
        categories: [
          { id: 'open-cat', name: '分享专属分类', icon: '📌', hidden: false },
          { id: 'hid-cat', name: '不该出现的分类', icon: '🔒', hidden: true },
        ],
        items: [
          { id: 'open-item', catId: 'open-cat', title: '分享专属书签', url: 'https://share.example/' },
          { id: 'hid-item', catId: 'hid-cat', title: '密室书签', url: 'https://secret.example/' },
          {
            id: 'hid-bookmark',
            catId: 'open-cat',
            title: '隐藏书签',
            url: 'https://hidden.example/',
            hidden: true,
          },
        ],
        settings: {},
      },
      { token }
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));

    const profile = await client.post(
      '/api/user/profile',
      { username, isShared: true, shareSlug: slug },
      { token }
    );
    assert.equal(profile.status, 200, JSON.stringify(profile.body));

    const kvFile = path.join(srv.paths.kv, `user_${userId}.json`);
    assert.equal(fs.existsSync(kvFile), true, 'expected user KV snapshot after save');
    fs.writeFileSync(kvFile, JSON.stringify(defaultData, null, 2));

    const missing = await client.get('/api/share?slug=no-such-slug');
    assert.equal(missing.status, 404);

    const shared = await client.get(`/api/share?slug=${slug}`);
    assert.equal(shared.status, 200, JSON.stringify(shared.body));
    assert.equal(shared.body.isReadOnlyShare, true);
    assert.equal(shared.body.shareOwner, username);
    assert.equal(shared.body.shareSlug, slug);

    const names = (shared.body.categories || []).map((c) => c.name);
    const titles = (shared.body.items || []).map((i) => i.title);
    assert.equal(names.includes('分享专属分类'), true);
    assert.equal(names.includes('社交'), false);
    assert.equal(names.includes('不该出现的分类'), false);
    assert.equal(titles.includes('分享专属书签'), true);
    assert.equal(titles.includes('微博'), false);
    assert.equal(titles.includes('密室书签'), false);
    assert.equal(titles.includes('隐藏书签'), false);
  });
});
