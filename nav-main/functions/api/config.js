/**
 * ==========================================
 * config.js - 后端 Serverless API 处理
 * 路由: /api/config
 * 基于 Cloudflare Pages Functions + Workers KV
 * ==========================================
 */

import { defaultData } from './defaultData.js';

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

export async function onRequest(context) {
  const { request, env } = context;

  // 解析鉴权 (支持 Bearer Token)
  const authHeader = request.headers.get("Authorization");
  let userId = "guest";
  let userRole = "guest";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = atob(token);
      userId = decoded.split(":")[0];
      // 生产环境应从数据库校验用户有效性与角色
      const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
      if (user) userRole = user.role;
    } catch (e) {
      userId = "guest";
    }
  }

  const kvKey = userId === "guest" ? "config" : `user_config:${userId}`;

  if (!env.nav) {
    return new Response(JSON.stringify({
      error: "KV_BINDING_MISSING",
      message: "后端错误：未检测到名为 'nav' 的 KV 数据库绑定。"
    }), { status: 500, headers: { "Content-Type": "application/json;charset=UTF-8" } });
  }

  const headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "no-store"
  };

  try {
    const isAdmin = (userRole === "admin" || userRole === "super_user");

    // 1. 处理恢复默认配置 (DELETE)
    if (request.method === "DELETE") {
      if (userId === "guest") return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      const resetData = getFreshDefaultData();
      await env.nav.put(kvKey, JSON.stringify(resetData));
      return new Response(JSON.stringify({ success: true, message: "已重置为默认配置" }), { headers });
    }

    // 2. 处理保存数据 (POST)
    if (request.method === "POST") {
      if (userId === "guest") return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      const newData = await request.json();

      // 4.6 资源配额限制
      if (newData.categories.length > 20) {
        return new Response(JSON.stringify({ error: "Quota exceeded", message: "分类不能超过 20 个" }), { status: 403, headers });
      }

      newData.lastUpdated = formatCNTime(new Date());
      await env.nav.put(kvKey, JSON.stringify(newData));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // 3. 处理获取数据 (GET)
    if (request.method === "GET") {
      let dataStr = await env.nav.get(kvKey);
      let dataObj = JSON.parse(dataStr || JSON.stringify(getFreshDefaultData()));

      if (userId === "guest") {
        dataObj.categories = dataObj.categories.filter(c => !c.hidden);
        dataObj.items = dataObj.items.filter(i => !i.hidden);
      }

      return new Response(JSON.stringify({
        ...dataObj,
        isAdmin,
        user: userId,
        lastUpdated: dataObj.lastUpdated || formatCNTime(new Date())
      }), { headers });
    }

      let bgUrl = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920"; 

      try {
        const cachedBingStr = await env.nav.get("bing_cache");
        const now = Date.now();
        let useCache = false;

        if (cachedBingStr) {
          const cachedBing = JSON.parse(cachedBingStr);
          if (cachedBing.url && cachedBing.expiresAt > now) {
            bgUrl = cachedBing.url;
            useCache = true;
          }
        }

        if (!useCache) {
          const bingRes = await fetch(CONFIG.bingApi, { cf: { cacheTtl: 3600 } });
          if (bingRes.ok) {
            const bingData = await bingRes.json();
            bgUrl = "https://www.bing.com" + bingData.images[0].url;
            await env.nav.put("bing_cache", JSON.stringify({
              url: bgUrl,
              expiresAt: now + 43200000
            }));
          }
        }
      } catch (e) {
        console.log("Bing 壁纸获取或缓存写入失败", e);
      }

      return new Response(JSON.stringify({ ...dataObj, bgUrl, isAdmin }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: err.toString() }), { status: 500, headers });
  }
}