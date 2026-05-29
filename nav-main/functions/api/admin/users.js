async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, data } = context;
  const user = data.user;
  
  // 权限已经在 _middleware.js 校验过，这里只需处理业务逻辑
  try {
    const users = await env.DB.prepare('SELECT id, uid, username, role, status, last_login, created_at FROM users ORDER BY created_at DESC').all();
    return new Response(JSON.stringify({ success: true, users: users.results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPatch(context) {
  const { request, env, data } = context;
  const admin = data.user;
  
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
      // 权限等级逻辑：admin 权限最高，super_user 次之
      // admin 可以修改任何人；super_user 只能修改普通 user
      if (admin.role === 'admin') {
         // admin 无限权限，但防止降级最后一个 admin (可选逻辑，此处先保证能操作)
      } else if (admin.role === 'super_user') {
         // super_user 只能修改普通用户的状态，不能提拔他人为 admin 或修改其他 super_user
         if (role !== 'user') {
            return new Response(JSON.stringify({ error: "权限不足：super_user 只能管理普通用户" }), { status: 403 });
         }
      } else {
         return new Response(JSON.stringify({ error: "权限不足" }), { status: 403 });
      }
      
      // 防止降级自己 (如果是 admin)
      if (userId === admin.id && admin.role === 'admin' && role !== 'admin') {
         return new Response(JSON.stringify({ error: "管理员不能降级自己" }), { status: 403 });
      }

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
