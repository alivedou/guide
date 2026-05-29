export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 获取已发布且未过期、未归档的公告
    // 增强版 SQL：使用 replace 移除 ISO 时间中的 T 分隔符，确保 datetime 函数比较准确
    const list = await env.DB.prepare(`
      SELECT id, title, content, type, is_top, created_at 
      FROM announcements 
      WHERE status = 'published' 
      AND (expire_at IS NULL OR datetime(replace(expire_at, 'T', ' ')) > datetime('now')) 
      ORDER BY is_top DESC, created_at DESC 
      LIMIT 5
    `).all();
    
    // Task 6.6: 获取最后更新版本号
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
