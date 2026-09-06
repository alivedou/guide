import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'node-html-parser';
import { REPO_ROOT, FIXTURES } from '../helpers/paths.mjs';

const PUBLIC = path.join(REPO_ROOT, 'nav-main/public');
const CSS_DIR = path.join(PUBLIC, 'assets/css');
const EXPECTED_ORDER = [
  'tokens.css',
  'layout.css',
  'sidebar.css',
  'cards.css',
  'modals.css',
  'responsive.css',
  'search.css',
  'admin.css',
];

function cssFiles() {
  return fs.readdirSync(CSS_DIR).filter((n) => n.endsWith('.css')).map((n) => path.join(CSS_DIR, n));
}

function collectImports(file) {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function importDepth(file, stack = []) {
  const resolved = path.resolve(file);
  if (stack.includes(resolved)) {
    throw new Error(`cyclic @import: ${[...stack, resolved].join(' -> ')}`);
  }
  const imports = collectImports(resolved);
  if (imports.length === 0) return 0;
  let max = 0;
  for (const rel of imports) {
    const next = path.resolve(path.dirname(resolved), rel);
    assert.equal(fs.existsSync(next), true, `missing @import target ${rel} from ${path.basename(file)}`);
    max = Math.max(max, 1 + importDepth(next, [...stack, resolved]));
  }
  return max;
}

describe('phase 5 CSS / HTML split (P5-1, P5-2)', () => {
  it('P5-1: tokens is the first /assets/css/ stylesheet and @import is at most one level', () => {
    const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    const root = parse(html);
    const hrefs = root
      .querySelectorAll('link[rel=stylesheet]')
      .map((el) => el.getAttribute('href') || '')
      .filter((href) => href.includes('/assets/css/'));

    assert.deepEqual(
      hrefs.map((h) => path.basename(h)),
      EXPECTED_ORDER,
      'index must link the eight sheets in cascade order, tokens first'
    );
    assert.equal(
      hrefs.some((h) => h.endsWith('/style.css')),
      false,
      'index must not also link the style.css shim (would double-apply)'
    );

    const shim = path.join(CSS_DIR, 'style.css');
    assert.equal(importDepth(shim), 1, 'style.css shim may @import once');
    for (const name of EXPECTED_ORDER) {
      assert.equal(importDepth(path.join(CSS_DIR, name)), 0, `${name} must not @import`);
    }

    const blob = cssFiles().map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    assert.doesNotMatch(blob, /@tailwind|tailwindcss/);
  });

  it('P5-2: css-selectors.json selectors survive the split', () => {
    const selectors = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'css-selectors.json'), 'utf8'));
    const blob = EXPECTED_ORDER.map((n) => fs.readFileSync(path.join(CSS_DIR, n), 'utf8')).join('\n');
    const missing = selectors.filter((sel) => !blob.includes(sel));
    assert.deepEqual(missing, [], `missing selectors: ${missing.join(', ')}`);
  });

  it('keyboard-help modal has no inline style attributes', () => {
    const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    const root = parse(html);
    const modal = root.querySelector('#keyboard-help-modal');
    assert.ok(modal, 'keyboard-help-modal must exist');
    const styled = modal.querySelectorAll('[style]');
    assert.equal(styled.length, 0, 'keyboard-help subtree must not use style=');
    assert.match(modal.toString(), /keyboard-help-content/);
    assert.match(modal.toString(), /keyboard-help-row/);
  });

  it('CACHE_NAME raised for split CSS and split sheets are precached', () => {
    const sw = fs.readFileSync(path.join(PUBLIC, 'ServiceWorker.js'), 'utf8');
    const match = sw.match(/const CACHE_NAME = '([^']+)'/);
    assert.ok(match, 'CACHE_NAME must be defined');
    assert.notEqual(match[1], 'nav-core-v10', 'CACHE_NAME must be raised above nav-core-v10');
    for (const name of EXPECTED_ORDER) {
      assert.match(sw, new RegExp(`/assets/css/${name}`));
    }
    const urlsBlock = sw.slice(sw.indexOf('URLS_TO_CACHE'), sw.indexOf('];', sw.indexOf('URLS_TO_CACHE')));
    assert.doesNotMatch(urlsBlock, /\/assets\/css\/style\.css/);
  });
});
