import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../helpers/paths.mjs';

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.tmp' || name === '.git' || name === '.wrangler') continue;
      walkJs(full, acc);
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('phase 3 kv key compatibility', () => {
  it('P3-4 CF still uses user_config:<uuid>; Node still uses user_<uuid>.json', () => {
    const cfConfig = fs.readFileSync(
      path.join(REPO_ROOT, 'nav-main/functions/api/_cf-storage.js'),
      'utf8'
    );
    const nodePort = fs.readFileSync(path.join(REPO_ROOT, 'src/server/storage-port.js'), 'utf8');
    const sharedCore = fs.readFileSync(path.join(REPO_ROOT, 'nav-main/shared/config-core.js'), 'utf8');
    const sharedIds = fs.readFileSync(path.join(REPO_ROOT, 'nav-main/shared/ids.js'), 'utf8');

    assert.match(cfConfig, /`user_config:\$\{userId\}`/);
    assert.equal(/`user_\$\{userId\}\.json`/.test(cfConfig), false);

    assert.match(nodePort, /`user_\$\{userId\}\.json`/);
    assert.equal(/`user_config:\$\{/.test(nodePort), false);

    assert.equal(sharedCore.includes('user_config:'), false);
    assert.equal(sharedIds.includes('user_config:'), false);
    assert.equal(/user_\$\{userId\}\.json/.test(sharedCore), false);

    const sharePage = fs.readFileSync(path.join(REPO_ROOT, 'nav-main/shared/share-page.js'), 'utf8');
    assert.equal(sharePage.includes('user_config:'), false);
    assert.equal(/user_\$\{userId\}\.json/.test(sharePage), false);
  });

  it('P3-5 QUOTA_CONFIG is not redefined in functions or src/server', () => {
    const hits = [];
    for (const file of [
      ...walkJs(path.join(REPO_ROOT, 'nav-main/functions')),
      ...walkJs(path.join(REPO_ROOT, 'src/server'))
    ]) {
      const src = fs.readFileSync(file, 'utf8');
      if (/QUOTA_CONFIG\s*=/.test(src)) hits.push(path.relative(REPO_ROOT, file));
    }
    assert.deepEqual(hits, []);
  });

  it('id remapping Map lives only in nav-main/shared/ids.js among runtimes', () => {
    const hits = [];
    const roots = [
      path.join(REPO_ROOT, 'nav-main/shared'),
      path.join(REPO_ROOT, 'nav-main/functions'),
      path.join(REPO_ROOT, 'src/server')
    ];
    for (const root of roots) {
      for (const file of walkJs(root)) {
        const rel = path.relative(REPO_ROOT, file);
        const src = fs.readFileSync(file, 'utf8');
        if (/catIdMap\s*=/.test(src)) hits.push(rel);
      }
    }
    assert.deepEqual(hits, ['nav-main/shared/ids.js']);
  });
});
