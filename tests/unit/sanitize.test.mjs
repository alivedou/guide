import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadSanitize } from '../helpers/sanitize.mjs';
import { FIXTURES } from '../helpers/paths.mjs';
import fs from 'node:fs';
import path from 'node:path';

describe('P4-6 import sanitize', () => {
  it('strips identity fields on export', () => {
    const api = loadSanitize();
    const dirty = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'nav-export.sample.json'), 'utf8'));
    const clean = api.sanitizeForExport(dirty);
    for (const key of ['user', 'username', 'uid', 'role', 'isAdmin', 'quota', 'lastUpdated']) {
      assert.equal(Object.hasOwn(clean, key), false, `export still has ${key}`);
    }
    assert.equal(clean.categories.length, dirty.categories.length);
    assert.equal(clean.items.length, dirty.items.length);
  });

  it('prepareImportPayload remaps every category and item id', () => {
    const api = loadSanitize();
    const dirty = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'nav-export.sample.json'), 'utf8'));
    const prepared = api.prepareImportPayload(dirty);
    const oldCat = new Set(dirty.categories.map((c) => c.id));
    const oldItem = new Set(dirty.items.map((i) => i.id));
    for (const c of prepared.categories) {
      assert.equal(oldCat.has(c.id), false, `category id reused: ${c.id}`);
    }
    for (const i of prepared.items) {
      assert.equal(oldItem.has(i.id), false, `item id reused: ${i.id}`);
    }
    assert.equal(Object.hasOwn(prepared, 'user'), false);
    assert.equal(Object.hasOwn(prepared.settings || {}, 'share_slug'), false);
    assert.equal(Object.hasOwn(prepared.settings || {}, 'is_shared'), false);
  });
});
