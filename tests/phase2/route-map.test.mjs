import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { FIXTURES, REPO_ROOT, TEST_SECRET } from '../helpers/paths.mjs';
import { resetTestData } from '../helpers/reset-db.mjs';

describe('phase 2 route map', () => {
  it('P2-1 mounted /api routes match fixtures/route-map.json', async () => {
    const paths = resetTestData('phase2-routemap');
    process.env.DB_PATH = paths.db;
    process.env.KV_DIR = paths.kv;
    process.env.JWT_SECRET = TEST_SECRET;

    const { createApp, listMountedRoutes } = await import('../../src/server/app.js');
    const app = createApp();
    const mounted = listMountedRoutes(app)
      .filter((r) => typeof r.path === 'string' && r.path.startsWith('/api'))
      .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));

    const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'route-map.json'), 'utf8'))
      .slice()
      .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));

    assert.deepEqual(mounted, expected);
  });
});
