/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * config.js - 后端 Serverless API 处理
 * 路由: /api/config
 * 基于 Cloudflare Pages Functions + Workers KV
 * ==========================================
 */

import { defaultData, MINIMAL_SAFE_DATA } from './defaultData.js';

const CONFIG = {
  bingApi: "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1"
};

const QUOTA_CONFIG = {
  guest: { maxCategories: 6, maxItemsPerCategory: 12 },
  user: { maxCategories: 12, maxItemsPerCategory: 25 },
  invited_user: { maxCategories: 15, maxItemsPerCategory: 30 },
  super_user: { maxCategories: 20, maxItemsPerCategory: 40 },
  admin: { maxCategories: 150, maxItemsPerCategory: 500 }
};

function getQuota(user) {
  if (user.role === 'admin') return QUOTA_CONFIG.admin;
  if (user.role === 'super_user') return QUOTA_CONFIG.super_user;
  if (user.id && user.role === 'user') {
    return user.hasInvite ? QUOTA_CONFIG.invited_user : QUOTA_CONFIG.user;
  }
  return QUOTA_CONFIG.guest;
}

function formatCNTime(date) {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const getFreshDefaultData = () => ({
  ...defaultData,
  lastUpdated: formatCNTime(new Date())
});

// ====== 新增：后端 SHA-256 哈希计算函数 ======
async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestGet(context) {
  const { env, data } = context;
  const authUser = data.user;
  const userId = authUser.id || "guest";
  const userRole = authUser.role;
  const isAdmin = (userRole === "admin" || userRole === "super_user");

  const kvKey = userId === "guest" ? "config" : `user_config:${userId}`;

  // Task UQ.2: 强制禁用浏览器及 CDN 缓存，确保配额实时同步
  const headers = { 
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };

  try {
    let dataStr = await env.nav.get(kvKey);
    let dataObj;
    
    if (dataStr) {
      dataObj = JSON.parse(dataStr);
    } else {
      dataObj = getFreshDefaultData();
      if (userId !== "guest") context.waitUntil(env.nav.put(kvKey, JSON.stringify(dataObj)));
    }

    if (userId === "guest") {
      dataObj.categories = dataObj.categories.filter(c => !c.hidden);
      dataObj.items = dataObj.items.filter(i => !i.hidden);
    }

    const quota = getQuota(authUser);

    return new Response(JSON.stringify({
      ...dataObj,
      isAdmin,
      user: userId,
      uid: authUser.uid,
      username: authUser.username,
      role: userRole,
      quota,
      lastUpdated: dataObj.lastUpdated || formatCNTime(new Date())
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "GET_ERROR", message: err.toString() }), { status: 500, headers });
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const authUser = data.user;
  
  if (!authUser.id) {
    return new Response(JSON.stringify({ 
      error: "Unauthorized", 
      code: "ERR_UNAUTHORIZED" 
    }), { status: 401 });
  }

  const userId = authUser.id;
  const kvKey = `user_config:${userId}`;
  const quota = getQuota(authUser);

  try {
    const newData = await request.json();
    const { categories, items, settings } = newData;
    
    // 动态资源配额校验
    if (categories && categories.length > quota.maxCategories) {
      return new Response(JSON.stringify({ 
        error: `分类数量已达到上限 (${quota.maxCategories})`, 
        code: "ERR_QUOTA_EXCEEDED" 
      }), { status: 403 });
    }

    // 统计每个分类下的书签数量
    if (items) {
      const catCounts = {};
      for (const item of items) {
        const cId = item.catId || item.cat_id;
        catCounts[cId] = (catCounts[cId] || 0) + 1;
        if (catCounts[cId] > quota.maxItemsPerCategory) {
          return new Response(JSON.stringify({ 
            error: `单个分类下的书签不能超过 ${quota.maxItemsPerCategory} 个`, 
            code: "ERR_QUOTA_EXCEEDED" 
          }), { status: 403 });
        }
      }
    }

    // 1. D1 事务持久化 (Task 6.3 & Task NT-V2.20)
    // 1.1 先行执行全量清空 (DELETE)，确保多租户数据干净剔除
    const deleteQueries = [
      env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(userId)
    ];
    await env.DB.batch(deleteQueries);

    // 1.2 动态封装所有写入操作 (INSERT & UPDATE)与多用户主键安全重塑 (Task NT-V2.22)
    const writeQueries = [];
    const catIdMap = new Map();
    const finalCategories = [];
    const finalItems = [];

    if (categories) {
      categories.forEach((cat, idx) => {
        const oldId = cat.id || `temp_cat_${idx}`;
        const newId = `cat_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        catIdMap.set(oldId, newId);

        const newCat = {
            id: newId,
            name: cat.name || '未命名分类',
            icon: cat.icon !== undefined ? cat.icon : '📌',
            sort_order: idx,
            _isVideo: !!cat._isVideo,
            hidden: !!cat.hidden
        };
        finalCategories.push(newCat);

        writeQueries.push(env.DB.prepare('INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(
            newId, 
            userId, 
            newCat.name, 
            newCat.icon, 
            idx, 
            newCat._isVideo ? 1 : 0, 
            newCat.hidden ? 1 : 0
          ));
      });
    }

    if (items) {
      items.forEach((item, idx) => {
        let oldCatId = item.catId || item.cat_id;
        let newCatId = catIdMap.get(oldCatId);
        
        if (!newCatId) {
            const fallbackNewId = Array.from(catIdMap.values())[0] || null;
            newCatId = fallbackNewId;
        }

        const newItemId = `item_${Math.random().toString(36).substring(2, 9)}_${Math.random().toString(36).substring(2, 9)}`;

        const newItem = {
            ...item,
            id: newItemId,
            catId: newCatId,
            cat_id: newCatId
        };
        finalItems.push(newItem);

        // Task 4.4: 强制所有权绑定，防止跨用户注入数据
        writeQueries.push(env.DB.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(
            newItemId, 
            userId, 
            newCatId, 
            item.title || '未命名书签', 
            item.url || '', 
            item.desc !== undefined ? item.desc : null, 
            item.icon !== undefined ? item.icon : null, 
            item.bg_color || '', 
            idx, 
            item.hidden ? 1 : 0
          ));
      });
    }

    if (settings) {
      writeQueries.push(env.DB.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, simple_mode = ?, open_in_new_tab = ?, theme_mode = ? WHERE user_id = ?')
        .bind(settings.cardWidth !== undefined ? settings.cardWidth : null, settings.zenMode ? 1 : 0, settings.showFrequent ? 1 : 0, settings.bgUrl || null, settings.simpleMode ? 1 : 0, settings.openInNewTab ? 1 : 0, settings.themeMode || 'auto', userId));
    }

    // 1.3 核心切片提交保护：分批执行写入操作，每包限制最大 80 条查询（绑定参数绝对低于 D1 的 1000 限制上限）
    const chunkSize = 80;
    for (let i = 0; i < writeQueries.length; i += chunkSize) {
        const chunk = writeQueries.slice(i, i + chunkSize);
        await env.DB.batch(chunk);
    }

    // 2. 将重塑主键后完全干净、全站独一无二的 categories 和 items 组合成全新 syncedData，写回并同步至 KV
    const syncedData = {
        ...newData,
        categories: finalCategories,
        items: finalItems,
        lastUpdated: formatCNTime(new Date())
    };
    await env.nav.put(kvKey, JSON.stringify(syncedData));
    
    return new Response(JSON.stringify({ success: true, categories: finalCategories, items: finalItems }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "POST_ERROR", message: err.toString() }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const authUser = data.user;
  
  if (!authUser.id) {
    return new Response(JSON.stringify({ 
      error: "Unauthorized", 
      code: "ERR_UNAUTHORIZED" 
    }), { status: 401 });
  }

  const userId = authUser.id;
  const kvKey = `user_config:${userId}`;
  try {
    // 1. 阶梯式模板加载逻辑 (Task 6.1.1)
    let onboardingData = null;
    try {
      const templateStr = await env.nav.get("system:onboarding_template");
      if (templateStr) onboardingData = JSON.parse(templateStr);
    } catch (e) { console.error('[Reset] Template load failed', e); }

    if (!onboardingData || !onboardingData.categories) {
      console.log('[Reset] Using defaultData fallback');
      onboardingData = defaultData;
    }
    
    if (!onboardingData || !onboardingData.categories) {
      console.warn('[Reset] CRITICAL: Using MINIMAL_SAFE_DATA');
      onboardingData = MINIMAL_SAFE_DATA;
    }
    
    // 2. D1 事务级重置
    const queries = [
      env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(userId),
      env.DB.prepare('UPDATE user_settings SET card_width = 125, zen_mode = 1, show_frequent = 1, bg_url = NULL, simple_mode = 0, open_in_new_tab = 1, theme_mode = \'auto\' WHERE user_id = ?').bind(userId)
    ];

    for (const cat of onboardingData.categories) {
      const newCatId = crypto.randomUUID();
      queries.push(env.DB.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)')
        .bind(newCatId, userId, cat.name, cat.icon, cat.hidden ? 1 : 0));
      
      const catItems = (onboardingData.items || []).filter(i => (i.catId || i.cat_id) === cat.id);
      for (const item of catItems) {
        const newItemId = crypto.randomUUID();
        queries.push(env.DB.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(newItemId, userId, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0));
      }
    }

    await env.DB.batch(queries);

    // 3. 同步 KV 缓存
    const resetData = { ...onboardingData, lastUpdated: formatCNTime(new Date()) };
    await env.nav.put(kvKey, JSON.stringify(resetData));
    
    return new Response(JSON.stringify({ success: true, message: "已重置为默认配置" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "DELETE_ERROR", message: err.toString() }), { status: 500 });
  }
}

// 保持对旧 onRequest 的向后兼容 (可选)
export async function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  if (method === "DELETE") return onRequestDelete(context);
  if (method === "OPTIONS") return onRequestOptions(context);
  return new Response(null, { status: 405 });
}