
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const list = await env.DB.prepare('SELECT * FROM announcements ORDER BY is_top DESC, created_at DESC').all();
    return new Response(JSON.stringify({ success: true, announcements: list.results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const admin = data.user;
  
  try {
    const { title, content, type, is_top, expire_at } = await request.json();
    await env.DB.prepare('INSERT INTO announcements (creator_id, title, content, type, is_top, expire_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(admin.id, title, content, type, is_top ? 1 : 0, expire_at || null, 'published')
      .run();

    // Task 6.6: 更新全局公告版本号 (KV)
    await env.nav.put('announcements_last_update', Date.now().toString());

    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'CREATE_ANNOUNCEMENT', `Created announcement: ${title}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPatch(context) {
  const { request, env, data } = context;
  const admin = data.user;
  
  try {
    const { id, title, content, type, is_top, expire_at } = await request.json();
    if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });

    const targetId = Number(id);
    const finalExpire = (expire_at && expire_at.trim() !== '') ? expire_at : null;

    const result = await env.DB.prepare('UPDATE announcements SET title = ?, content = ?, type = ?, is_top = ?, expire_at = ? WHERE id = ?')
      .bind(title, content, type, is_top ? 1 : 0, finalExpire, targetId)
      .run();

    if (!result.success) {
        return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
    }

    // Task 6.6: 更新全局公告版本号 (KV)
    await env.nav.put('announcements_last_update', Date.now().toString());

    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'UPDATE_ANNOUNCEMENT', `Updated announcement ID: ${id}, Title: ${title}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const admin = await getAuthContext(request, env);
  
  if (admin.role !== 'admin') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { id } = await request.json();
    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();

    // Task 6.6: 更新全局公告版本号 (KV)
    await env.nav.put('announcements_last_update', Date.now().toString());

    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
