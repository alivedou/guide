import { test, expect } from '@playwright/test';

async function waitForShare(page) {
  await page.waitForFunction(
    () =>
      typeof window.initSharedPage === 'function' &&
      typeof window.renderNav === 'function' &&
      document.getElementById('grid-container')
  );
}

test.describe('shared homepage', () => {
  test('visitor sees owner custom nav at /?p=slug, not the default template', async ({
    browser,
    request,
  }) => {
    const username = `share_e2e_${Date.now()}`;
    const password = 'Passw0rd!share';
    const slug = `e2e-${Date.now()}`;

    const reg = await request.post('/api/auth/register', { data: { username, password } });
    expect(reg.ok()).toBeTruthy();
    const login = await request.post('/api/auth/login', { data: { username, password } });
    expect(login.ok()).toBeTruthy();
    const auth = await login.json();
    const token = 'Bearer ' + auth.token;

    const saved = await request.post('/api/config', {
      headers: { Authorization: token },
      data: {
        categories: [{ id: 'share-cat', name: '分享专属分类', icon: '📌' }],
        items: [
          {
            id: 'share-item',
            catId: 'share-cat',
            title: '分享专属书签',
            url: 'https://share.example/',
          },
        ],
        settings: {},
      },
    });
    expect(saved.ok()).toBeTruthy();

    const profile = await request.post('/api/user/profile', {
      headers: { Authorization: token },
      data: { username, isShared: true, shareSlug: slug },
    });
    expect(profile.ok()).toBeTruthy();

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await page.goto(`/?p=${slug}`);
    await waitForShare(page);
    await expect(page.locator('#grid-container')).toContainText('分享专属分类');
    await expect(page.locator('#grid-container')).toContainText('分享专属书签');
    await expect(page.locator('#grid-container')).not.toContainText('微博');
    await expect(page).toHaveURL(new RegExp(`[?&]p=${slug}`));
    await visitor.close();
  });

  test('missing share slug stays on the share URL instead of bouncing to the default home', async ({
    page,
  }) => {
    await page.goto('/?p=this-slug-does-not-exist');
    await waitForShare(page);
    await expect(page.locator('#grid-container')).toContainText('该分享主页未开启或不存在');
    await page.waitForTimeout(3500);
    await expect(page).toHaveURL(/p=this-slug-does-not-exist/);
  });
});
