/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * profile.js - 个人资料修改 API
 * 路由: /api/user/profile
 * 基于 Cloudflare Pages Functions + Workers KV
 * ==========================================
 */

async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, data } = context;
  const authUser = data.user;
  
  if (!authUser.id) {
    console.warn('[Profile] Auth failed: no user id in token payload');
    return new Response(JSON.stringify({ error: "Unauthorized - please login first", code: "ERR_UNAUTHORIZED" }), { status: 401 });
  }

  try {
    const user = await env.DB.prepare('SELECT id, uid, username, email, telegram_chat_id, role FROM users WHERE id = ?').bind(authUser.id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    let settings;
    try {
      settings = await env.DB.prepare('SELECT is_shared, share_slug FROM user_settings WHERE user_id = ?').bind(authUser.id).first();
    } catch (dbErr) {
      console.warn('[Profile GET] is_shared or share_slug missing. Please apply database migrations.', dbErr.message);
      settings = { is_shared: 0, share_slug: "" };
    }
    if (!settings) {
      settings = { is_shared: 0, share_slug: "" };
    }

    return new Response(JSON.stringify({
      success: true,
      uid: user.uid,
      username: user.username,
      email: user.email || '',
      telegramChatId: user.telegram_chat_id || '',
      role: user.role,
      isShared: settings.is_shared === 1,
      shareSlug: settings.share_slug || ''
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const authUser = data.user;
  
  if (!authUser.id) {
    console.warn('[Profile] Auth failed: no user id in token payload');
    return new Response(JSON.stringify({ error: "Unauthorized - please login first", code: "ERR_UNAUTHORIZED" }), { status: 401 });
  }

  try {
    const { username, email, telegramChatId, password, newPassword, isShared, shareSlug } = await request.json();
    
    // 1. 基础验证
    if (!username || !username.trim()) {
      return new Response(JSON.stringify({ error: "用户名不能为空" }), { status: 400 });
    }

    // 2. 获取原用户信息
    const user = await env.DB.prepare('SELECT password_hash, temp_password_hash, temp_password_expires_at, is_temp_password_active FROM users WHERE id = ?').bind(authUser.id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "用户不存在" }), { status: 404 });
    }

    // 3. 校验原密码 (如果修改了密码)
    if (newPassword && newPassword.trim()) {
      if (!password) {
        return new Response(JSON.stringify({ error: "修改密码需要输入原密码" }), { status: 400 });
      }
      const oldHash = await sha256(password);

      // 检查是否使用临时密码验证
      let isTempPasswordValid = false;
      if (user.temp_password_hash && (user.is_temp_password_active === 1 || user.is_temp_password_active === true || user.is_temp_password_active === '1')) {
        const expiresAt = new Date(user.temp_password_expires_at).getTime();
        const now = Date.now();
        if (expiresAt > now && user.temp_password_hash === oldHash) {
          isTempPasswordValid = true;
          console.log(`[Profile] User ${authUser.username} is using temporary password to change password`);
        }
      }

      // 验证密码（正常密码或临时密码）
      if (user.password_hash !== oldHash && !isTempPasswordValid) {
        console.log(`[Profile] Password validation failed for user ${authUser.username}`);
        return new Response(JSON.stringify({ error: "原密码验证失败", code: "ERR_PASSWORD_WRONG" }), { status: 401 });
      }
    }

    // 4. 检测用户名重名冲突
    const collide = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username.trim(), authUser.id).first();
    if (collide) {
      return new Response(JSON.stringify({ error: "用户名已被其他用户使用" }), { status: 400 });
    }

    // 5. 校验邮箱格式 (如果非空)
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return new Response(JSON.stringify({ error: "邮箱格式不正确" }), { status: 400 });
      }
    }

    // 6. 执行 D1 事务修改
    const queries = [];
    if (newPassword && newPassword.trim()) {
      const newHash = await sha256(newPassword);

      // 检查是否使用临时密码验证，如果是则清除临时密码状态
      const wasTempPasswordValid = user.temp_password_hash &&
        (user.is_temp_password_active === 1 || user.is_temp_password_active === true || user.is_temp_password_active === '1') &&
        user.temp_password_hash === oldHash;

      if (wasTempPasswordValid) {
        console.log(`[Profile] Clearing temporary password for user ${authUser.username} after password change`);
        queries.push(env.DB.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ?, password_hash = ?, temp_password_hash = NULL, temp_password_expires_at = NULL, is_temp_password_active = 0 WHERE id = ?')
          .bind(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, newHash, authUser.id));
      } else {
        queries.push(env.DB.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ?, password_hash = ? WHERE id = ?')
          .bind(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, newHash, authUser.id));
      }
    } else {
      queries.push(env.DB.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ? WHERE id = ?')
        .bind(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, authUser.id));
    }

    // 6.1 校验公开分享别名
    const cleanSlug = shareSlug ? shareSlug.trim().toLowerCase() : null;
    if (cleanSlug) {
      if (!/^[a-zA-Z0-9\-]+$/.test(cleanSlug)) {
        return new Response(JSON.stringify({ error: "个性分享别名只允许包含英文字母、数字和横线(-)" }), { status: 400 });
      }
      const duplicate = await env.DB.prepare('SELECT user_id FROM user_settings WHERE share_slug = ? AND user_id != ?').bind(cleanSlug, authUser.id).first();
      if (duplicate) {
        return new Response(JSON.stringify({ error: "该公开分享别名已被抢占，请换一个吧！" }), { status: 400 });
      }
    }

    queries.push(env.DB.prepare('UPDATE user_settings SET is_shared = ?, share_slug = ? WHERE user_id = ?')
      .bind(isShared ? 1 : 0, cleanSlug || null, authUser.id));

    try {
      await env.DB.batch(queries);
    } catch (dbBatchErr) {
      console.error('[Profile batch update failed]:', dbBatchErr.message);
      if (dbBatchErr.message.includes("no such column") || dbBatchErr.message.includes("has no column")) {
        return new Response(JSON.stringify({ 
          error: "保存失败：检测到云端 D1 数据库尚未执行最新的数据表迁移（0008_user_shares），请在控制台执行 npx wrangler d1 migrations apply cloudnav-db --remote 予以升级。" 
        }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: `数据库更新失败: ${dbBatchErr.message}` }), { status: 500 });
    }

    // 7. 同步驱逐/更新 KV 缓存中的用户名 (如果有缓存的话)
    const kvKey = `user_config:${authUser.id}`;
    let kvDataStr = await env.nav.get(kvKey);
    if (kvDataStr) {
      let kvData = JSON.parse(kvDataStr);
      kvData.username = username.trim();
      await env.nav.put(kvKey, JSON.stringify(kvData));
    }

    return new Response(JSON.stringify({ success: true, message: "个人资料修改成功" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405 });
}
