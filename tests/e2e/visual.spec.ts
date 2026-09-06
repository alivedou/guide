import { test, expect } from '@playwright/test';

const shot = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.003,
};

async function waitForApp(page) {
  await page.route('**/api/bing**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  );
  await page.goto('/');
  await page.waitForFunction(
    () =>
      typeof window.setThemeMode === 'function' &&
      typeof window.toggleZenMode === 'function' &&
      typeof window.togglePageManagement === 'function' &&
      typeof window.updateStyles === 'function'
  );
  await expect(page.locator('#grid-container .card').first()).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.body.style.backgroundImage = '';
    document.body.removeAttribute('data-bg-type');
    const toast = document.getElementById('toast');
    if (toast) toast.style.display = 'none';
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  });
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
  });
}

test.describe('P5 visual themes', () => {
  test('dark theme screenshot', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => window.setThemeMode('dark'));
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
    await expect(page).toHaveScreenshot('theme-dark.png', shot);
  });

  test('light theme screenshot', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => window.setThemeMode('light'));
    await expect(page.locator('body')).toHaveClass(/light-theme/);
    await expect(page).toHaveScreenshot('theme-light.png', shot);
  });

  test('zen mode screenshot', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      window.setThemeMode('dark');
      window.toggleZenMode(true);
    });
    await expect(page.locator('body')).toHaveClass(/zen-active/);
    await expect(page).toHaveScreenshot('theme-zen.png', shot);
  });

  test('page-manage screenshot', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      window.setThemeMode('dark');
      window.togglePageManagement(true);
    });
    await expect(page.locator('body')).toHaveClass(/page-manage-active/);
    await page.evaluate(() => {
      const toast = document.getElementById('toast');
      if (toast) toast.style.display = 'none';
    });
    await expect(page).toHaveScreenshot('theme-manage.png', shot);
  });

  test('density and card-width still change the grid', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      window.appData.settings.density = 'compact';
      window.updateStyles();
    });
    await expect(page.locator('body')).toHaveClass(/density-compact/);
    const compact = await page.locator('.card').first().evaluate((el) => getComputedStyle(el).width);
    await page.evaluate(() => {
      window.appData.settings.density = 'comfortable';
      window.updateStyles();
    });
    await expect(page.locator('body')).toHaveClass(/density-comfortable/);
    const comfortable = await page.locator('.card').first().evaluate((el) => getComputedStyle(el).width);
    expect(comfortable).not.toBe(compact);

    const before = await page.locator('.card').first().evaluate((el) => getComputedStyle(el).width);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--card-w', '140px');
      document.documentElement.style.setProperty('--card-h', '140px');
    });
    const wide = await page.locator('.card').first().evaluate((el) => getComputedStyle(el).width);
    expect(wide).not.toBe(before);
  });
});
