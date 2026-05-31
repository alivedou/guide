
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
    const { title, content, type, is_top, expire_at, status } = await request.json();
    await env.DB.prepare('INSERT INTO announcements (creator_id, title, content, type, is_top, expire_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(admin.id, title, content, type, is_top ? 1 : 0, expire_at || null, status || 'published')
      .run();

    // Task 6.6: 更新全局公告版本号 (KV)
    await env.nav.put('announcements_last_update', Date.now().toString());

    // 记录审计日志
    const typeLabel = type === 'important' ? '横幅通知' : '静默通知';
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'CREATE_ANNOUNCEMENT', `Created announcement: [${typeLabel}] ${title}`, request.headers.get("cf-connecting-ip") || "unknown")
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
    const payload = await request.json();
    const { id } = payload;
    if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });

    const targetId = Number(id);
    const updates = [];
    const params = [];
    
    if (payload.title !== undefined) {
        updates.push('title = ?');
        params.push(payload.title);
    }
    if (payload.content !== undefined) {
        updates.push('content = ?');
        params.push(payload.content);
    }
    if (payload.type !== undefined) {
        updates.push('type = ?');
        params.push(payload.type);
    }
    if (payload.is_top !== undefined) {
        updates.push('is_top = ?');
        params.push(payload.is_top ? 1 : 0);
    }
    if (payload.expire_at !== undefined) {
        updates.push('expire_at = ?');
        params.push((payload.expire_at && payload.expire_at.trim() !== '') ? payload.expire_at : null);
    }
    if (payload.status !== undefined) {
        updates.push('status = ?');
        params.push(payload.status);
    }

    if (updates.length === 0) {
        return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400 });
    }

    params.push(targetId);
    const sql = `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`;

    const result = await env.DB.prepare(sql)
      .bind(...params)
      .run();

    if (!result.success) {
        return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500 });
    }

    // Task 6.6: 更新全局公告版本号 (KV)
    await env.nav.put('announcements_last_update', Date.now().toString());

    // 记录审计日志
    const typeLabel = payload.type !== undefined ? (payload.type === 'important' ? '横幅通知' : '静默通知') : '';
    const detailsExtra = typeLabel ? `, Type: ${typeLabel}` : '';
    const statusExtra = payload.status !== undefined ? `, Status: ${payload.status}` : '';
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'UPDATE_ANNOUNCEMENT', `Updated announcement ID: ${id}${detailsExtra}${statusExtra}`, request.headers.get("cf-connecting-ip") || "unknown")
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

    const targetId = Number(id);

    // 权限检查
    if (admin.role !== 'admin') {
      const target = await env.DB.prepare('SELECT creator_id FROM announcements WHERE id = ?').bind(targetId).first();
      if (!target || target.creator_id !== admin.id) {
        return new Response(JSON.stringify({ error: "权限不足：您只能删除自己发布的公告" }), { status: 403 });
      }
    }

    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(targetId).run();

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
