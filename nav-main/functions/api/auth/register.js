/**
 * 注册接口 (D1 + KV)
 */
import { defaultData } from '../defaultData.js';

async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1_MISSING", message: "未检测到 D1 数据库绑定" }), { status: 500 });
  }

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const passwordHash = await sha256(password);
    const uuid = crypto.randomUUID();

    // 1. 检查是否为首位用户，若是则提升为 Admin
    const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first('count');
    const role = userCount === 0 ? 'admin' : 'user';

    // 2. 事务级写入 D1 (用户表 + 初始设置表)
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
        .bind(uuid, username, passwordHash, role),
      env.DB.prepare('INSERT INTO user_settings (user_id) VALUES (?)')
        .bind(uuid)
    ]);

    // 3. 初始化 KV 数据 (作为快速缓存)
    if (env.nav) {
      const initialData = { ...defaultData, user: uuid, isAdmin: (role === 'admin') };
      await env.nav.put(`user_config:${uuid}`, JSON.stringify(initialData));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: role === 'admin' ? "首位管理员注册成功" : "注册成功",
      role: role
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "注册失败", details: e.message }), { status: 400 });
  }
}
