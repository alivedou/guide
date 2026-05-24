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
    // ==========================================
    // 核心安全优化：动态识别明文与哈希
    // ==========================================
    let expectedToken = env.TOKEN || "";
    // SHA-256 哈希值的固定长度是 64。
    // 如果长度不是 64，说明你在 Cloudflare 后台填的是“明文密码”。
    // 我们就在后端内部安全地将其转为哈希值，用来与前端发来的哈希值比对。
    if (expectedToken.length !== 64) {
      expectedToken = await sha256(expectedToken);
    }

    // 1. 处理恢复默认配置 (DELETE)
    if (request.method === "DELETE") {
      const auth = request.headers.get("Authorization");
      if (auth !== expectedToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
      const resetData = getFreshDefaultData();
      await env.nav.put("config", JSON.stringify(resetData));
      return new Response(JSON.stringify({ success: true, message: "已重置为默认配置" }), { headers });
    }

    // 2. 处理保存数据 (POST)
    if (request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== expectedToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
      const newData = await request.json();
      newData.lastUpdated = formatCNTime(new Date());
      await env.nav.put("config", JSON.stringify(newData));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // 3. 处理获取数据 (GET)
    if (request.method === "GET") {
      let dataStr = await env.nav.get("config");
      let dataObj = JSON.parse(dataStr || JSON.stringify(getFreshDefaultData()));

      const url = new URL(request.url);
      const auth = request.headers.get("Authorization") || url.searchParams.get("token");
      // 使用转换后的哈希值进行验证
      const isAdmin = (auth === expectedToken);

      if (!isAdmin) {
        dataObj.categories = dataObj.categories.filter(c => !c.hidden);
        dataObj.items = dataObj.items.filter(i => !i.hidden);
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