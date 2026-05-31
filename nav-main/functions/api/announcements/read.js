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
