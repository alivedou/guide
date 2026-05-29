import * as jose from 'jose';

async function getAuthContext(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { role: 'guest' };
  try {
    const token = authHeader.split(" ")[1];
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (e) { return { role: 'guest' }; }
}

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
  const { request, env } = context;
  const admin = await getAuthContext(request, env);
  
  if (admin.role !== 'admin' && admin.role !== 'super_user') {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

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
