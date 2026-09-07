import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { LOCAL_BG_POINTER, resolveNavBackground, shouldFetchBingWallpaper } from '../../nav-main/public/assets/js/bg-resolve.js';
import { REPO_ROOT } from '../helpers/paths.mjs';

const BING = 'https://cn.bing.com/th?id=OHR.test.jpg';
const LOCAL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

describe('local wallpaper pointer vs cloud pull', () => {
  it('uses IndexedDB pixels when the cloud pointer is local_upload', () => {
    const out = resolveNavBackground({ bgUrl: LOCAL_BG_POINTER, localBg: LOCAL, bingUrl: BING });
    assert.equal(out.kind, 'custom-local');
    assert.equal(out.usedFallback, false);
    assert.match(out.cssBackground, /data:image\/gif/);
    assert.equal(out.cssBackground.includes('default-bg.jpg'), false);
  });

  it('falls back to Bing instead of a missing default-bg.jpg when pixels are gone', () => {
    const out = resolveNavBackground({ bgUrl: LOCAL_BG_POINTER, localBg: null, bingUrl: BING });
    assert.equal(out.kind, 'bing');
    assert.equal(out.usedFallback, true);
    assert.match(out.cssBackground, /OHR\.test\.jpg/);
    assert.equal(out.cssBackground.includes('default-bg.jpg'), false);
  });

  it('clears inline background when pointer and Bing are both missing (CSS theme fallback)', () => {
    const out = resolveNavBackground({ bgUrl: LOCAL_BG_POINTER, localBg: '', bingUrl: '' });
    assert.equal(out.kind, 'none');
    assert.equal(out.cssBackground, '');
  });

  it('treats share pages with local_upload as Bing/empty, not a broken custom tile', () => {
    const out = resolveNavBackground({
      bgUrl: LOCAL_BG_POINTER,
      localBg: '',
      bingUrl: BING,
      isSharedPage: true
    });
    assert.equal(out.kind, 'bing');
  });

  it('keeps http wallpaper URLs', () => {
    const out = resolveNavBackground({ bgUrl: 'https://cdn.example/wall.jpg', localBg: LOCAL, bingUrl: BING });
    assert.equal(out.kind, 'custom-url');
    assert.match(out.cssBackground, /cdn\.example\/wall\.jpg/);
  });

  it('shouldFetchBingWallpaper is true only when there is nothing to paint yet', () => {
    assert.equal(shouldFetchBingWallpaper({ bgUrl: '', localBg: null }), true);
    assert.equal(shouldFetchBingWallpaper({ bgUrl: LOCAL_BG_POINTER, localBg: null }), true);
    assert.equal(shouldFetchBingWallpaper({ bgUrl: LOCAL_BG_POINTER, localBg: LOCAL }), false);
    assert.equal(shouldFetchBingWallpaper({ bgUrl: 'https://cdn.example/a.jpg', localBg: null }), false);
  });

  it('styles.js no longer points at the missing default-bg.jpg asset', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'nav-main/public/assets/js/features/styles.js'), 'utf8');
    assert.equal(src.includes('default-bg.jpg'), false);
    assert.match(src, /resolveNavBackground/);
  });
});
