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
 * 导航内容以 D1 为准，避免 KV 停留在注册默认模板。
 * ==========================================
 */

import { assembleUserNavFromD1 } from './_cf-storage.js';
import { filterHiddenNav, navSnapshotIsEmpty, sharePagePayload } from '../../shared/share-page.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400 });
  }

  try {
    const settings = await env.DB.prepare(`
      SELECT user_id, is_shared, share_slug
      FROM user_settings
      WHERE share_slug = ? AND is_shared = 1
    `).bind(slug).first();

    if (!settings) {
      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "该分享主页未开启或不存在" }), { status: 404 });
    }

    const userId = settings.user_id;
    let dataObj = await assembleUserNavFromD1(env, userId);

    if (navSnapshotIsEmpty(dataObj)) {
      const kvKey = `user_config:${userId}`;
      const dataStr = await env.nav.get(kvKey);
      if (dataStr) {
        try {
          dataObj = JSON.parse(dataStr);
        } catch {
          dataObj = { categories: [], items: [], settings: {} };
        }
      }
    }

    const publicNav = filterHiddenNav(dataObj);
    if (navSnapshotIsEmpty(publicNav)) {
      return new Response(JSON.stringify({ error: "EMPTY_DATA", message: "该用户尚未同步任何导航数据" }), { status: 404 });
    }

    const owner = await env.DB.prepare('SELECT username, uid FROM users WHERE id = ?').bind(userId).first();

    return new Response(JSON.stringify(sharePagePayload(publicNav, owner, slug)), {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: err.message }), { status: 500 });
  }
}
