import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { defaultData, MINIMAL_SAFE_DATA } from '../../nav-main/shared/default-data.js';
import {
  defaultData as fromCompat,
  MINIMAL_SAFE_DATA as minimalCompat,
} from '../../nav-main/functions/api/defaultData.js';

function fingerprint(data) {
  return createHash('sha256')
    .update(JSON.stringify({ categories: data.categories, items: data.items }))
    .digest('hex');
}

describe('default-data', () => {
  it('has four default categories including 社交', () => {
    assert.equal(defaultData.categories.length, 4);
    assert.ok(defaultData.categories.some((c) => c.name === '社交'));
    assert.ok(defaultData.items.length >= 16);
  });

  it('compat re-export is the same object graph', () => {
    assert.equal(fingerprint(defaultData), fingerprint(fromCompat));
    assert.equal(fingerprint(MINIMAL_SAFE_DATA), fingerprint(minimalCompat));
    assert.equal(defaultData, fromCompat);
  });
});
