/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * share.js - 主页公开分享 API (免登录只读)
 * 路由: /api/share?slug=xxx
 * ==========================================
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400 });
  }

  try {
    // 1. 从 D1 数据库查询 slug 对应的分享配置并校验
    const settings = await env.DB.prepare(`
      SELECT user_id, is_shared, share_slug 
      FROM user_settings 
      WHERE share_slug = ? AND is_shared = 1
    `).bind(slug).first();

    if (!settings) {
      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "该分享主页未开启或不存在" }), { status: 404 });
    }

    const userId = settings.user_id;

    // 2. 从 Workers KV 获取用户的导航配置
    const kvKey = `user_config:${userId}`;
    const dataStr = await env.nav.get(kvKey);
    
    if (!dataStr) {
      return new Response(JSON.stringify({ error: "EMPTY_DATA", message: "该用户尚未同步任何导航数据" }), { status: 404 });
    }

    const dataObj = JSON.parse(dataStr);

    // 3. 严格的安全过滤脱敏，防止隐藏内容与个人隐私泄漏
    dataObj.categories = (dataObj.categories || []).filter(c => !c.hidden);
    dataObj.items = (dataObj.items || []).filter(i => !i.hidden);

    // 过滤出公开分享用户的信息
    const owner = await env.DB.prepare('SELECT username, uid FROM users WHERE id = ?').bind(userId).first();

    // 强制设置只读与分享上下文
    return new Response(JSON.stringify({
      categories: dataObj.categories,
      items: dataObj.items,
      settings: dataObj.settings || {},
      isReadOnlyShare: true,
      shareOwner: owner ? owner.username : "Nav User",
      shareUid: owner ? owner.uid : null,
      shareSlug: slug
    }), {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: err.message }), { status: 500 });
  }
}
