/**
 * ==========================================
 * cron-digest.js - 定时审计日报与安全通知
 * 路由: /api/admin/cron-digest
 * 支持 Cloudflare Cron scheduled 触发器或受信任的安全调用
 * ==========================================
 */

async function sendEmailHelper(recipient, subject, content, env) {
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'CloudNav Alerts <alerts@cloudnav.tech>',
          to: recipient,
          subject: subject,
          text: content
        })
      });
    } catch (e) {
      console.error('[Email] Resend send failed:', e);
    }
  } else {
    console.log(`[Email Mock] Target: ${recipient} | Subject: ${subject} | Content length: ${content.length}`);
  }
}

async function sendTelegramHelper(subject, content, env) {
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `📢 <b>${subject}</b>\n\n${content}`,
          parse_mode: 'HTML'
        })
      });
    } catch (e) {
      console.error('[TG] Telegram send failed:', e);
    }
  }
}

export async function onRequest(context) {
  const { request, env, data } = context;
  
  // 1. 安全阻断校验：允许管理员会话直接调用，或者由 Cron Trigger 带密钥 x-cron-secret 触发
  const authUser = data.user;
  const cronSecretHeader = request.headers.get("x-cron-secret");
  
  const isAuthorizedAdmin = (authUser && (authUser.role === "admin" || authUser.role === "super_user"));
  const isAuthorizedCron = (env.CRON_SECRET && cronSecretHeader === env.CRON_SECRET);

  if (!isAuthorizedAdmin && !isAuthorizedCron) {
    return new Response(JSON.stringify({ error: "Forbidden", message: "您无权手动触发此定时任务" }), { status: 403 });
  }

  try {
    // 2. 查询 24 小时内增量审计日志
    const logs = await env.DB.prepare(`
      SELECT l.id, u.username, l.action, l.details, l.ip, l.created_at 
      FROM audit_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE l.created_at >= datetime('now', '-1 day') 
      ORDER BY l.created_at DESC
    `).all();

    const logList = logs.results || [];
    if (logList.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "过去 24 小时内无任何高危审计日志，不发送空日报" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. 格式化增量报告 Markdown / HTML
    const reportSubject = `【CloudNav 每日审计日报】增量管理日志摘要`;
    let reportText = `您好，这是过去 24 小时内生成的系统审计日志增量汇总：\n\n`;
    reportText += `📅 统计时间范围: ${new Date(Date.now() - 24 * 3600 * 1000).toLocaleString('zh-CN')} 至 ${new Date().toLocaleString('zh-CN')}\n`;
    reportText += `📊 日志条数: ${logList.length} 条\n`;
    reportText += `----------------------------------------\n\n`;

    logList.forEach((log, index) => {
      reportText += `[${index + 1}] 操作行为: ${log.action}\n`;
      reportText += `    👤 操作用户: ${log.username || '未知 (ID: ' + log.user_id + ')'}\n`;
      reportText += `    🌐 来源 IP: ${log.ip || 'unknown'}\n`;
      reportText += `    🕒 操作时间: ${log.created_at} (UTC)\n`;
      reportText += `    📝 详情细节: ${log.details || ''}\n\n`;
    });

    reportText += `----------------------------------------\n本邮件由 Cloudflare Pages 定时触发器自动发送，请勿直接回复。`;

    // 4. 并发调度发送给所有授权接收的管理员邮箱和个人 TG
    const receivers = await env.DB.prepare(`
      SELECT u.email, u.telegram_chat_id 
      FROM users u 
      JOIN user_settings s ON u.id = s.user_id 
      WHERE s.is_digest_receiver = 1
    `).all();

    const receiverList = receivers.results || [];
    const dispatchPromises = [];

    // 发送 Email (如果有绑定邮箱)
    receiverList.forEach(r => {
      if (r.email) {
        dispatchPromises.push(sendEmailHelper(r.email, reportSubject, reportText, env));
      }
    });

    // 发送个人 Telegram Bot 消息 (如果有绑定 Telegram Chat ID)
    if (env.TELEGRAM_BOT_TOKEN) {
      const htmlContent = reportText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      receiverList.forEach(r => {
        if (r.telegram_chat_id) {
          // 动态利用全局的 Bot Token 发送给每个管理员个人私信
          dispatchPromises.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: r.telegram_chat_id,
              text: `📢 <b>${reportSubject}</b>\n\n${htmlContent}`,
              parse_mode: 'HTML'
            })
          }).catch(e => console.error('[TG Admin Digest] failed for', r.telegram_chat_id, e)));
        }
      });
    }

    // 同时也支持全局 Telegram 备份频道 (如果配置了全局 Chat ID)
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const htmlContent = reportText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      dispatchPromises.push(sendTelegramHelper(reportSubject, htmlContent, env));
    }

    if (dispatchPromises.length > 0) {
      context.waitUntil(Promise.all(dispatchPromises));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `每日审计日报打包成功！已派发至 ${receiverList.length} 个授权接收者。` 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
