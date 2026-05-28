/**
 * ==========================================
 * config.js - 后端 Serverless API 处理
 * 路由: /api/config
 * 基于 Cloudflare Pages Functions + Workers KV
 * ==========================================
 */

import * as jose from 'jose';
import { defaultData, MINIMAL_SAFE_DATA } from './defaultData.js';

const CONFIG = {
  bingApi: "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1"
};

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

// ====== 鉴权提取函数 (Task 2.6.1: 使用 jose 验证 JWT) ======
async function getAuthContext(request, env) {
  const authHeader = request.headers.get("Authorization");
  let userId = "guest";
  let userRole = "guest";
  let username = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
      
      const { payload } = await jose.jwtVerify(token, secret);
      userId = payload.id;
      
      const user = await env.DB.prepare('SELECT username, role, status FROM users WHERE id = ?').bind(userId).first();
      if (user && user.status !== 'frozen') {
        userRole = user.role;
        username = user.username;
      } else {
        userId = "guest";
      }
    } catch (e) {
      console.error('[Auth] JWT Verification failed:', e.message);
      if (e.code === 'ERR_JWT_EXPIRED') {
        return { userId: "expired", userRole: "guest", username: "", isAdmin: false };
      }
      userId = "guest";
    }
  }
  return { userId, userRole, username, isAdmin: (userRole === "admin" || userRole === "super_user") };
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
  const { request, env } = context;
  const auth = await getAuthContext(request, env);
  if (auth.userId === "expired") {
    return new Response(JSON.stringify({ error: "Session Expired", code: "ERR_JWT_EXPIRED" }), { status: 401 });
  }
  const { userId, userRole, username, isAdmin } = auth;
  const kvKey = userId === "guest" ? "config" : `user_config:${userId}`;

  const headers = { "Content-Type": "application/json;charset=UTF-8" };

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

    return new Response(JSON.stringify({
      ...dataObj,
      isAdmin,
      user: userId,
      username: username,
      role: userRole,
      lastUpdated: dataObj.lastUpdated || formatCNTime(new Date())
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "GET_ERROR", message: err.toString() }), { status: 500, headers });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await getAuthContext(request, env);
  
  if (auth.userId === "guest" || auth.userId === "expired") {
    return new Response(JSON.stringify({ 
      error: "Unauthorized", 
      code: auth.userId === "expired" ? "ERR_JWT_EXPIRED" : "ERR_UNAUTHORIZED" 
    }), { status: 401 });
  }

  const userId = auth.userId;
  const kvKey = `user_config:${userId}`;
  try {
    const newData = await request.json();
    const { categories, items, settings } = newData;
    
    // Task 4.3: 资源配额校验
    if (categories && categories.length > 20) {
      return new Response(JSON.stringify({ error: "分类数量已达到上限 (20)", code: "ERR_QUOTA_EXCEEDED" }), { status: 403 });
    }

    // 统计每个分类下的书签数量
    if (items) {
      const catCounts = {};
      for (const item of items) {
        const cId = item.catId || item.cat_id;
        catCounts[cId] = (catCounts[cId] || 0) + 1;
        if (catCounts[cId] > 100) {
          return new Response(JSON.stringify({ error: "单个分类下的书签不能超过 100 个", code: "ERR_QUOTA_EXCEEDED" }), { status: 403 });
        }
      }
    }

    // 1. D1 事务持久化 (Task 6.3)
    const queries = [
      env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(userId)
    ];

    if (categories) {
      categories.forEach((cat, idx) => {
        queries.push(env.DB.prepare('INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(cat.id, userId, cat.name, cat.icon, idx, cat._isVideo ? 1 : 0, cat.hidden ? 1 : 0));
      });
    }

    if (items) {
      items.forEach((item, idx) => {
        queries.push(env.DB.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(item.id, userId, item.catId || item.cat_id, item.title, item.url, item.desc, item.icon, item.bg_color || '', idx, item.hidden ? 1 : 0));
      });
    }

    if (settings) {
      queries.push(env.DB.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, simple_mode = ?, open_in_new_tab = ?, theme_mode = ? WHERE user_id = ?')
        .bind(settings.cardWidth, settings.zenMode ? 1 : 0, settings.showFrequent ? 1 : 0, settings.bgUrl || null, settings.simpleMode ? 1 : 0, settings.openInNewTab ? 1 : 0, settings.themeMode || 'auto', userId));
    }

    await env.DB.batch(queries);

    // 2. 更新 KV 缓存 (压缩存储)
    newData.lastUpdated = formatCNTime(new Date());
    await env.nav.put(kvKey, JSON.stringify(newData));
    
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "POST_ERROR", message: err.toString() }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await getAuthContext(request, env);
  
  if (auth.userId === "guest" || auth.userId === "expired") {
    return new Response(JSON.stringify({ 
      error: "Unauthorized", 
      code: auth.userId === "expired" ? "ERR_JWT_EXPIRED" : "ERR_UNAUTHORIZED" 
    }), { status: 401 });
  }

  const userId = auth.userId;
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