import * as jose from 'jose';

/**
 * 登录接口 (D1)
 */
async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();
    const passwordHash = await sha256(password);

    // 查询用户信息及其设置（关联查询确保角色和状态准确）
    const user = await env.DB.prepare('SELECT id, username, role, status FROM users WHERE username = ? AND password_hash = ?')
      .bind(username, passwordHash)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401 });
    }

    if (user.status === 'frozen') {
      return new Response(JSON.stringify({ error: "您的账号已被封禁，请联系管理员" }), { status: 403 });
    }

    // 更新最后登录时间
    await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    // 生成 Token (Task 2.6.1: 迁移至 JWT)
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
    const token = await new jose.SignJWT({ 
        id: user.id, 
        username: user.username, 
        role: user.role 
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);

    return new Response(JSON.stringify({
      success: true,
      token: token,
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器内部错误", details: e.message }), { status: 500 });
  }
}
