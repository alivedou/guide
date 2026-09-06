import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { REPO_ROOT } from '../helpers/paths.mjs';

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

describe('phase 0 hygiene', () => {
  it('dead files are gone', () => {
    assert.equal(exists('metadata.json'), false);
    assert.equal(exists('.eslintrc.json'), false);
    assert.equal(exists('eslint.config.js'), true);
  });

  it('site-config routes are registered once', () => {
    const src = read('server.js');
    const gets = src.match(/app\.get\(\s*['"`]\/api\/admin\/site-config['"`]/g) || [];
    const posts = src.match(/app\.post\(\s*['"`]\/api\/admin\/site-config['"`]/g) || [];
    assert.equal(gets.length, 1, `GET site-config count=${gets.length}`);
    assert.equal(posts.length, 1, `POST site-config count=${posts.length}`);
  });

  it('root wrangler.toml says Pages does not read it', () => {
    const toml = read('wrangler.toml');
    assert.match(toml, /Pages Root\s*=\s*nav-main|不会被 Pages 使用|Pages 不读/i);
  });

  it('README local setup uses JWT_SECRET, not TOKEN/kv_mock', () => {
    const readme = read('README.md');
    assert.equal(/定义 `TOKEN` 变量/.test(readme), false);
    assert.equal(/读取 `kv_mock\.json`/.test(readme), false);
    assert.match(readme, /JWT_SECRET/);
  });

  it('stale docs are marked', () => {
    const dep = read('docs/deployment.md');
    const req = read('docs/REQUIREMENTS.md');
    assert.match(dep, /可能过时|以 AGENTS\.md 与代码为准/);
    assert.match(req, /可能过时|以 AGENTS\.md 与代码为准/);
  });
});
