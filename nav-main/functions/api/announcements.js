export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 获取已发布且未归档的公告
    const list = await env.DB.prepare('SELECT id, title, content, type, is_top, created_at FROM announcements WHERE status = "published" ORDER BY is_top DESC, created_at DESC LIMIT 5').all();
    return new Response(JSON.stringify({ success: true, announcements: list.results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}
