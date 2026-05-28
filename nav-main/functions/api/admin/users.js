import * as jose from 'jose';

async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const { userId, status, role, adminPassword } = await request.json();
    if (!userId) throw new Error("Missing userId");

    // Task 3.1: 二次身份验证
    if (adminPassword) {
      const adminUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(admin.id).first();
      const adminHash = await sha256(adminPassword);
      if (adminUser.password_hash !== adminHash) {
        return new Response(JSON.stringify({ error: "管理员身份验证失败，请检查密码" }), { status: 401 });
      }
    }

    // 更新用户状态或角色
    if (status) {
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, request.headers.get("cf-connecting-ip") || "unknown")
        .run();
    }

    if (role) {
      if (admin.role !== 'admin') return new Response(JSON.stringify({ error: "只有超级管理员可修改角色" }), { status: 403 });
      await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, request.headers.get("cf-connecting-ip") || "unknown")
        .run();
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
