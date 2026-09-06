/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, data, request } = context;
  const user = data.user;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';

  // 权限已经在 _middleware.js 校验过，这里只需处理业务逻辑
  try {
    let query = 'SELECT u.id, u.uid, u.username, u.role, u.status, u.last_login, u.created_at, u.email, u.telegram_chat_id, s.is_alert_receiver, s.is_digest_receiver FROM users u LEFT JOIN user_settings s ON u.id = s.user_id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    let params = [];

    if (keyword) {
      const kw = `%${keyword}%`;
      query += ' AND (u.username LIKE ? OR u.uid LIKE ?)';
      countQuery += ' AND (username LIKE ? OR uid LIKE ?)';
      params.push(kw, kw);
    }

    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const totalRow = await env.DB.prepare(countQuery).bind(...params).first();
    const total = totalRow ? totalRow.total : 0;

    // 获取当前管理员总数
    const adminCountRow = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first();
    const adminCount = adminCountRow ? adminCountRow.count : 0;

    // 分页查询
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    const finalParams = [...params, pageSize, (page - 1) * pageSize];

    const users = await env.DB.prepare(query).bind(...finalParams).all();

    return new Response(JSON.stringify({
      success: true,
      users: users.results,
      adminCount,
      pagination: {
        total,
        page,
        pageSize
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPatch(context) {
  const { request, env, data } = context;
  const admin = data.user;

  try {
    const { userId, status, role, newPassword, adminPassword, isAlertReceiver, isDigestReceiver } = await request.json();
    if (!userId) throw new Error("Missing userId");

    // 强制敏感操作进行二次身份验证
    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "此操作属于敏感操作，请输入管理员密码验证" }), { status: 400 });
    }

    const adminUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(admin.id).first();
    const adminHash = await sha256(adminPassword);
    if (adminUser.password_hash !== adminHash) {
      return new Response(JSON.stringify({ error: "管理员身份验证失败，请检查密码" }), { status: 401 });
    }

    // 4. 更新通知授权设置 (采用 SQLite UPSERT 强力防静默越权与无记录静默更新失败问题)
    if (isAlertReceiver !== undefined) {
      await env.DB.prepare(`
        INSERT INTO user_settings (user_id, is_alert_receiver)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET is_alert_receiver = excluded.is_alert_receiver
      `).bind(userId, isAlertReceiver ? 1 : 0).run();
    }
    if (isDigestReceiver !== undefined) {
      await env.DB.prepare(`
        INSERT INTO user_settings (user_id, is_digest_receiver)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET is_digest_receiver = excluded.is_digest_receiver
      `).bind(userId, isDigestReceiver ? 1 : 0).run();
    }

    // 1. 更新用户状态
    if (status) {
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, '[Protected]')
        .run();
    }

    // 2. 重置用户密码 - 临时密码安全增强
    if (newPassword) {
      const newHash = await sha256(newPassword);

      // 计算临时密码过期时间 (30分钟后)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await env.DB.prepare('UPDATE users SET temp_password_hash = ?, temp_password_expires_at = ?, is_temp_password_active = 1 WHERE id = ?')
        .bind(newHash, expiresAt, userId).run();

      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'RESET_TEMP_PASSWORD', `Generated temporary password for user ${userId}, expires at ${expiresAt}`, '[Protected]')
        .run();
    }

    // 3. 更新用户角色 )
    if (role) {
      // Root 身份识别 (约定 ID=1 为 Root)
      const isRoot = (admin.id === '1' || admin.uid === 10001);

      if (role === 'admin') {
        if (!isRoot) {
          return new Response(JSON.stringify({ error: "权限不足：只有首席管理员可以提拔新的 Admin" }), { status: 403 });
        }

        // 校验管理员上限
        const MAX_ADMIN_COUNT = 5;
        const currentAdmins = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').bind('admin').first();
        const targetUser = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();

        if (currentAdmins.count >= MAX_ADMIN_COUNT && targetUser.role !== 'admin') {
          return new Response(JSON.stringify({ error: `系统安全策略：管理员名额已满 (上限 ${MAX_ADMIN_COUNT} 人)，请先撤销已有管理员` }), { status: 403 });
        }
      }

      // 权限等级逻辑
      if (admin.role === 'admin') {
         // Admin/Root 可以修改其他人的角色
      } else if (admin.role === 'super_user') {
         return new Response(JSON.stringify({ error: "权限不足：超级用户无权修改用户角色" }), { status: 403 });
      } else {
         return new Response(JSON.stringify({ error: "权限不足" }), { status: 403 });
      }

      // 防止降级自己 (如果是 admin)
      if (userId === admin.id && admin.role === 'admin' && role !== 'admin') {
         return new Response(JSON.stringify({ error: "管理员不能降级自己" }), { status: 403 });
      }

      await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
      await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
        .bind(admin.id, 'CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, '[Protected]')
        .run();
    }

    // 高危操作即时告警判定
    const configStr = await env.nav.get("system:site_config");
    const config = configStr ? JSON.parse(configStr) : {};
    if (config.enableAdminInstantAlert) {
      if (status) {
        context.waitUntil(dispatchInstantAdminAlert('CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, admin, '[Protected]', env));
      }
      if (newPassword) {
        context.waitUntil(dispatchInstantAdminAlert('RESET_TEMP_PASSWORD', `Generated temporary password for user ${userId}, expires in 30 minutes`, admin, '[Protected]', env));
      }
      if (role) {
        context.waitUntil(dispatchInstantAdminAlert('CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, admin, '[Protected]', env));
      }
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const admin = data.user;

  try {
    const { userId, adminPassword } = await request.json();
    if (!userId) throw new Error("Missing userId");

    // 强制删除操作进行二次验证
    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "删除操作非常危险，请输入管理员密码验证" }), { status: 400 });
    }

    const adminUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(admin.id).first();
    const adminHash = await sha256(adminPassword);
    if (adminUser.password_hash !== adminHash) {
      return new Response(JSON.stringify({ error: "管理员身份验证失败，请检查密码" }), { status: 401 });
    }

    // 执行 D1 全关联地毯式提前清理，阻断任何外键冲突 (FOREIGN KEY constraint failed) 并彻底销账
    // 1. 彻底删除该用户占用的邀请码，防止随着账号删除而“复活”导致重复注册
    await env.DB.prepare('DELETE FROM invitation_codes WHERE used_by = ?').bind(userId).run();

    // 2. 删除该管理员生成的邀请码
    await env.DB.prepare('DELETE FROM invitation_codes WHERE creator_id = ?').bind(userId).run();

    // 3. 提前删除其主表下的所有子表业务行
    await env.DB.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM announcement_read_states WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM audit_logs WHERE user_id = ?').bind(userId).run();

    // 4. 从 Workers KV 中物理擦除该用户的配置缓存，绝不留一丝脏数据
    await env.nav.delete(`user_config:${userId}`);

    // 5. 最终一击：安全删除 users 核心行
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    // 记录审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'DELETE_USER', `Deleted user account ${userId}`, '[Protected]')
      .run();

    // 高危操作即时告警判定
    const configStr = await env.nav.get("system:site_config");
    const config = configStr ? JSON.parse(configStr) : {};
    if (config.enableAdminInstantAlert) {
      context.waitUntil(dispatchInstantAdminAlert('DELETE_USER', `Deleted user account ${userId}`, admin, '[Protected]', env));
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

async function dispatchInstantAdminAlert(action, details, admin, ip, env) {
  const subject = `【CloudNav 安全警报】管理员执行了业务级高危敏感操作`;
  const text = `🚨 系统安全警报：管理员于后台执行了业务级高危敏感操作！\n\n` +
               `👤 执行管理员: ${admin.username || '未知 (ID: ' + admin.id + ')'}\n` +
               `🎬 操作行为: ${action}\n` +
               `📝 详情细节: ${details}\n` +
               `🌐 来源 IP: ${ip}\n` +
               `🕒 发生时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} (北京时间)\n\n` +
               `此消息为实时安全警报，仅派发至授权紧急告警的账户。`;

  if (env.TELEGRAM_BOT_TOKEN) {
    try {
      const receivers = await env.DB.prepare(`
        SELECT u.telegram_chat_id
        FROM users u
        JOIN user_settings s ON u.id = s.user_id
        WHERE s.is_alert_receiver = 1 AND u.telegram_chat_id IS NOT NULL
      `).all();

      if (receivers.results && receivers.results.length > 0) {
        const htmlContent = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        for (const r of receivers.results) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: r.telegram_chat_id,
              text: `🚨 <b>${subject}</b>\n\n${htmlContent}`,
              parse_mode: 'HTML'
            })
          }).catch(e => console.error('[TG Instant Alert] failed for', r.telegram_chat_id, e));
        }
      }
      if (env.TELEGRAM_CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `🚨 <b>${subject}</b>\n\n${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`,
            parse_mode: 'HTML'
          })
        }).catch(e => console.error('[TG Global Instant Alert] failed', e));
      }
    } catch (e) {
      console.error('[TG Alert] Send failed:', e);
    }
  }

  if (env.RESEND_API_KEY) {
    try {
      const receivers = await env.DB.prepare(`
        SELECT u.email
        FROM users u
        JOIN user_settings s ON u.id = s.user_id
        WHERE s.is_alert_receiver = 1 AND u.email IS NOT NULL
      `).all();

      if (receivers.results && receivers.results.length > 0) {
        for (const r of receivers.results) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM || 'CloudNav Alerts <alerts@cloudnav.tech>',
              to: r.email,
              subject: subject,
              text: text
            })
          }).catch(e => console.error('[Email Instant Alert] failed for', r.email, e));
        }
      }
    } catch (e) {
      console.error('[Email Alert] Send failed:', e);
    }
  }
}
