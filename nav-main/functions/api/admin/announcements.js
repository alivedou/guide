
export async function onRequestGet(context) {
  const { env, request } = context;
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';

  try {
    let query = 'SELECT a.*, u.username as creator_name FROM announcements a LEFT JOIN users u ON a.creator_id = u.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM announcements WHERE 1=1';
    let params = [];

    if (keyword) {
      const kw = `%${keyword}%`;
      query += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      countQuery += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(kw, kw);
    }

    if (status) {
      query += ' AND a.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND a.type = ?';
      countQuery += ' AND type = ?';
      params.push(type);
    }

    // 获取总数
    const totalRow = await env.DB.prepare(countQuery).bind(...params).first();
    const total = totalRow ? totalRow.total : 0;

    // 排序与分页 (置顶优先)
    query += ' ORDER BY a.is_top DESC, a.created_at DESC LIMIT ? OFFSET ?';
    const finalParams = [...params, pageSize, (page - 1) * pageSize];

    const { results } = await env.DB.prepare(query).bind(...finalParams).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      announcements: results,
      pagination: { total, page, pageSize }
    }), {
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
  const { request, env, data } = context;
  const admin = data.user;
  
  // 管理员可删所有，超级用户只能删自己创建的
  try {
    const { id } = await request.json();
    if (!id) throw new Error("Missing ID");

    // 权限检查
    if (admin.role !== 'admin') {
      const target = await env.DB.prepare('SELECT creator_id FROM announcements WHERE id = ?').bind(id).first();
      if (!target || target.creator_id !== admin.id) {
        return new Response(JSON.stringify({ error: "权限不足：您只能删除自己发布的公告" }), { status: 403 });
      }
    }

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
