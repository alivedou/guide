import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildUserNavSnapshot,
  filterHiddenNav,
  navSnapshotIsEmpty,
  sharePagePayload,
} from '../../nav-main/shared/share-page.js';

describe('share-page helpers', () => {
  it('maps SQL rows into frontend nav shape', () => {
    const snap = buildUserNavSnapshot(
      [{ id: 'c1', name: '工作', is_video: 1, hidden: 0, extra: 'keep' }],
      [{ id: 'i1', cat_id: 'c1', title: '邮件', url: 'https://mail.example/', hidden: 0 }],
      { card_width: 90, zen_mode: 1, show_frequent: 1, density: 'compact', sync_interval: 3 }
    );
    assert.equal(snap.categories[0]._isVideo, true);
    assert.equal(snap.categories[0].hidden, false);
    assert.equal(snap.items[0].catId, 'c1');
    assert.equal(snap.settings.cardWidth, 90);
    assert.equal(snap.settings.zenMode, true);
    assert.equal(snap.settings.showFrequent, true);
    assert.equal(snap.settings.syncInterval, 3);
  });

  it('drops hidden categories, their items, and hidden bookmarks', () => {
    const publicNav = filterHiddenNav({
      categories: [
        { id: 'open', name: '公开', hidden: false },
        { id: 'secret', name: '隐藏分类', hidden: true },
      ],
      items: [
        { id: 'a', catId: 'open', title: '可见', hidden: false },
        { id: 'b', catId: 'secret', title: '分类下隐藏', hidden: false },
        { id: 'c', catId: 'open', title: '单独隐藏', hidden: true },
      ],
      settings: { density: 'standard' },
    });
    assert.deepEqual(publicNav.categories.map((c) => c.name), ['公开']);
    assert.deepEqual(publicNav.items.map((i) => i.title), ['可见']);
    assert.equal(publicNav.settings.density, 'standard');
  });

  it('builds the public share envelope', () => {
    const body = sharePagePayload(
      { categories: [{ name: '工作' }], items: [], settings: {} },
      { username: 'adou', uid: 10001 },
      'adou'
    );
    assert.equal(body.isReadOnlyShare, true);
    assert.equal(body.shareOwner, 'adou');
    assert.equal(body.shareUid, 10001);
    assert.equal(body.shareSlug, 'adou');
    assert.equal(navSnapshotIsEmpty(body), false);
    assert.equal(navSnapshotIsEmpty({ categories: [], items: [] }), true);
  });
});
