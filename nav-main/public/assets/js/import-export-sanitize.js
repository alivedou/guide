/**
 * import-export-sanitize.js
 * 本地 JSON 导入/导出清洗（增量模块）
 *
 * 问题背景：
 * - 导出含 user/isAdmin/quota 等身份字段，跨用户导入会污染会话
 * - 分类/书签 id 在 D1/SQLite 全局唯一；原样导入会 UNIQUE constraint 冲突
 * - 同浏览器切换用户后，localStorage 的 nav_app_data 被导入覆盖后同步上云易 500
 */
(function () {
  'use strict';

  var IDENTITY_KEYS = [
    'user', 'username', 'uid', 'role', 'isAdmin', 'quota',
    'lastUpdated', 'clicks_history'
  ];

  function newId(prefix) {
    return (
      prefix +
      '_' +
      Math.random().toString(36).substring(2, 9) +
      '_' +
      Date.now().toString(36)
    );
  }

  /**
   * 导出前清洗：只保留书签数据 + 偏好，去掉身份/配额
   */
  function sanitizeForExport(appData) {
    if (!appData || typeof appData !== 'object') {
      throw new Error('无有效配置可导出');
    }
    var out = {
      categories: Array.isArray(appData.categories)
        ? JSON.parse(JSON.stringify(appData.categories))
        : [],
      items: Array.isArray(appData.items)
        ? JSON.parse(JSON.stringify(appData.items))
        : [],
      settings: appData.settings
        ? JSON.parse(JSON.stringify(appData.settings))
        : {}
    };
    if (out.settings) {
      delete out.settings.cardWidth; // 与原 doExportJson 行为一致
    }
    // 元数据（便于人工识别，导入时会剥离）
    out._exportMeta = {
      format: 'cloudnav-config-v1',
      exportedAt: new Date().toISOString()
    };
    return out;
  }

  /**
   * 导入后规范化：剥离身份字段 + 重映射分类/书签 ID，避免跨用户主键冲突
   */
  function prepareImportPayload(parsed) {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('无效的导入数据');
    }
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
      throw new Error('无效的书签数据格式（需要 categories 与 items）');
    }

    var catIdMap = {};
    var categories = parsed.categories.map(function (cat, idx) {
      var oldId = cat.id || 'temp_cat_' + idx;
      var nid = newId('cat');
      catIdMap[oldId] = nid;
      return {
        id: nid,
        name: cat.name || '未命名分类',
        icon: cat.icon !== undefined ? cat.icon : '📌',
        hidden: !!cat.hidden,
        _isVideo: !!(cat._isVideo || cat.is_video),
        sort_order: typeof cat.sort_order === 'number' ? cat.sort_order : idx
      };
    });

    var fallbackCat = categories.length ? categories[0].id : null;
    var items = parsed.items.map(function (item, idx) {
      var oldCat = item.catId || item.cat_id;
      var newCat = catIdMap[oldCat] || fallbackCat;
      return {
        id: newId('item'),
        catId: newCat,
        cat_id: newCat,
        title: item.title || '未命名书签',
        url: item.url || '',
        desc: item.desc !== undefined ? item.desc : '',
        icon: item.icon !== undefined ? item.icon : '',
        bg_color: item.bg_color || '',
        hidden: !!item.hidden,
        sort_order: typeof item.sort_order === 'number' ? item.sort_order : idx
      };
    });

    var settings = {};
    if (parsed.settings && typeof parsed.settings === 'object') {
      settings = JSON.parse(JSON.stringify(parsed.settings));
      // 不从备份恢复分享状态，避免 slug 冲突
      delete settings.is_shared;
      delete settings.share_slug;
      delete settings.isShared;
      delete settings.shareSlug;
    }

    return { categories: categories, items: items, settings: settings };
  }

  /**
   * 从任意解析结果去掉身份字段（防御）
   */
  function stripIdentity(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    IDENTITY_KEYS.forEach(function (k) {
      delete obj[k];
    });
    delete obj._exportMeta;
    return obj;
  }

  window.ImportExportSanitize = {
    sanitizeForExport: sanitizeForExport,
    prepareImportPayload: prepareImportPayload,
    stripIdentity: stripIdentity
  };
})();
