
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const list = await env.DB.prepare(`
      SELECT ic.*, u1.username as creator_name, u2.username as used_by_name 
      FROM invitation_codes ic
      LEFT JOIN users u1 ON ic.creator_id = u1.id
      LEFT JOIN users u2 ON ic.used_by = u2.id
      ORDER BY ic.created_at DESC
    `).all();
    return new Response(JSON.stringify({ success: true, invitations: list.results }), {
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
