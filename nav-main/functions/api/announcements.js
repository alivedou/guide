/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const userId = context.data.user?.id || null;

    let list;
    if (userId) {
      // 增强版 SQL：针对登录用户联合查询已读记录
      list = await env.DB.prepare(`
        SELECT a.id, a.title, a.content, a.type, a.is_top, a.created_at,
               CASE WHEN r.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
        FROM announcements a
        LEFT JOIN announcement_read_states r ON a.id = r.announcement_id AND r.user_id = ?
        WHERE a.status = 'published'
        AND (a.expire_at IS NULL OR datetime(replace(a.expire_at, 'T', ' ')) > datetime('now'))
        ORDER BY a.is_top DESC, a.created_at DESC
        LIMIT 10
      `).bind(userId).all();
    } else {
      // 游客状态：is_read 恒为 0
      list = await env.DB.prepare(`
        SELECT id, title, content, type, is_top, created_at, 0 as is_read
        FROM announcements
        WHERE status = 'published'
        AND (expire_at IS NULL OR datetime(replace(expire_at, 'T', ' ')) > datetime('now'))
        ORDER BY id DESC, is_top DESC, created_at DESC
        LIMIT 10
      `).all();
    }

    // 获取最后更新版本号
    const lastUpdate = await env.nav.get('announcements_last_update') || '0';

    return new Response(JSON.stringify({
      success: true,
      announcements: list.results,
      lastUpdate: lastUpdate
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const userId = context.data.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ success: true, message: "Guest mode, skipped server save." }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Empty IDs list." }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 批量插入已读状态 (使用 D1 prepare 加上 batch)
    const stmt = env.DB.prepare(`
      INSERT OR IGNORE INTO announcement_read_states (user_id, announcement_id)
      VALUES (?, ?)
    `);

    const batchStmts = ids.map(id => stmt.bind(userId, id));
    await env.DB.batch(batchStmts);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}
