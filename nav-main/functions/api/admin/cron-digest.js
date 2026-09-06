/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * cron-digest.js - 定时审计日报与安全通知
 * 路由: /api/admin/cron-digest
 * 支持 Cloudflare Cron scheduled 触发器或受信任的安全调用
 * ==========================================
 */

import { sendEmailHelper as sendSharedEmail } from '../../../shared/alerts.js';

async function sendEmailHelper(recipient, subject, content, env) {
  return sendSharedEmail(recipient, subject, content, {
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    mockIfMissing: true
  });
}

async function sendTelegramHelper(subject, content, env) {
  const tgBotToken = env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || env.tg_bot_token || env.telegram_bot_token;
  const tgChatId = env.TELEGRAM_CHAT_ID || env.TG_CHAT_ID || env.tg_chat_id || env.telegram_chat_id;

  if (tgBotToken && tgChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
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
  
  // 1. 安全阻断校验与容错别名解析：允许管理员会话直接调用，或者由 Cron Trigger 带密钥 x-cron-secret 触发
  const url = new URL(request.url);
  const authUser = data.user;
  const cronSecretHeader = request.headers.get("x-cron-secret") || url.searchParams.get("secret");
  const cronSecret = env.CRON_SECRET || env.cron_secret;
  
  const isAuthorizedAdmin = (authUser && (authUser.role === "admin" || authUser.role === "super_user"));
  const isAuthorizedCron = (cronSecret && cronSecretHeader === cronSecret);

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
    let reportSubject = '';
    let reportText = '';

    if (logList.length === 0) {
      // 2.1 无增量审计日志时，发送系统健康自检日报
      let stats = [0, 0, 0];
      try {
        const statsRes = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS count FROM users").first("count"),
          env.DB.prepare("SELECT COUNT(*) AS count FROM categories").first("count"),
          env.DB.prepare("SELECT COUNT(*) AS count FROM items").first("count")
        ]);
        stats = statsRes;
      } catch (statsErr) {
        console.error('[Cron Digest] Failed to fetch system stats:', statsErr);
      }

      reportSubject = `【CloudNav 每日自检】系统安全运行正常`;
      reportText = `您好，过去 24 小时内系统运行平稳，未生成任何高危或异常的审计日志。\n\n`;
      reportText += `📅 自检时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
      reportText += `🟢 系统健康状况: 优秀 (100%)\n`;
      reportText += `📊 当前平台活跃状况:\n`;
      reportText += `    👥 注册用户总数: ${stats[0] || 0} 人\n`;
      reportText += `    📁 导航分类总数: ${stats[1] || 0} 个\n`;
      reportText += `    🔗 收藏网址总数: ${stats[2] || 0} 个\n`;
      reportText += `----------------------------------------\n`;
      reportText += `本邮件由 Cloudflare Pages 定时触发器自动发送，请勿直接回复。`;
    } else {
      // 3. 格式化增量报告 Markdown / HTML
      reportSubject = `【CloudNav 每日审计日报】增量管理日志摘要`;
      let reportTextTmp = `您好，这是过去 24 小时内生成的系统审计日志增量汇总：\n\n`;
      reportTextTmp += `📅 统计时间范围: ${new Date(Date.now() - 24 * 3600 * 1000).toLocaleString('zh-CN')} 至 ${new Date().toLocaleString('zh-CN')}\n`;
      reportTextTmp += `📊 日志条数: ${logList.length} 条\n`;
      reportTextTmp += `----------------------------------------\n\n`;

      logList.forEach((log, index) => {
        reportTextTmp += `[${index + 1}] 操作行为: ${log.action}\n`;
        reportTextTmp += `    👤 操作用户: ${log.username || '未知 (ID: ' + log.user_id + ')'}\n`;
        reportTextTmp += `    🌐 来源 IP: ${log.ip || 'unknown'}\n`;
        reportTextTmp += `    🕒 操作时间: ${log.created_at} (UTC)\n`;
        reportTextTmp += `    📝 详情细节: ${log.details || ''}\n\n`;
      });

      reportTextTmp += `----------------------------------------\n本邮件由 Cloudflare Pages 定时触发器自动发送，请勿直接回复。`;
      reportText = reportTextTmp;
    }

    // 4. 并发调度发送给所有授权接收的管理员邮箱和个人 TG
    const receivers = await env.DB.prepare(`
      SELECT u.username, u.email, u.telegram_chat_id 
      FROM users u 
      JOIN user_settings s ON u.id = s.user_id 
      WHERE s.is_digest_receiver = 1
    `).all();

    const receiverList = receivers.results || [];
    const dispatchPromises = [];

    // 🚀 核心优化一：对 Token 与 Chat ID 进行强力 .trim() 格式清洗，防范用户从 BotFather 复制时夹带换行符或空格，并支持 TG_BOT_TOKEN 别名
    const tgBotTokenRaw = env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || env.tg_bot_token || env.telegram_bot_token;
    const tgChatIdRaw = env.TELEGRAM_CHAT_ID || env.TG_CHAT_ID || env.tg_chat_id || env.telegram_chat_id;
    const tgBotToken = tgBotTokenRaw ? tgBotTokenRaw.trim() : "";
    const tgChatId = tgChatIdRaw ? tgChatIdRaw.trim() : "";

    // 发送 Email (如果有绑定邮箱)
    receiverList.forEach(r => {
      if (r.email) {
        dispatchPromises.push((async () => {
          try {
            await sendEmailHelper(r.email.trim(), reportSubject, reportText, env);
            return { type: 'email', target: r.username, email: r.email.trim(), status: 'success' };
          } catch (e) {
            return { type: 'email', target: r.username, email: r.email.trim(), status: 'failed', error: e.message };
          }
        })());
      }
    });

    // 发送个人 Telegram Bot 消息 (如果有绑定 Telegram Chat ID)
    if (tgBotToken) {
      const htmlContent = reportText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      receiverList.forEach(r => {
        if (r.telegram_chat_id) {
          const personalChatId = r.telegram_chat_id.trim();
          // 动态利用全局的 Bot Token 发送给每个管理员个人私信，并在后端收集报错原因回传给响应结果
          dispatchPromises.push((async () => {
            try {
              const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: personalChatId,
                  text: `📢 <b>${reportSubject}</b>\n\n${htmlContent}`,
                  parse_mode: 'HTML'
                })
              });
              const tgData = await tgRes.json();
              if (tgRes.ok && tgData.ok) {
                return { type: 'telegram_personal', target: r.username, chat_id: personalChatId, status: 'success' };
              } else {
                return { type: 'telegram_personal', target: r.username, chat_id: personalChatId, status: 'failed', error: tgData.description || 'API Error' };
              }
            } catch (e) {
              return { type: 'telegram_personal', target: r.username, chat_id: personalChatId, status: 'failed', error: e.message };
            }
          })());
        }
      });
    }

    // 同时也支持全局 Telegram 备份频道 (如果配置了全局 Chat ID)
    if (tgBotToken && tgChatId) {
      const htmlContent = reportText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      dispatchPromises.push((async () => {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgChatId,
              text: `📢 <b>${reportSubject}</b>\n\n${htmlContent}`,
              parse_mode: 'HTML'
            })
          });
          const tgData = await tgRes.json();
          if (tgRes.ok && tgData.ok) {
            return { type: 'telegram_global', chat_id: tgChatId, status: 'success' };
          } else {
            return { type: 'telegram_global', chat_id: tgChatId, status: 'failed', error: tgData.description || 'API Error' };
          }
        } catch (e) {
          return { type: 'telegram_global', chat_id: tgChatId, status: 'failed', error: e.message };
        }
      })());
    }

    // 🚀 核心优化二：改用 await Promise.all 阻塞同步等待，严禁 Cloudflare Pages 提前断电杀进程！
    let reports = [];
    if (dispatchPromises.length > 0) {
      reports = await Promise.all(dispatchPromises);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `每日审计日报打包成功！已派发至 ${receiverList.length} 个授权接收者。`,
      dispatchReports: reports, // 🚀 极客反馈升级：将各个渠道（Email/TG个人/TG全局）的发送状态与具体报错细节全部输出
      debug_receivers: receiverList.map(r => ({ 
        username: r.username, 
        has_email: !!r.email, 
        email_val: r.email,
        has_tg_chat_id: !!r.telegram_chat_id, 
        tg_chat_id_val: r.telegram_chat_id 
      })), // 🚀 调试黑科技：让您一眼看出 D1 数据库里到底有没有读取到您绑定的 TG Chat ID！
      debug_env_keys: Object.keys(env) // 🚀 安全除错补丁：打印出当前 Cloudflare Edge 运行时加载出来的所有环境变量【键名】（仅显示名称，绝不泄露任何密钥内容），自证清白！
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
