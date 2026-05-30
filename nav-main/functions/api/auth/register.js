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
    const { username, password, inviteCode } = await request.json();
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 0. 获取全局注册策略
    const configStr = await env.nav.get("system:site_config");
    const config = configStr ? JSON.parse(configStr) : { allowOpenRegistration: true, requireInvitation: false };

    const passwordHash = await sha256(password);
    const uuid = crypto.randomUUID();

    // 1. 检查是否为首位用户并获取最大 UID
    const stats = await env.DB.prepare('SELECT COUNT(*) as count, MAX(uid) as maxUid FROM users').first();
    const isFirstUser = (stats.count === 0);
    const role = isFirstUser ? 'admin' : 'user';
    const nextUid = isFirstUser ? 10001 : (stats.maxUid || 10000) + 1;

    // 2. 策略拦截 (非首位用户才拦截)
    if (!isFirstUser) {
      if (config.requireInvitation) {
        if (!inviteCode) return new Response(JSON.stringify({ error: "请提供邀请码" }), { status: 403 });
        
        const invite = await env.DB.prepare('SELECT status FROM invitation_codes WHERE code = ? AND status = "unused"').bind(inviteCode).first();
        if (!invite) return new Response(JSON.stringify({ error: "无效或已被使用的邀请码" }), { status: 403 });
      } else if (!config.allowOpenRegistration) {
        return new Response(JSON.stringify({ error: "系统当前暂停注册，请联系管理员" }), { status: 403 });
      }
    }

    // 3. 事务级写入 D1
    const queries = [
      env.DB.prepare('INSERT INTO users (id, uid, username, password_hash, role, has_invite) VALUES (?, ?, ?, ?, ?, ?)').bind(uuid, nextUid, username, passwordHash, role, inviteCode ? 1 : 0),
      env.DB.prepare('INSERT INTO user_settings (user_id) VALUES (?)').bind(uuid)
    ];

    if (!isFirstUser && inviteCode) {
      // Task 16.5: 修正 SQL 语法，使用单引号表示字符串常量
      queries.push(env.DB.prepare("UPDATE invitation_codes SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?").bind(uuid, inviteCode));
    }

    await env.DB.batch(queries);

    // 4. 初始化数据 (D1 初始积木 + KV 缓存)
    const templateStr = await env.nav.get("system:onboarding_template");
    const onboardingData = templateStr ? JSON.parse(templateStr) : defaultData;

    const initQueries = [];
    const categories = onboardingData.categories || [];
    const items = onboardingData.items || [];
    const settings = onboardingData.settings || {};

    // 写入 D1 用户设置
    initQueries.push(env.DB.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, open_in_new_tab = ? WHERE user_id = ?')
      .bind(settings.cardWidth || 125, settings.zenMode ? 1 : 0, settings.openInNewTab ? 1 : 0, uuid));

    for (const cat of categories) {
      const newCatId = crypto.randomUUID();
      initQueries.push(env.DB.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)')
        .bind(newCatId, uuid, cat.name, cat.icon, cat.hidden ? 1 : 0));
      
      const catItems = items.filter(i => (i.catId || i.cat_id) === cat.id);
      for (const item of catItems) {
        const newItemId = crypto.randomUUID();
        initQueries.push(env.DB.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(newItemId, uuid, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0));
      }
    }

    if (initQueries.length > 0) await env.DB.batch(initQueries);

    // 5. 初始化 KV 缓存 (压缩存储)
    if (env.nav) {
      const initialKV = { 
        categories: categories.map(c => ({ ...c, id: c.id })), // 保持结构一致
        items: items.map(i => ({ ...i, catId: i.catId || i.cat_id })),
        settings: { 
          cardWidth: settings.cardWidth || 125, 
          zenMode: !!settings.zenMode, 
          openInNewTab: !!settings.openInNewTab 
        },
        user: uuid, 
        isAdmin: (role === 'admin' || role === 'super_user') 
      };
      await env.nav.put(`user_config:${uuid}`, JSON.stringify(initialKV));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: role === 'admin' ? "首位超级管理员注册成功" : "注册成功",
      role: role
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "注册失败", details: e.message }), { status: 400 });
  }
}
