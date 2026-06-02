/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

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
  const rawIp = request.headers.get("cf-connecting-ip") || "unknown";
  const hashedIp = await sha256(rawIp);
  const lockKey = `login_fail:${hashedIp}`;

  try {
    // 0. 检查熔断状态 (Task 6.4)
    const failData = await env.nav.get(lockKey, { type: "json" });
    if (failData && failData.count >= 5 && Date.now() < failData.lockUntil) {
      const waitMin = Math.ceil((failData.lockUntil - Date.now()) / 60000);
      return new Response(JSON.stringify({ error: `登录尝试过多，请在 ${waitMin} 分钟后再试` }), { status: 429 });
    }

    const { username, password } = await request.json();
    const passwordHash = await sha256(password);

    // 查询用户信息
    const user = await env.DB.prepare('SELECT id, uid, username, role, status FROM users WHERE username = ? AND password_hash = ?')
      .bind(username, passwordHash)
      .first();

    if (!user) {
      // 记录失败次数
      const count = (failData?.count || 0) + 1;
      const newFailData = { 
        count, 
        lockUntil: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0 
      };
      await env.nav.put(lockKey, JSON.stringify(newFailData), { expirationTtl: 3600 });
      return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401 });
    }

    if (user.status === 'frozen') {
      return new Response(JSON.stringify({ error: "您的账号已被封禁，请联系管理员" }), { status: 403 });
    }

    // 登录成功，清除失败记录
    await env.nav.delete(lockKey);

    // 更新最后登录时间
    await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    // 生成 Token (Task 2.6.1: 迁移至 JWT)
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
    const token = await new jose.SignJWT({ 
        id: user.id, 
        uid: user.uid,
        username: user.username, 
        role: user.role 
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Task 4.3: 设置 7 天有效期
    .sign(secret);

    return new Response(JSON.stringify({
      success: true,
      token: token,
      user: { 
        id: user.id, 
        uid: user.uid,
        username: user.username, 
        role: user.role 
      }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器内部错误", details: e.message }), { status: 500 });
  }
}
