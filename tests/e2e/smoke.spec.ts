import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      typeof window.showToast === 'function' &&
      typeof window.closeAllModals === 'function' &&
      typeof window.updateStyles === 'function' &&
      typeof window.initSearch === 'function'
  );
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('#btn-summon-search')).toBeVisible();
}

test.describe('P4 smoke', () => {
  test('homepage shell and window APIs', async ({ page }) => {
    await waitForApp(page);
    const apis = await page.evaluate(() => ({
      showToast: typeof window.showToast,
      closeAllModals: typeof window.closeAllModals,
      updateStyles: typeof window.updateStyles,
      toggleSidebar: typeof window.toggleSidebar,
      setSearchEngine: typeof window.setSearchEngine,
      switchHubTab: typeof window.switchHubTab,
      openAdminHub: typeof window.openAdminHub,
      togglePageManagement: typeof window.togglePageManagement,
    }));
    for (const [name, kind] of Object.entries(apis)) {
      expect(kind, name).toBe('function');
    }
    await expect(page.locator('#grid-container')).toBeVisible();
    await expect(page.locator('#sea-input')).toBeAttached();
    await expect(page.locator('.copyright-text a')).toHaveAttribute(
      'href',
      'https://github.com/alivedou/CF-nav'
    );
  });
});
