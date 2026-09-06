import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as jose from 'jose';
import { KV_DIR, DEBUG_MODE, secret } from '../config.js';
import { db } from '../db.js';
import { getOnboardingData, syncUserToKV } from '../kv.js';

const loginAttempts = new Map();
const registerAttempts = new Map();

export function registerAuthRoutes(app) {
app.post('/api/auth/register', (req, res) => {
    console.log('[Auth] Register request:', req.body.username);
    const { username, password, inviteCode } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    // 0. 模拟获取策略
    const configPath = path.join(KV_DIR, 'site_config.json');
    let config = { allowOpenRegistration: true, requireInvitation: false };
    if (fs.existsSync(configPath)) {
        try {
            const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config = {
                allowOpenRegistration: rawConfig.allowOpenRegistration !== undefined ? rawConfig.allowOpenRegistration : true,
                requireInvitation: rawConfig.requireInvitation !== undefined ? rawConfig.requireInvitation : false,
                ...rawConfig
            };
        } catch (e) {
            console.error('[Auth] Failed to parse site_config.json:', e);
        }
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const uuid = crypto.randomUUID();
    const onboardingData = getOnboardingData();

    try {
        let finalRole = 'user';

        db.transaction(() => {
            // 在事务内部计算 UID 和角色，确保并发下的原子性
            const stats = db.prepare('SELECT COUNT(*) as count, MAX(uid) as maxUid FROM users').get();
            const isFirstUser = stats.count === 0;
            finalRole = isFirstUser ? 'admin' : 'user';
            const nextUid = isFirstUser ? 10001 : (stats.maxUid || 10000) + 1;

            // 策略预检（不涉及数据库写入）
            if (!isFirstUser) {
                if (config.requireInvitation && !inviteCode) throw new Error('INVITE_REQUIRED');
                if (!config.requireInvitation && !config.allowOpenRegistration) throw new Error('REGISTRATION_PAUSED');
            }

            // 先插入用户，确保满足 invitation_codes 的 used_by 外键约束，并记录是否使用了邀请码 (has_invite)
            db.prepare('INSERT INTO users (id, uid, username, password_hash, role, has_invite) VALUES (?, ?, ?, ?, ?, ?)').run(uuid, nextUid, username, passwordHash, finalRole, inviteCode ? 1 : 0);

            // 事务内原子化校验与消耗邀请码
            if (!isFirstUser && config.requireInvitation) {
                console.log(`[Auth] Attempting to consume invite: ${inviteCode} for user: ${uuid}`);
                const result = db.prepare(`UPDATE invitation_codes SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'unused'`).run(uuid, inviteCode);

                if (result.changes === 0) {
                    throw new Error('INVITE_INVALID'); // 抛出异常将导致上方 INSERT 自动回滚
                }
            }

            // 使用模板设置
            const s = onboardingData.settings || {};
            const linkTarget = s.link_target || '_blank';
            db.prepare('INSERT INTO user_settings (user_id, card_width, zen_mode, link_target, hide_bg_mask, sync_interval) VALUES (?, ?, ?, ?, ?, ?)').run(
                uuid, s.cardWidth || 125, s.zenMode ? 1 : 0, linkTarget, s.hideBgMask ? 1 : 0, s.syncInterval !== undefined ? s.syncInterval : 7
            );

            for (const cat of onboardingData.categories) {
                const newCatId = crypto.randomUUID();
                db.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)').run(newCatId, uuid, cat.name, cat.icon, cat.hidden ? 1 : 0);
                const catItems = onboardingData.items.filter(i => (i.catId || i.cat_id) === cat.id);
                for (const item of catItems) {
                    const newItemId = crypto.randomUUID();
                    db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(newItemId, uuid, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0);
                }
            }
        })();

        syncUserToKV(uuid);
        res.json({ success: true, role: finalRole });
    } catch (e) {
        console.error('[Auth] Registration error detail:', e);

        let errorMessage = '注册失败，请稍后重试';
        let statusCode = 400;

        // 处理事务内抛出的业务错误
        if (e.message === 'INVITE_REQUIRED') {
            errorMessage = '该站点已开启强制邀请模式，请提供邀请码';
            statusCode = 403;
        } else if (e.message === 'INVITE_INVALID') {
            errorMessage = '邀请码无效或已被他人抢先使用';
            statusCode = 403;
        } else if (e.message === 'REGISTRATION_PAUSED') {
            errorMessage = '全站注册已关闭，仅限管理员手动开通';
            statusCode = 403;
        } else if (e.message.includes('UNIQUE constraint failed')) {
            if (e.message.includes('users.username')) {
                errorMessage = '该用户名已被占用，请更换';
                statusCode = 409;
            } else if (e.message.includes('users.uid')) {
                errorMessage = '系统分配 ID 冲突，请重试';
                statusCode = 409;
            } else if (e.message.includes('users.id')) {
                errorMessage = '系统生成 UUID 冲突，请重试';
            }
        } else if (e.message.includes('invitation_codes')) {
            errorMessage = '邀请码处理异常';
        }

        res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { username, password, email } = body;
    const rawIp = req.ip || "unknown";
    const ip = crypto.createHash('sha256').update(rawIp).digest('hex');

    // 空参/缺字段：返回 400，禁止落入 crypto.update(undefined) 拖垮进程
    if (!username || typeof username !== 'string' || !String(username).trim()) {
        return res.status(400).json({ error: '请输入用户名', code: 'ERR_MISSING_USERNAME' });
    }
    if (password === undefined || password === null || typeof password !== 'string' || password === '') {
        return res.status(400).json({ error: '请输入密码', code: 'ERR_MISSING_PASSWORD' });
    }

    console.log(`[Auth] Login attempt for user: ${username}`);

    // 获取动态安全配置
    const configPath = path.join(KV_DIR, 'site_config.json');
    let securityConfig = { maxLoginAttempts: 5, loginLockoutMin: 10 };
    if (fs.existsSync(configPath)) {
        const fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (fullConfig.security) securityConfig = { ...securityConfig, ...fullConfig.security };
    }

    // 防爆破检查
    const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    if (attempt.lockUntil > Date.now()) {
        const waitMin = Math.ceil((attempt.lockUntil - Date.now()) / 60000);
        console.warn(`[Auth] IP ${ip} is currently locked out`);
        return res.status(429).json({ error: `登录尝试过多，请在 ${waitMin} 分钟后再试` });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT id, uid, username, role, status, email, password_hash, temp_password_hash, temp_password_expires_at, is_temp_password_active FROM users WHERE username = ?').get(username);

    if (!user) {
        console.warn(`[Auth] User not found: ${username}`);
        return recordLoginFailure(ip, res, securityConfig);
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
                console.log(`[Auth] Input hash: ${hash.substring(0, 10)}..., Stored hash: ${user.temp_password_hash.substring(0, 10)}...`);
            }

            if (user.temp_password_hash === hash) {
                if (DEBUG_MODE) {
                    console.log(`[Auth] Temp password match successful!`);
                }
                // 如果用户有邮箱，需要验证邮箱
                if (user.email) {
                    if (!email || email.toLowerCase() !== user.email.toLowerCase()) {
                        return res.status(401).json({
                            error: "使用临时密码登录时需要验证邮箱地址",
                            requiresEmail: true,
                            hint: "请输入您在个人资料中保存的邮箱地址"
                        });
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
                db.prepare('UPDATE users SET is_temp_password_active = 0, temp_password_hash = NULL, temp_password_expires_at = NULL WHERE id = ?')
                    .run(user.id);
            } catch (e) {
                console.warn('[Auth] Failed to clear expired temp password:', e.message);
            }
        }
    }

    // 检查正常密码（直接比较 user.password_hash，避免二次查询）
    if (!isTempPasswordLogin && (!user.password_hash || user.password_hash !== hash)) {
        console.warn(`[Auth] Password mismatch for user: ${username}`);
        return recordLoginFailure(ip, res, securityConfig);
    }

    // 检查账号状态 (冻结逻辑)
    if (user.status === 'frozen') {
        console.warn(`[Auth] Account frozen: ${username}`);
        return res.status(403).json({ error: '账号已被冻结，请联系管理员', code: 'ACCOUNT_FROZEN' });
    }

    // 登录成功，重置尝试次数
    loginAttempts.delete(ip);
    console.log(`[Auth] Login successful: ${username} (${user.role})${isTempPasswordLogin ? ' [Temp Password]' : ''}`);

    // 如果是临时密码登录，提示用户需要修改密码（但不立即清除临时密码）
    let shouldChangePassword = false;
    if (isTempPasswordLogin) {
        shouldChangePassword = true;
        if (DEBUG_MODE) {
            console.log(`[Auth] User logged in with temporary password, should change password`);
        }
    }

    const token = await new jose.SignJWT({
            id: user.id,
            uid: user.uid,
            username: user.username,
            role: user.role
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d') // 设置 7 天过期
        .sign(secret);

    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            uid: user.uid,
            username: user.username,
            role: user.role
        },
        isTempPasswordLogin,
        requiresPasswordChange: shouldChangePassword
    });
    } catch (e) {
        console.error('[Auth] Login handler error:', e && e.message);
        if (!res.headersSent) {
            res.status(500).json({ error: '登录失败，请稍后重试', code: 'ERR_LOGIN_INTERNAL' });
        }
    }
});

// 辅助函数：记录登录失败 (支持动态配置)
function recordLoginFailure(ip, res, config) {
    const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    attempt.count++;
    const maxAttempts = config?.maxLoginAttempts || 5;
    const lockoutMs = (config?.loginLockoutMin || 10) * 60 * 1000;

    if (attempt.count >= maxAttempts) {
        attempt.lockUntil = Date.now() + lockoutMs;
        console.log(`[Security] IP ${ip} locked for ${config?.loginLockoutMin || 10} mins due to failures`);
    }
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: '用户名或密码错误' });
}
}
