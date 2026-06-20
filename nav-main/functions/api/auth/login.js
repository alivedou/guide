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
  const DEBUG_MODE = env.DEBUG_MODE === 'true'; // 调试模式开关
  const rawIp = request.headers.get("cf-connecting-ip") || "unknown";
  const hashedIp = await sha256(rawIp);
  const lockKey = `login_fail:${hashedIp}`;

  try {
    // 0. 检查熔断状态
    const failData = await env.nav.get(lockKey, { type: "json" });
    if (failData && failData.count >= 5 && Date.now() < failData.lockUntil) {
      const waitMin = Math.ceil((failData.lockUntil - Date.now()) / 60000);
      return new Response(JSON.stringify({ error: `登录尝试过多，请在 ${waitMin} 分钟后再试` }), { status: 429 });
    }

    const { username, password, email } = await request.json();
    const passwordHash = await sha256(password);

    // 查询用户信息
    const user = await env.DB.prepare('SELECT id, uid, username, role, status, email, password_hash, temp_password_hash, temp_password_expires_at, is_temp_password_active FROM users WHERE username = ?')
      .bind(username)
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

    // 检查临时密码逻辑
    let isTempPasswordLogin = false;
    if (DEBUG_MODE) {
        console.log(`[Auth] Temp password check - user.is_temp_password_active: ${user.is_temp_password_active}, user.temp_password_hash: ${user.temp_password_hash ? 'exists' : 'null'}`);
    }

    if (user.temp_password_hash && (user.is_temp_password_active === 1 || user.is_temp_password_active === true || user.is_temp_password_active === '1')) {
      if (DEBUG_MODE) {
        console.log(`[Auth] Temp password is active, checking expiry...`);
      }
      // 检查临时密码是否过期
      const expiresAt = new Date(user.temp_password_expires_at).getTime();
      const now = Date.now();

      if (DEBUG_MODE) {
        console.log(`[Auth] Temp password expiry check - expiresAt: ${expiresAt}, now: ${now}, timeDiff: ${expiresAt - now}ms`);
      }

      if (expiresAt > now) {
        // 临时密码未过期
        if (DEBUG_MODE) {
          console.log(`[Auth] Temp password not expired, comparing hashes...`);
          console.log(`[Auth] Input hash: ${passwordHash.substring(0, 10)}..., Stored hash: ${user.temp_password_hash.substring(0, 10)}...`);
        }

        if (user.temp_password_hash === passwordHash) {
          if (DEBUG_MODE) {
            console.log(`[Auth] Temp password match successful!`);
          }
          // 如果用户有邮箱，需要验证邮箱
          if (user.email) {
            if (!email || email.toLowerCase() !== user.email.toLowerCase()) {
              return new Response(JSON.stringify({
                error: "使用临时密码登录时需要验证邮箱地址",
                requiresEmail: true,
                hint: "请输入您在个人资料中保存的邮箱地址"
              }), { status: 401 });
            }
          }
          isTempPasswordLogin = true;
        } else {
          if (DEBUG_MODE) {
            console.log(`[Auth] Temp password mismatch, will try normal password`);
          }
          // 尝试临时密码失败，继续尝试正常密码
        }
      } else {
        if (DEBUG_MODE) {
          console.log(`[Auth] Temp password expired, clearing...`);
        }
        // 临时密码已过期，清除临时密码状态
        try {
          await env.DB.prepare('UPDATE users SET is_temp_password_active = 0, temp_password_hash = NULL, temp_password_expires_at = NULL WHERE id = ?')
            .bind(user.id).run();
        } catch (e) {
          console.warn('[Auth] Failed to clear expired temp password:', e.message);
        }
      }
    }

    // 检查正常密码（直接比较 user.password_hash，避免二次查询）
    if (!isTempPasswordLogin && (!user.password_hash || user.password_hash !== passwordHash)) {
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

    // 如果是临时密码登录，提示用户需要修改密码（但不立即清除临时密码）
    let shouldChangePassword = false;
    if (isTempPasswordLogin) {
      shouldChangePassword = true;
      console.log('[Auth] User logged in with temporary password, should change password');
    }

    // 更新最后登录时间
    await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    // 生成 Token (迁移至 JWT)
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'cloudnav-secret-2026');
    const token = await new jose.SignJWT({
        id: user.id,
        uid: user.uid,
        username: user.username,
        role: user.role
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 设置 7 天有效期
    .sign(secret);

    return new Response(JSON.stringify({
      success: true,
      token: token,
      user: {
        id: user.id,
        uid: user.uid,
        username: user.username,
        role: user.role
      },
      isTempPasswordLogin,
      requiresPasswordChange: shouldChangePassword
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器内部错误", details: e.message }), { status: 500 });
  }
}
