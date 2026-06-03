/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

import * as jose from 'jose';

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
  }
}

async function triggerExceptionAlert(err, request, env) {
  const subject = `【CloudNav 紧急异常告警】边缘节点未捕获严重异常`;
  const text = `🚨 系统于 Edge Network Serverless 运行时遇到了严重未捕获异常！\n\n` +
               `异常消息: ${err.message || 'Unknown Error'}\n` +
               `堆栈轨迹: ${err.stack || 'No Stack'}\n` +
               `请求路径: ${request.url}\n` +
               `触发客户端 IP: [已保护]\n` +
               `发生时间: ${new Date().toLocaleString('zh-CN')} (本地时区)\n\n` +
               `本邮件由安全网关中间件自动触发，已将事件记录审计并告警分发。`;

  // 1. 发送 Telegram Bot (并支持 TG_BOT_TOKEN 容错别名)
  const tgBotToken = env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || env.tg_bot_token || env.telegram_bot_token;
  const tgChatId = env.TELEGRAM_CHAT_ID || env.TG_CHAT_ID || env.tg_chat_id || env.telegram_chat_id;

  if (tgBotToken && tgChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: `🚨 <b>${subject}</b>\n\n${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`,
          parse_mode: 'HTML'
        })
      });
    } catch (e) {
      console.error('[TG] Failed to send Telegram alert:', e);
    }
  }

  // 2. 查询授权接收的管理员邮箱进行派发
  try {
    const receivers = await env.DB.prepare(`
      SELECT u.email 
      FROM users u 
      JOIN user_settings s ON u.id = s.user_id 
      WHERE s.is_alert_receiver = 1 AND u.email IS NOT NULL
    `).all();
    
    if (receivers.results && receivers.results.length > 0) {
      for (const r of receivers.results) {
        await sendEmailHelper(r.email, subject, text, env);
      }
    }
  } catch (e) {
    console.error('[Email] Failed to query receivers or send email:', e);
  }
}

/**
 * 权限中心中间件
 * 负责解析 JWT 并进行初步的角色检查
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  
  try {
    return await handleRequest(context);
  } catch (err) {
    // 异步执行告警，不阻塞客户端主线程，实现极限非阻塞体验 (Task N.3)
    context.waitUntil(triggerExceptionAlert(err, request, env));
    
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      message: "系统检测到边缘运行期发生未捕获严重异常。事件已安全审计并自动发送紧急告警至管理员。" 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}

async function handleRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. 设置默认用户上下文
  context.data.user = { role: 'guest', id: null };

  // 2. 排除无需验证的路径 (登录、注册、公开 API)
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/bing',
    '/api/config',
    '/api/announcements',
    '/api/share'
  ];
  
  const isPublic = publicPaths.some(p => path === p);

  // 3. 解析 Token
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
      const { payload } = await jose.jwtVerify(token, secret);
      
      // 检查用户状态
      const user = await env.DB.prepare('SELECT id, username, role, status, uid, has_invite FROM users WHERE id = ?').bind(payload.id).first();
      
      if (user) {
        if (user.status === 'frozen') {
          return new Response(JSON.stringify({ error: "Forbidden", message: "您的账号已被封禁" }), { status: 403 });
        }
        
        // 注入用户信息
        context.data.user = {
          id: user.id,
          username: user.username,
          role: user.role || 'user',
          uid: user.uid,
          hasInvite: !!user.has_invite
        };
      }
    } catch (e) {
      // Token 无效且不是公开路径，则拦截
      if (!isPublic) {
        return new Response(JSON.stringify({ error: "Unauthorized", message: "登录已过期或无效" }), { status: 401 });
      }
    }
  }

  // 4. 强制校验逻辑 (RBAC)
  
  // 管理员接口校验
  if (path.startsWith('/api/admin/')) {
    // 💡 特殊豁免 1：获取全站基本配置（如 SEO 标题/Favicon）需要对所有人公开，以便游客和搜索引擎加载
    if (path === '/api/admin/site-config' && request.method === 'GET') {
      return await next();
    }

    // 💡 特殊豁免 2：定时任务日报，若请求头或 URL 隐藏参数携带有正确的 x-cron-secret，则直接放行至业务接口
    const cronSecretHeader = request.headers.get("x-cron-secret") || url.searchParams.get("secret");
    const cronSecret = env.CRON_SECRET || env.cron_secret;
    if (path === '/api/admin/cron-digest' && cronSecret && cronSecretHeader === cronSecret) {
      return await next();
    }

    const role = context.data.user.role;
    if (role !== 'admin' && role !== 'super_user') {
      return new Response(JSON.stringify({ error: "Forbidden", message: "您没有权限执行此操作" }), { status: 403 });
    }
  }

  // 非公开路径且未登录
  if (!isPublic && !context.data.user.id && !path.startsWith('/api/auth/')) {
     // 注意：这里需要排除注册/登录等路径，已经在 isPublic 处理
     if (!isPublic) {
        // 如果不是公开路径，且没有 id，说明未登录
        return new Response(JSON.stringify({ error: "Unauthorized", message: "请先登录" }), { status: 401 });
     }
  }

  return await next();
}
