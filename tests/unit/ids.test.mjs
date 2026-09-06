import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { remapNavIds, checkNavQuota } from '../../nav-main/shared/ids.js';
import { QUOTA_CONFIG } from '../../nav-main/shared/quota.js';

describe('ids remap', () => {
  it('P3-1 remapping twice yields different primary keys and rewritten catId', () => {
    const categories = [{ id: 'keep-me', name: '社交', icon: '💬' }];
    const items = [{ id: 'item-keep', catId: 'keep-me', title: '微博', url: 'https://weibo.com/' }];

    const first = remapNavIds(categories, items);
    const second = remapNavIds(categories, items);

    assert.equal(first.categories[0].name, '社交');
    assert.equal(first.items[0].title, '微博');
    assert.notEqual(first.categories[0].id, 'keep-me');
    assert.notEqual(first.items[0].id, 'item-keep');
    assert.equal(first.items[0].catId, first.categories[0].id);
    assert.equal(first.items[0].cat_id, first.categories[0].id);

    assert.notEqual(first.categories[0].id, second.categories[0].id);
    assert.notEqual(first.items[0].id, second.items[0].id);
    assert.equal(second.items[0].catId, second.categories[0].id);
  });

  it('P3-2 quota guard rejects 13 user categories and 26 items in one category', () => {
    const quota = QUOTA_CONFIG.user;
    const cats = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, name: `n${i}` }));
    const overCats = checkNavQuota(cats, [], quota);
    assert.equal(overCats.ok, false);
    assert.equal(overCats.code, 'ERR_QUOTA_EXCEEDED');

    const okCats = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}` }));
    const tooManyItems = Array.from({ length: 26 }, (_, i) => ({
      id: `i${i}`,
      catId: 'c0',
      title: `t${i}`,
      url: 'https://example.com'
    }));
    const overItems = checkNavQuota(okCats, tooManyItems, quota);
    assert.equal(overItems.ok, false);
    assert.equal(overItems.code, 'ERR_QUOTA_EXCEEDED');

    const okItems = tooManyItems.slice(0, 25);
    const ok = checkNavQuota(okCats, okItems, quota);
    assert.equal(ok.ok, true);
  });
});
