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

    const user = await env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
      .bind(username, passwordHash)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401 });
    }

    if (user.status === 'frozen') {
      return new Response(JSON.stringify({ error: "账号已被封禁" }), { status: 403 });
    }

    // 这里为了演示方便使用简单的 token 逻辑
    // 实际生产环境建议使用 JWT (可以通过 jose 等库实现)
    const token = btoa(`${user.id}:${Date.now()}`); 

    return new Response(JSON.stringify({
      success: true,
      token: token,
      user: { id: user.id, username: user.username, role: user.role }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器错误", details: e.message }), { status: 500 });
  }
}
