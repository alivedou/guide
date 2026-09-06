import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'node-html-parser';
import { REPO_ROOT, FIXTURES } from '../helpers/paths.mjs';

const PUBLIC = path.join(REPO_ROOT, 'nav-main/public');

describe('phase 4 module boot (P4-1, P4-2, P4-5)', () => {
  it('P4-1: index.html entry is type=module /assets/js/main.js and search-ux is not a trailing classic script', () => {
    const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    const root = parse(html);
    const scripts = root.querySelectorAll('script[src]');
    const moduleScripts = scripts.filter((el) => el.getAttribute('type') === 'module');
    const srcs = scripts.map((el) => el.getAttribute('src'));

    assert.equal(moduleScripts.length, 1, 'exactly one module entry');
    assert.equal(moduleScripts[0].getAttribute('src'), '/assets/js/main.js');
    assert.equal(
      srcs.filter((s) => s.includes('search-ux.js')).length,
      0,
      'search-ux.js must not be a script tag (merged into features/search.js)'
    );
    assert.equal(
      srcs.filter((s) => s.endsWith('/app.js') || s.endsWith('assets/js/app.js')).length,
      0,
      'classic app.js script tag must be gone'
    );
  });

  it('P4-2: window-api.json names are assigned on window in the ES module graph', () => {
    const names = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'window-api.json'), 'utf8'));
    const jsRoot = path.join(PUBLIC, 'assets/js');
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.js')) files.push(full);
      }
    };
    walk(jsRoot);
    const blob = files
      .filter((f) => !f.endsWith(`${path.sep}app.js`))
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');

    const missing = names.filter((n) => {
      const re = new RegExp(`window\\.${n}\\s*=`);
      return !re.test(blob);
    });
    assert.deepEqual(missing, [], `missing window assignments: ${missing.join(', ')}`);
  });

  it('P4-5: CACHE_NAME raised and old app.js is not precached', () => {
    const sw = fs.readFileSync(path.join(PUBLIC, 'ServiceWorker.js'), 'utf8');
    const match = sw.match(/const CACHE_NAME = '([^']+)'/);
    assert.ok(match, 'CACHE_NAME must be defined');
    assert.notEqual(match[1], 'nav-core-v9', 'CACHE_NAME must be raised above nav-core-v9');
    assert.match(match[1], /nav-core-v(1[0-9]|[2-9][0-9])/);
    assert.match(sw, /\/assets\/js\/main\.js/);
    assert.doesNotMatch(
      sw.replace(/\/\*[\s\S]*?\*\//g, ''),
      /\/assets\/js\/app\.js/
    );
  });

  it('main.js imports search UX and admin tabs', () => {
    const main = fs.readFileSync(path.join(PUBLIC, 'assets/js/main.js'), 'utf8');
    assert.match(main, /features\/search\.js/);
    assert.match(main, /initSearchUx/);
    assert.match(main, /features\/admin\/index\.js/);
    const adminDir = path.join(PUBLIC, 'assets/js/features/admin');
    for (const f of ['hub.js', 'users.js', 'invites.js', 'announcements.js', 'audit.js']) {
      assert.equal(fs.existsSync(path.join(adminDir, f)), true, `missing admin/${f}`);
    }
  });
});
