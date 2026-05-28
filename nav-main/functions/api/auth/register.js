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

    // 写入 D1
    await env.DB.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
      .bind(uuid, username, passwordHash)
      .run();

    // 初始化 KV 数据
    if (env.nav) {
      await env.nav.put(`user_config:${uuid}`, JSON.stringify(defaultData));
    }

    return new Response(JSON.stringify({ success: true, message: "注册成功" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "User already exists or DB error", details: e.message }), { status: 400 });
  }
}
