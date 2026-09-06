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

    await overlay.evaluate((el) => el.click());
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(overlay).not.toHaveClass(/visible/);

    await page.locator('#btn-summon-search').click();
    await expect(page.locator('body')).toHaveClass(/search-active/);
    await expect(page.locator('#sea-input')).toBeVisible();
  });
});

test.describe('P5 mobile bookmark cards', () => {
  async function measureFirstCard(page) {
    const card = page.locator('.nav-grid .card:not(.add-new-card)').first();
    await expect(card).toBeVisible();
    return card.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const h3 = el.querySelector('h3');
      const h3cs = h3 ? getComputedStyle(h3) : null;
      return {
        width: box.width,
        height: box.height,
        lineClamp: h3cs ? String(h3cs.webkitLineClamp || h3cs.getPropertyValue('-webkit-line-clamp') || '') : '',
        overflow: h3cs ? h3cs.overflow : '',
        display: h3cs ? h3cs.display : '',
      };
    });
  }

  test('layout density does not shrink classic cards; titles are unclamped', async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator('.nav-grid .card:not(.add-new-card)').first()).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      window.appData.settings.density = 'compact';
      window.updateStyles();
    });
    await expect(page.locator('body')).toHaveClass(/density-compact/);
    const compact = await measureFirstCard(page);

    await page.evaluate(() => {
      window.appData.settings.density = 'comfortable';
      window.updateStyles();
    });
    await expect(page.locator('body')).toHaveClass(/density-comfortable/);
    const comfortable = await measureFirstCard(page);

    expect(Math.abs(compact.width - comfortable.width)).toBeLessThan(1);
    expect(Math.abs(compact.height - comfortable.height)).toBeLessThan(1);
    expect(compact.width).toBeGreaterThan(90);
    expect(compact.width).toBeLessThan(160);

    const clamp = String(comfortable.lineClamp).toLowerCase();
    expect(clamp === 'none' || clamp === '' || clamp === 'unset').toBeTruthy();
    expect(comfortable.overflow).not.toBe('hidden');
    expect(comfortable.display).not.toBe('-webkit-box');
  });

  test('classic phone grid shows three bookmark cards in the first row', async ({ page }) => {
    await waitForApp(page);
    const cards = page.locator('.nav-grid').first().locator('.card:not(.add-new-card)');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await expect(cards).toHaveCount(await cards.count());
    expect(await cards.count()).toBeGreaterThanOrEqual(3);

    const row = await cards.evaluateAll((els) => {
      const first = els.slice(0, 3).map((el) => {
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), width: box.width };
      });
      const columns = getComputedStyle(els[0].parentElement).gridTemplateColumns;
      return { first, columns };
    });

    expect(row.first[0].top).toBe(row.first[1].top);
    expect(row.first[1].top).toBe(row.first[2].top);
    expect(row.columns.split(' ').filter(Boolean)).toHaveLength(3);
  });
});
