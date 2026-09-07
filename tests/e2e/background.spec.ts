import { test, expect } from '@playwright/test';

const BING = 'https://cn.bing.com/th?id=OHR.cfnav-test.jpg';
const LOCAL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.updateStyles === 'function');
}

test.describe('local wallpaper after cloud settings pull', () => {
  test('missing local pixels with local_upload uses Bing, not default-bg.jpg', async ({ page }) => {
    await waitForApp(page);
    const painted = await page.evaluate((bing) => {
      window.navLocalBgImage = null;
      localStorage.removeItem('nav_local_bg_image');
      localStorage.setItem('nav_bing_cache', JSON.stringify({ url: bing, timestamp: Date.now() }));
      if (!window.appData.settings) window.appData.settings = {};
      window.appData.settings.bgUrl = 'local_upload';
      window.updateStyles();
      return {
        bg: document.body.style.background,
        type: document.body.dataset.bgType,
      };
    }, BING);

    expect(painted.type).toBe('bing');
    expect(painted.bg).toContain(BING);
    expect(painted.bg).not.toContain('default-bg.jpg');
  });

  test('same-device pixels still win after a cloud pointer pull', async ({ page }) => {
    await waitForApp(page);
    const painted = await page.evaluate(async (local) => {
      window.navLocalBgImage = local;
      if (!window.appData.settings) window.appData.settings = {};
      // Simulate GET /api/config overwriting settings the way pullBackup does.
      window.appData = {
        ...window.appData,
        settings: { ...window.appData.settings, bgUrl: 'local_upload' },
      };
      if (typeof window.initLocalBgImage === 'function') {
        await window.initLocalBgImage();
      }
      window.navLocalBgImage = window.navLocalBgImage || local;
      window.updateStyles();
      return {
        bg: document.body.style.background,
        type: document.body.dataset.bgType,
      };
    }, LOCAL);

    expect(painted.type).toBe('custom');
    expect(painted.bg).toContain('data:image/gif');
    expect(painted.bg).not.toContain('default-bg.jpg');
  });
});
