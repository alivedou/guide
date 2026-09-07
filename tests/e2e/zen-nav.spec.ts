import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.toggleZenMode === 'function' && typeof window.renderNav === 'function'
  );
}

async function enableZenWithManyCategories(page, count = 16) {
  await page.evaluate((n) => {
    if (!window.appData.categories) window.appData.categories = [];
    for (let i = 0; i < n; i += 1) {
      window.appData.categories.push({
        id: `zen-extra-${i}`,
        name: `分类${i + 1}`,
        icon: '📁',
        hidden: false,
      });
    }
    window.toggleZenMode(true);
  });
  await expect(page.locator('body')).toHaveClass(/zen-active/);
  await expect(page.locator('#zen-nav-menu .zen-menu-item').first()).toBeVisible();
}

test.describe('Zen category chips wrap instead of clipping', () => {
  test('last category stays inside the viewport and is clickable on desktop', async ({ page }) => {
    await waitForApp(page);
    await enableZenWithManyCategories(page, 16);

    const menu = page.locator('#zen-nav-menu');
    const last = menu.locator('.zen-menu-item').last();
    await expect(last).toBeVisible();

    const geometry = await page.evaluate(() => {
      const el = document.querySelector('#zen-nav-menu .zen-menu-item:last-child');
      const box = el.getBoundingClientRect();
      return {
        right: box.right,
        bottom: box.bottom,
        viewW: window.innerWidth,
        viewH: window.innerHeight,
        wrap: getComputedStyle(document.getElementById('zen-nav-menu')).flexWrap,
      };
    });

    expect(geometry.wrap).toBe('wrap');
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewW + 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewH);
    expect(geometry.bottom).toBeGreaterThan(0);

    await last.click();
    await expect(last).toHaveClass(/active/);
  });
});

test.describe('Zen category chips wrap on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('last category stays inside the phone viewport', async ({ page }) => {
    await waitForApp(page);
    await enableZenWithManyCategories(page, 12);

    const geometry = await page.evaluate(() => {
      const el = document.querySelector('#zen-nav-menu .zen-menu-item:last-child');
      const box = el.getBoundingClientRect();
      return {
        right: box.right,
        viewW: window.innerWidth,
        wrap: getComputedStyle(document.getElementById('zen-nav-menu')).flexWrap,
      };
    });

    expect(geometry.wrap).toBe('wrap');
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewW + 1);
  });
});
