/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */


export async function onRequestGet(context) {
  const { env, request } = context;
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';

  try {
    let query = `
      SELECT ic.*, u1.username as creator_name, u2.username as used_by_name 
      FROM invitation_codes ic
      LEFT JOIN users u1 ON ic.creator_id = u1.id
      LEFT JOIN users u2 ON ic.used_by = u2.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM invitation_codes WHERE 1=1';
    let params = [];

    if (keyword) {
      const kw = `%${keyword}%`;
      query += ' AND (ic.code LIKE ? OR u2.username LIKE ?)';
      countQuery += ' AND (code LIKE ?)'; // countQuery doesn't join users, keep it simple or join if needed
      params.push(kw);
      if (query.includes('u2.username')) {
        // For count, if we want to search by username, we need to join
        countQuery = `
          SELECT COUNT(*) as total FROM invitation_codes ic 
          LEFT JOIN users u2 ON ic.used_by = u2.id 
          WHERE (ic.code LIKE ? OR u2.username LIKE ?)
        `;
        params = [kw, kw];
      }
    }

    if (status) {
      query += ' AND ic.status = ?';
      countQuery = countQuery.includes('WHERE 1=1') ? countQuery + ' AND status = ?' : countQuery + ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const totalRow = await env.DB.prepare(countQuery).bind(...params).first();
    const total = totalRow ? totalRow.total : 0;

    // 分页
    query += ' ORDER BY ic.created_at DESC LIMIT ? OFFSET ?';
    const finalParams = [...params, pageSize, (page - 1) * pageSize];

    const { results } = await env.DB.prepare(query).bind(...finalParams).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      invitations: results,
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
    const { count } = await request.json();
    const batch = [];
    
    // 校验配额 (Task AC.2 & AC.4)
    if (admin.role === 'super_user') {
      const configStr = await env.nav.get("system:site_config");
      const config = configStr ? JSON.parse(configStr) : { superUserInviteQuota: 10 };
      const quota = config.superUserInviteQuota || 10;
      
      // 统计该超级用户今日已生成的数量
      const today = new Date().toISOString().split('T')[0];
      const { count: createdToday } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM invitation_codes 
        WHERE creator_id = ? AND date(created_at) = ?
      `).bind(admin.id, today).first();

      if (createdToday + (count || 1) > quota) {
        return new Response(JSON.stringify({ 
          error: "Forbidden", 
          message: `超出配额：您当日剩余可生成数量为 ${Math.max(0, quota - createdToday)} 个。当前系统设定超级用户每日限额为 ${quota} 个。` 
        }), { status: 403 });
      }
    }

    // Task 15.4: 升级为加密安全随机生成算法 (强制包含数字)
    const generateSecureCode = (length = 8) => {
      const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
      let code = "";
      while (true) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        code = Array.from(array, byte => charset[byte % charset.length]).join('');
        // 确保生成的邀请码中至少包含一个数字
        if (/[2-9]/.test(code)) break;
      }
      return code;
    };

    for (let i = 0; i < (count || 1); i++) {
      const code = generateSecureCode();
      batch.push(env.DB.prepare('INSERT INTO invitation_codes (code, creator_id) VALUES (?, ?)').bind(code, admin.id));
    }
    await env.DB.batch(batch);
    
    // 记录审计日志 (Task 6.4)
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'BATCH_GENERATE_INVITATIONS', `Generated ${count || 1} codes`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const admin = data.user;

  try {
    const { code } = await request.json();
    await env.DB.prepare('DELETE FROM invitation_codes WHERE code = ?').bind(code).run();
    
    // 记录审计日志 (Task 6.4)
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'DELETE_INVITATION', `Deleted code: ${code}`, request.headers.get("cf-connecting-ip") || "unknown")
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
