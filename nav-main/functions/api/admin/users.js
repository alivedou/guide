import * as jose from 'jose';

async function getAuthContext(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { role: 'guest' };
  
  try {
    const token = authHeader.split(" ")[1];
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (e) {
    return { role: 'guest' };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getAuthContext(request, env);
  
  if (user.role !== 'admin' && user.role !== 'super_user') {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const users = await env.DB.prepare('SELECT id, username, role, status, last_login, created_at FROM users ORDER BY created_at DESC').all();
    return new Response(JSON.stringify({ success: true, users: users.results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await getAuthContext(request, env);
  
  if (admin.role !== 'admin') {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { userId, status } = await request.json();
    if (!userId || !status) throw new Error("Missing parameters");

    // 更新用户状态
    await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();

    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
