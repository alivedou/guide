/**
 * 角色配额。Node / Pages Functions 必须 import 这里，禁止再抄一份对象字面量。
 * has_invite 由适配器注入，本文件不查库。
 */

export const QUOTA_CONFIG = {
  guest: { maxCategories: 6, maxItemsPerCategory: 12 },
  user: { maxCategories: 12, maxItemsPerCategory: 25 },
  invited_user: { maxCategories: 15, maxItemsPerCategory: 30 },
  super_user: { maxCategories: 20, maxItemsPerCategory: 40 },
  admin: { maxCategories: 150, maxItemsPerCategory: 500 }
};

/**
 * @param {{ id?: string, role?: string, hasInvite?: boolean, has_invite?: number|boolean }} user
 * @param {{ hasInvite?: boolean|number }} [extras]
 */
export function getQuota(user, extras = {}) {
  if (!user || !user.id || user.id === 'guest') return QUOTA_CONFIG.guest;
  if (user.role === 'admin') return QUOTA_CONFIG.admin;
  if (user.role === 'super_user') return QUOTA_CONFIG.super_user;
  if (user.role === 'user') {
    const invited =
      extras.hasInvite === true ||
      extras.hasInvite === 1 ||
      user.hasInvite === true ||
      user.has_invite === 1 ||
      user.has_invite === true;
    return invited ? QUOTA_CONFIG.invited_user : QUOTA_CONFIG.user;
  }
  return QUOTA_CONFIG.guest;
}
