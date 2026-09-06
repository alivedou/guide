/**
 * 导航分类 / 书签主键重映射。
 * categories.id 与 items.id 在 SQL 里是全局主键；保存或导入必须换新 id，
 * 否则跨用户或重复提交会 UNIQUE 冲突。禁止在 Functions / src/server 再抄一份。
 */

export function newNavId() {
  return globalThis.crypto.randomUUID();
}

/**
 * @param {Array} categories
 * @param {Array} items
 * @param {() => string} [newId]
 * @returns {{ categories: object[], items: object[] }}
 */
export function remapNavIds(categories, items, newId = newNavId) {
  const catIdMap = new Map();
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeItems = Array.isArray(items) ? items : [];
  const remappedCategories = [];
  const remappedItems = [];

  safeCategories.forEach((cat, idx) => {
    const oldId = cat.id || `temp_cat_${idx}`;
    const id = newId();
    catIdMap.set(oldId, id);
    remappedCategories.push({
      id,
      name: cat.name || '未命名分类',
      icon: cat.icon !== undefined ? cat.icon : '📌',
      sort_order: idx,
      _isVideo: !!cat._isVideo,
      hidden: !!cat.hidden
    });
  });

  safeItems.forEach((item, idx) => {
    const oldCatId = item.catId || item.cat_id;
    let catId = catIdMap.get(oldCatId);
    if (!catId) {
      catId = catIdMap.values().next().value || null;
    }
    remappedItems.push({
      id: newId(),
      catId,
      cat_id: catId,
      title: item.title || '未命名书签',
      url: item.url || '',
      desc: item.desc !== undefined ? item.desc : null,
      icon: item.icon !== undefined ? item.icon : null,
      bg_color: item.bg_color || '',
      sort_order: idx,
      hidden: !!item.hidden
    });
  });

  return { categories: remappedCategories, items: remappedItems };
}

/**
 * @param {Array} categories
 * @param {Array} items
 * @param {{ maxCategories: number, maxItemsPerCategory: number }} quota
 */
export function checkNavQuota(categories, items, quota) {
  if (categories && categories.length > quota.maxCategories) {
    return {
      ok: false,
      error: `分类数量已达到上限 (${quota.maxCategories})`,
      code: 'ERR_QUOTA_EXCEEDED'
    };
  }
  if (items) {
    const catCounts = {};
    for (const item of items) {
      const cId = item.catId || item.cat_id;
      catCounts[cId] = (catCounts[cId] || 0) + 1;
      if (catCounts[cId] > quota.maxItemsPerCategory) {
        return {
          ok: false,
          error: `单个分类下的书签不能超过 ${quota.maxItemsPerCategory} 个`,
          code: 'ERR_QUOTA_EXCEEDED'
        };
      }
    }
  }
  return { ok: true };
}

function bindParam(value) {
  return value === undefined ? null : value;
}

export function buildSaveStatements(userId, remapped, settings) {
  const stmts = [
    { sql: 'DELETE FROM categories WHERE user_id = ?', params: [userId] },
    { sql: 'DELETE FROM items WHERE user_id = ?', params: [userId] }
  ];

  for (const cat of remapped.categories) {
    stmts.push({
      sql: 'INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [
        cat.id,
        userId,
        cat.name,
        cat.icon,
        cat.sort_order,
        cat._isVideo ? 1 : 0,
        cat.hidden ? 1 : 0
      ].map(bindParam)
    });
  }

  for (const item of remapped.items) {
    stmts.push({
      sql: 'INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [
        item.id,
        userId,
        item.catId,
        item.title,
        item.url,
        item.desc,
        item.icon,
        item.bg_color,
        item.sort_order,
        item.hidden ? 1 : 0
      ].map(bindParam)
    });
  }

  if (settings) {
    const linkTarget = settings.link_target || '_blank';
    stmts.push({
      sql: 'UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, hide_bg_mask = ?, isolated_view = ?, density = ?, simple_mode = ?, link_target = ?, theme_mode = ?, sync_interval = ? WHERE user_id = ?',
      params: [
        settings.cardWidth,
        settings.zenMode ? 1 : 0,
        settings.showFrequent ? 1 : 0,
        settings.bgUrl,
        settings.hideBgMask ? 1 : 0,
        settings.isolatedView ? 1 : 0,
        settings.density || 'standard',
        settings.simpleMode ? 1 : 0,
        linkTarget,
        settings.themeMode,
        settings.syncInterval !== undefined ? settings.syncInterval : 7,
        userId
      ].map(bindParam)
    });
  }

  return stmts;
}

export function buildResetStatements(userId, onboarding, newId = newNavId) {
  const stmts = [
    { sql: 'DELETE FROM categories WHERE user_id = ?', params: [userId] },
    { sql: 'DELETE FROM items WHERE user_id = ?', params: [userId] }
  ];
  const s = (onboarding && onboarding.settings) || {};
  const linkTarget = s.link_target || '_blank';
  stmts.push({
    sql: "UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = 1, bg_url = NULL, hide_bg_mask = ?, simple_mode = 0, link_target = ?, theme_mode = 'auto', sync_interval = 7 WHERE user_id = ?",
    params: [s.cardWidth || 125, s.zenMode ? 1 : 0, s.hideBgMask ? 1 : 0, linkTarget, userId]
  });

  for (const cat of onboarding.categories || []) {
    const newCatId = newId();
    stmts.push({
      sql: 'INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)',
      params: [newCatId, userId, cat.name, cat.icon, cat.hidden ? 1 : 0]
    });
    const catItems = (onboarding.items || []).filter((i) => (i.catId || i.cat_id) === cat.id);
    for (const item of catItems) {
      stmts.push({
        sql: 'INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [newId(), userId, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0]
      });
    }
  }

  return stmts;
}
