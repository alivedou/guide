import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.toggleSidebar === 'function' && typeof window.initSearch === 'function'
  );
  await expect(page.locator('#sidebar-toggle')).toBeVisible();
  await expect(page.locator('#btn-summon-search')).toBeVisible();
}

test.describe('P5 mobile drawer', () => {
  test('hamburger opens sidebar then overlay closes it; search summon is clickable', async ({
    page,
  }) => {
    await waitForApp(page);

    const sidebar = page.locator('#sidebar');
    const overlay = page.locator('#sidebar-overlay');
    await expect(sidebar).not.toHaveClass(/open/);

    await page.locator('#sidebar-toggle').click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(overlay).toHaveClass(/visible/);
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);

    await overlay.click({ force: true, position: { x: 360, y: 200 } });
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(overlay).not.toHaveClass(/visible/);

    await page.locator('#btn-summon-search').click();
    await expect(page.locator('body')).toHaveClass(/search-active/);
    await expect(page.locator('#sea-input')).toBeVisible();
  });
});
