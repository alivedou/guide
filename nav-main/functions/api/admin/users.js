async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, data, request } = context;
  const user = data.user;
  
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';
  
  // 权限已经在 _middleware.js 校验过，这里只需处理业务逻辑
  try {
    let query = 'SELECT id, uid, username, role, status, last_login, created_at FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    let params = [];

    if (keyword) {
      const kw = `%${keyword}%`;
      query += ' AND (username LIKE ? OR uid LIKE ?)';
      countQuery += ' AND (username LIKE ? OR uid LIKE ?)';
      params.push(kw, kw);
    }

    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const totalRow = await env.DB.prepare(countQuery).bind(...params).first();
    const total = totalRow ? totalRow.total : 0;

    // 获取当前管理员总数 (Task AC.3)
    const adminCountRow = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first();
    const adminCount = adminCountRow ? adminCountRow.count : 0;

    // 分页查询
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const finalParams = [...params, pageSize, (page - 1) * pageSize];
    
    const users = await env.DB.prepare(query).bind(...finalParams).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      users: users.results,
      adminCount,
      pagination: {
        total,
        page,
        pageSize
      }
    }), {
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
    const { userId, status, role, newPassword, adminPassword } = await request.json();
    if (!userId) throw new Error("Missing userId");

    // Task UM.8.2 & Task 3.1: 强制敏感操作进行二次身份验证
    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "此操作属于敏感操作，请输入管理员密码验证" }), { status: 400 });
    }

    const adminUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(admin.id).first();
    const adminHash = await sha256(adminPassword);
    if (adminUser.password_hash !== adminHash) {
      return new Response(JSON.stringify({ error: "管理员身份验证失败，请检查密码" }), { status: 401 });
    }

    // 1. 更新用户状态
    if (status) {
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, request.headers.get("cf-connecting-ip") || "unknown")
        .run();
    }

    // 2. 重置用户密码 (Task UM.8.2)
    if (newPassword) {
      const newHash = await sha256(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'RESET_PASSWORD', `Force reset password for user ${userId}`, request.headers.get("cf-connecting-ip") || "unknown")
        .run();
    }

    // 3. 更新用户角色 (Task UM.8.1 & Task AC.1)
    if (role) {
      // Root 身份识别 (约定 ID=1 为 Root)
      const isRoot = (admin.id === '1' || admin.uid === 10001);

      if (role === 'admin') {
        if (!isRoot) {
          return new Response(JSON.stringify({ error: "权限不足：只有首席管理员可以提拔新的 Admin" }), { status: 403 });
        }
        
        // 校验管理员上限 (Task AC.1)
        const MAX_ADMIN_COUNT = 5;
        const currentAdmins = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').bind('admin').first();
        const targetUser = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
        
        if (currentAdmins.count >= MAX_ADMIN_COUNT && targetUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: `系统安全策略：管理员名额已满 (上限 ${MAX_ADMIN_COUNT} 人)，请先撤销已有管理员` }), { status: 403 });
        }
      }

      // 权限等级逻辑
      if (admin.role === 'admin') {
         // Admin/Root 可以修改其他人的角色
      } else if (admin.role === 'super_user') {
         return new Response(JSON.stringify({ error: "权限不足：超级用户无权修改用户角色" }), { status: 403 });
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

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const admin = data.user;

  try {
    const { userId, adminPassword } = await request.json();
    if (!userId) throw new Error("Missing userId");

    // Task UM.8.2: 强制删除操作进行二次验证
    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "删除操作非常危险，请输入管理员密码验证" }), { status: 400 });
    }

    const adminUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(admin.id).first();
    const adminHash = await sha256(adminPassword);
    if (adminUser.password_hash !== adminHash) {
      return new Response(JSON.stringify({ error: "管理员身份验证失败，请检查密码" }), { status: 401 });
    }

    // 执行删除 (级联删除会自动处理其他表)
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    
    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'DELETE_USER', `Deleted user account ${userId}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
