import fs from 'node:fs';
import path from 'node:path';
import { api } from './api.mjs';
import { loadSanitize } from './sanitize.mjs';
import { FIXTURES } from './paths.mjs';

function pickConfigShape(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  return {
    hasCategories: Array.isArray(body.categories) && body.categories.length > 0,
    categoryNames: Array.isArray(body.categories)
      ? body.categories.map((c) => c.name).sort()
      : [],
    itemCount: Array.isArray(body.items) ? body.items.length : 0,
    role: body.role ?? null,
    isAdmin: body.isAdmin ?? null,
    quota: body.quota ?? null,
  };
}

export async function runContractSuite(baseUrl) {
  const client = api(baseUrl);
  const results = {};

  // D-1 homepage
  {
    const r = await client.get('/');
    results['D-1'] = {
      status: r.status,
      htmlHasShell: typeof r.text === 'string' && r.text.includes('sidebar') && r.text.includes('个人'),
    };
  }

  // A-1 guest config
  {
    const r = await client.get('/api/config');
    results['A-1'] = {
      status: r.status,
      ...pickConfigShape(r.body),
    };
  }

  // A-2 anonymous write
  {
    const r = await client.post('/api/config', { categories: [], items: [] });
    results['A-2'] = { status: r.status };
  }

  // A-3 empty login
  {
    const r = await client.post('/api/auth/login', {});
    results['A-3'] = { status: r.status, code: r.body?.code ?? null };
  }

  // A-3b missing password
  {
    const r = await client.post('/api/auth/login', { username: 'x' });
    results['A-3b'] = { status: r.status, code: r.body?.code ?? null };
  }

  // A-4 first register → admin
  {
    const r = await client.post('/api/auth/register', {
      username: 'baseline_admin',
      password: 'Passw0rd!admin',
    });
    results['A-4'] = {
      status: r.status,
      success: r.body?.success === true,
      role: r.body?.role ?? null,
    };
  }

  // A-8 wrong password
  {
    const r = await client.post('/api/auth/login', {
      username: 'baseline_admin',
      password: 'wrong-password',
    });
    results['A-8'] = { status: r.status };
  }

  // A-5 login
  {
    const r = await client.post('/api/auth/login', {
      username: 'baseline_admin',
      password: 'Passw0rd!admin',
    });
    results['A-5'] = {
      status: r.status,
      hasToken: typeof r.body?.token === 'string' && r.body.token.length > 20,
      role: r.body?.user?.role ?? null,
    };
    results._adminToken = r.body?.token;
  }

  const adminToken = results._adminToken;

  // A-6 authed GET config
  {
    const r = await client.get('/api/config', { token: adminToken });
    results['A-6'] = {
      status: r.status,
      ...pickConfigShape(r.body),
    };
    results._adminConfig = r.body;
  }

  // A-7 authed POST config then GET
  {
    const prev = results._adminConfig || { categories: [], items: [] };
    const cat = (prev.categories && prev.categories[0]) || {
      id: 'tmp',
      name: '社交',
      icon: '💬',
    };
    const payload = {
      categories: [
        {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          hidden: false,
        },
        {
          id: 'contract_extra',
          name: '契约分类',
          icon: '📌',
          hidden: false,
        },
      ],
      items: [
        {
          id: 'contract_item',
          catId: cat.id,
          title: '契约书签',
          url: 'https://example.com',
          desc: '',
          icon: '',
        },
      ],
      settings: prev.settings || {},
    };
    const post = await client.post('/api/config', payload, { token: adminToken });
    const again = await client.get('/api/config', { token: adminToken });
    const names = Array.isArray(again.body?.categories)
      ? again.body.categories.map((c) => c.name)
      : [];
    results['A-7'] = {
      status: post.status,
      getStatus: again.status,
      hasContractCategory: names.includes('契约分类'),
      hasBookmark: Array.isArray(again.body?.items)
        ? again.body.items.some((i) => i.title === '契约书签')
        : false,
    };
  }

  // A-10 Bing
  {
    const r = await client.get('/api/bing');
    results['A-10'] = {
      status: r.status,
      hasImage: Array.isArray(r.body?.images) && !!r.body.images[0]?.url,
    };
  }

  // A-11 announcements
  {
    const r = await client.get('/api/announcements', { token: adminToken });
    results['A-11'] = { status: r.status, isArray: Array.isArray(r.body) || Array.isArray(r.body?.announcements) };
  }

  // A-12 admin users anonymous
  {
    const r = await client.get('/api/admin/users');
    results['A-12'] = { status: r.status };
  }

  // Q-1: second user exceeds category quota (user = 12)
  {
    const reg = await client.post('/api/auth/register', {
      username: 'baseline_user',
      password: 'Passw0rd!user',
    });
    const login = await client.post('/api/auth/login', {
      username: 'baseline_user',
      password: 'Passw0rd!user',
    });
    const token = login.body?.token;
    const before = await client.get('/api/config', { token });
    const beforeCount = Array.isArray(before.body?.categories)
      ? before.body.categories.length
      : 0;
    const cats = [];
    for (let i = 0; i < 13; i += 1) {
      cats.push({ id: `q1_${i}`, name: `超限${i}`, icon: '📌', hidden: false });
    }
    const over = await client.post(
      '/api/config',
      { categories: cats, items: [], settings: before.body?.settings || {} },
      { token }
    );
    const after = await client.get('/api/config', { token });
    const afterCount = Array.isArray(after.body?.categories)
      ? after.body.categories.length
      : -1;
    results['Q-1'] = {
      registerStatus: reg.status,
      registerRole: reg.body?.role ?? null,
      loginStatus: login.status,
      overStatus: over.status,
      overCode: over.body?.code ?? null,
      beforeCount,
      afterCount,
      unchanged: afterCount === beforeCount,
    };
  }

  // I-1 / I-2 sanitize (no server)
  {
    const sanitize = loadSanitize();
    const sample = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, 'nav-export.sample.json'), 'utf8')
    );
    const exported = sanitize.sanitizeForExport(sample);
    const imported = sanitize.prepareImportPayload(sample);
    const identityKeys = ['user', 'username', 'uid', 'role', 'isAdmin', 'quota'];
    results['I-1'] = {
      hasIdentity: identityKeys.some((k) => Object.prototype.hasOwnProperty.call(exported, k)),
    };
    const oldCatIds = new Set((sample.categories || []).map((c) => c.id));
    const oldItemIds = new Set((sample.items || []).map((i) => i.id));
    const newCatIds = (imported.categories || []).map((c) => c.id);
    const newItemIds = (imported.items || []).map((i) => i.id);
    results['I-2'] = {
      catIdsChanged: newCatIds.every((id) => !oldCatIds.has(id)),
      itemIdsChanged: newItemIds.every((id) => !oldItemIds.has(id)),
      catCount: newCatIds.length,
      itemCount: newItemIds.length,
    };
  }

  delete results._adminToken;
  delete results._adminConfig;
  return results;
}

export function publicContract(results) {
  const out = { ...results };
  delete out._adminToken;
  delete out._adminConfig;
  return out;
}
