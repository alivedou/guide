/**
 * 公开分享主页：把 SQL 行转成前端导航 JSON，并去掉隐藏分类/书签。
 * KV 键名不出现在这里。
 */

import { defaultData } from './default-data.js';

/**
 * @param {object[]} categories SQL categories 行
 * @param {object[]} items SQL items 行
 * @param {object|null|undefined} settingsRow SQL user_settings 行
 * @param {string|null} [existingLastUpdated]
 */
export function buildUserNavSnapshot(categories, items, settingsRow, existingLastUpdated = null) {
  const settings = settingsRow
    ? {
        cardWidth: settingsRow.card_width,
        zenMode: !!settingsRow.zen_mode,
        showFrequent: !!(settingsRow.show_frequent ?? settingsRow.show_f_requent),
        bgUrl: settingsRow.bg_url,
        hideBgMask: !!settingsRow.hide_bg_mask,
        isolatedView: !!settingsRow.isolated_view,
        density: settingsRow.density || 'standard',
        simpleMode: !!settingsRow.simple_mode,
        link_target: settingsRow.link_target || '_blank',
        syncInterval:
          settingsRow.sync_interval !== null && settingsRow.sync_interval !== undefined
            ? settingsRow.sync_interval
            : 7,
        themeMode: settingsRow.theme_mode
      }
    : { ...defaultData.settings };

  if (settingsRow && settingsRow.show_frequent !== undefined) {
    settings.showFrequent = !!settingsRow.show_frequent;
  }

  return {
    categories: (categories || []).map((c) => ({
      ...c,
      id: c.id,
      _isVideo: !!c.is_video,
      hidden: !!c.hidden
    })),
    items: (items || []).map((i) => ({
      ...i,
      catId: i.cat_id || i.catId,
      cat_id: i.cat_id || i.catId,
      hidden: !!i.hidden
    })),
    settings,
    lastUpdated: existingLastUpdated || null
  };
}

export function navSnapshotIsEmpty(dataObj) {
  return !((dataObj?.categories || []).length || (dataObj?.items || []).length);
}

/**
 * 公开分享脱敏：隐藏分类及其书签、单独隐藏的书签都不下发。
 */
export function filterHiddenNav(dataObj) {
  const categories = (dataObj?.categories || []).filter((c) => !c.hidden);
  const visibleCatIds = new Set(categories.map((c) => c.id));
  const items = (dataObj?.items || []).filter((i) => {
    if (i.hidden) return false;
    const catId = i.catId || i.cat_id;
    return !catId || visibleCatIds.has(catId);
  });
  return {
    categories,
    items,
    settings: dataObj?.settings && typeof dataObj.settings === 'object' ? dataObj.settings : {}
  };
}

export function sharePagePayload(publicNav, owner, slug) {
  return {
    categories: publicNav.categories || [],
    items: publicNav.items || [],
    settings: publicNav.settings || {},
    isReadOnlyShare: true,
    shareOwner: owner && owner.username ? owner.username : 'Nav User',
    shareUid: owner && owner.uid != null ? owner.uid : null,
    shareSlug: slug
  };
}
