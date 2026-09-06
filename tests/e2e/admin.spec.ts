import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.openAdminHub === 'function');
}

test.describe('P4 admin hub tabs', () => {
  test('four hub tabs open after first-user register', async ({ page, request }) => {
    const username = `e2e_admin_${Date.now()}`;
    const password = 'Passw0rd!admin';
    const reg = await request.post('/api/auth/register', {
      data: { username, password },
    });
    expect(reg.ok()).toBeTruthy();
    const login = await request.post('/api/auth/login', {
      data: { username, password },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    expect(body.token).toBeTruthy();

    await page.goto('/');
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('nav_token', 'Bearer ' + token);
        localStorage.setItem('nav_current_user', JSON.stringify(user));
      },
      { token: body.token, user: body.user }
    );
    await page.reload();
    await waitForApp(page);
    await page.waitForSelector('#btn-admin-hub', { timeout: 15_000 });
    await page.locator('#btn-admin-hub').click();
    await expect(page.locator('#edit-modal')).toBeVisible();
    await expect(page.locator('.hub-tab[data-tab="users"]')).toBeVisible();

    for (const tab of ['users', 'invites', 'announcements', 'audit']) {
      await page.locator(`.hub-tab[data-tab="${tab}"]`).click();
      await expect(page.locator(`#hub-content-${tab}`)).toBeVisible();
      await expect(page.locator(`#hub-content-${tab}`)).toHaveClass(/active/);
    }
  });
});
