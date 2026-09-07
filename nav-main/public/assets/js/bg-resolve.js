/**
 * Resolve the homepage wallpaper without touching the DOM.
 * Local uploads stay in IndexedDB; the cloud only stores the `local_upload` pointer.
 */
export const LOCAL_BG_POINTER = 'local_upload';

function coverUrl(url) {
  return `url("${url}") center/cover fixed`;
}

function readBingUrl(bingUrl) {
  return bingUrl && String(bingUrl).startsWith('http') ? bingUrl : null;
}

/**
 * @param {{ bgUrl?: string, localBg?: string|null, bingUrl?: string|null, isSharedPage?: boolean }} input
 * @returns {{ kind: 'custom-local'|'custom-url'|'custom-css'|'bing'|'none', cssBackground: string, usedFallback: boolean }}
 */
export function resolveNavBackground(input = {}) {
  let bg = String(input.bgUrl || '').trim();
  const localBg = input.localBg || '';
  const bingUrl = readBingUrl(input.bingUrl);

  if (input.isSharedPage && bg === LOCAL_BG_POINTER) {
    bg = '';
  }

  if (bg === LOCAL_BG_POINTER) {
    if (localBg) {
      return { kind: 'custom-local', cssBackground: coverUrl(localBg), usedFallback: false };
    }
    bg = '';
  }

  if (bg) {
    if (bg.startsWith('http')) {
      return { kind: 'custom-url', cssBackground: coverUrl(bg), usedFallback: false };
    }
    return { kind: 'custom-css', cssBackground: bg, usedFallback: false };
  }

  if (bingUrl) {
    return { kind: 'bing', cssBackground: coverUrl(bingUrl), usedFallback: true };
  }

  return { kind: 'none', cssBackground: '', usedFallback: true };
}

/** True when Bing should be fetched (empty wallpaper, or a local_upload pointer with no pixels). */
export function shouldFetchBingWallpaper(input = {}) {
  return resolveNavBackground({ ...input, bingUrl: null }).kind === 'none';
}

if (typeof window !== 'undefined') {
  window.resolveNavBackground = resolveNavBackground;
  window.shouldFetchBingWallpaper = shouldFetchBingWallpaper;
}
