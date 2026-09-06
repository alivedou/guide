import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getQuota, QUOTA_CONFIG } from '../../nav-main/shared/quota.js';

describe('quota', () => {
  it('guest / missing user', () => {
    assert.deepEqual(getQuota(null), QUOTA_CONFIG.guest);
    assert.deepEqual(getQuota({}), QUOTA_CONFIG.guest);
    assert.deepEqual(getQuota({ id: 'guest', role: 'user' }), QUOTA_CONFIG.guest);
    assert.equal(QUOTA_CONFIG.guest.maxCategories, 6);
    assert.equal(QUOTA_CONFIG.guest.maxItemsPerCategory, 12);
  });

  it('plain user', () => {
    assert.deepEqual(getQuota({ id: 'u1', role: 'user' }), QUOTA_CONFIG.user);
    assert.equal(QUOTA_CONFIG.user.maxCategories, 12);
    assert.equal(QUOTA_CONFIG.user.maxItemsPerCategory, 25);
  });

  it('invited user via extras or hasInvite', () => {
    assert.deepEqual(
      getQuota({ id: 'u1', role: 'user' }, { hasInvite: true }),
      QUOTA_CONFIG.invited_user
    );
    assert.deepEqual(
      getQuota({ id: 'u1', role: 'user', hasInvite: true }),
      QUOTA_CONFIG.invited_user
    );
    assert.equal(QUOTA_CONFIG.invited_user.maxCategories, 15);
    assert.equal(QUOTA_CONFIG.invited_user.maxItemsPerCategory, 30);
  });

  it('super_user and admin', () => {
    assert.deepEqual(getQuota({ id: 's', role: 'super_user' }), QUOTA_CONFIG.super_user);
    assert.equal(QUOTA_CONFIG.super_user.maxCategories, 20);
    assert.equal(QUOTA_CONFIG.super_user.maxItemsPerCategory, 40);
    assert.deepEqual(getQuota({ id: 'a', role: 'admin' }), QUOTA_CONFIG.admin);
    assert.equal(QUOTA_CONFIG.admin.maxCategories, 150);
    assert.equal(QUOTA_CONFIG.admin.maxItemsPerCategory, 500);
  });
});
