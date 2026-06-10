/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

import * as jose from 'jose';

export async function onRequestGet(context) {
  const { env } = context;
  const configStr = await env.nav.get("system:site_config");
  const config = configStr ? JSON.parse(configStr) : {
    siteTitle: "CloudNav 导航",
    faviconUrl: "/favicon.ico",
    seoKeywords: "导航, 自定义, 云端存储",
    seoDescription: "极致简洁的个人自定义导航网站",
    superUserInviteQuota: 10
  };
  // 确保旧配置也能返回默认值
  if (config && config.superUserInviteQuota === undefined) {
    config.superUserInviteQuota = 10;
  }
  return new Response(JSON.stringify(config), { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const admin = data.user;
  
  // Task 17.4: 严格校验 admin 权限，super_user 不可修改系统参数
  if (admin.role !== 'admin') {
    return new Response(JSON.stringify({ error: "Forbidden", message: "仅系统管理员可修改全站参数" }), { status: 403 });
  }

  try {
    const config = await request.json();
    await env.nav.put("system:site_config", JSON.stringify(config));
    
    // 审计日志
    await env.DB.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
      .bind(admin.id, 'UPDATE_SITE_CONFIG', JSON.stringify(config), '[Protected]')
      .run();

    // 即时高危告警 (Task N.5)
    if (config.enableAdminInstantAlert) {
      context.waitUntil(dispatchInstantAdminAlert('UPDATE_SITE_CONFIG', JSON.stringify(config), admin, '[Protected]', env));
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
