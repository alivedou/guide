import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { KV_DIR, CRON_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';
import { db } from '../db.js';
import { authenticate, adminOnly } from '../middleware.js';
import { dispatchInstantAdminAlert, sendEmailHelper } from '../alerts.js';

export function registerAdminRoutes(app) {
app.get('/api/admin/audit-logs', authenticate, adminOnly, (req, res) => {
    // 显式校验 Admin 权限
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '权限不足，审计日志仅限系统管理员查看' });
    }

    const page = parseInt(req.query.page || '1');
    const pageSize = parseInt(req.query.pageSize || '20');
    const keyword = req.query.keyword || '';
    const actionType = req.query.actionType || '';

    try {
        let query = `
            SELECT al.*, u.username as operator_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(*) as total FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        let params = [];

        if (keyword) {
            const kw = `%${keyword}%`;
            query += ' AND (u.username LIKE ? OR al.details LIKE ? OR al.ip LIKE ?)';
            countQuery += ' AND (u.username LIKE ? OR al.details LIKE ? OR al.ip LIKE ?)';
            params.push(kw, kw, kw);
        }

        if (actionType) {
            query += ' AND al.action = ?';
            countQuery += ' AND al.action = ?';
            params.push(actionType);
        }

        const totalRow = db.prepare(countQuery).bind(...params).get();
        const total = totalRow ? totalRow.total : 0;

        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        const logs = db.prepare(query).bind(...params, pageSize, (page - 1) * pageSize).all();

        res.json({
            success: true,
            logs,
            pagination: { total, page, pageSize }
        });
    } catch (e) {
        res.status(500).json({ error: '获取审计日志失败', details: e.message });
    }
});

app.get('/api/admin/invitations', authenticate, adminOnly, (req, res) => {
    const page = parseInt(req.query.page || '1');
    const pageSize = parseInt(req.query.pageSize || '20');
    const keyword = req.query.keyword || '';
    const status = req.query.status || '';

    try {
        let query = `
            SELECT ic.*, u2.username as used_by_name
            FROM invitation_codes ic
            LEFT JOIN users u2 ON ic.used_by = u2.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(*) as total FROM invitation_codes ic
            LEFT JOIN users u2 ON ic.used_by = u2.id
            WHERE 1=1
        `;
        let params = [];

        if (keyword) {
            const kw = `%${keyword}%`;
            query += ' AND (ic.code LIKE ? OR u2.username LIKE ?)';
            countQuery += ' AND (ic.code LIKE ? OR u2.username LIKE ?)';
            params.push(kw, kw);
        }

        if (status) {
            query += ' AND ic.status = ?';
            countQuery += ' AND ic.status = ?';
            params.push(status);
        }

        const totalRow = db.prepare(countQuery).bind(...params).get();
        const total = totalRow ? totalRow.total : 0;

        query += ' ORDER BY ic.created_at DESC LIMIT ? OFFSET ?';
        const list = db.prepare(query).bind(...params, pageSize, (page - 1) * pageSize).all();

        res.json({
            success: true,
            invitations: list,
            pagination: { total, page, pageSize }
        });
    } catch (e) {
        res.status(500).json({ error: '获取邀请码失败', details: e.message });
    }
});

app.post('/api/admin/invitations', authenticate, adminOnly, (req, res) => {
    const { count } = req.body;
    try {
        // 针对 super_user 实现总量配额校验
        if (req.user.role === 'super_user') {
            const configPath = path.join(KV_DIR, 'site_config.json');
            let quota = 10; // 默认值
            if (fs.existsSync(configPath)) {
                const fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (fullConfig.superUserInviteQuota !== undefined) {
                    quota = fullConfig.superUserInviteQuota;
                }
            }

            // 查询该用户已生成的邀请码总数
            const currentCount = db.prepare('SELECT COUNT(*) as total FROM invitation_codes WHERE creator_id = ?').get(req.user.id).total;
            const requestCount = count || 1;

            if (currentCount + requestCount > quota) {
                return res.status(403).json({
                    error: '生成失败：超过邀请码分配额度',
                    details: `当前已生成 ${currentCount} 个，剩余额度 ${Math.max(0, quota - currentCount)} 个。请联系管理员调配。`
                });
            }
        }

        db.transaction(() => {
            for (let i = 0; i < (count || 1); i++) {
                const code = Math.random().toString(36).substring(2, 10).toUpperCase();
                db.prepare('INSERT INTO invitation_codes (code, creator_id) VALUES (?, ?)').run(code, req.user.id);
            }
        })();

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'BATCH_GENERATE_INVITATIONS', `Generated ${count || 1} codes`, '[Protected]');

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '生成邀请码失败', details: e.message });
    }
});

app.delete('/api/admin/invitations', authenticate, adminOnly, (req, res) => {
    const { code } = req.body;
    try {
        db.prepare('DELETE FROM invitation_codes WHERE code = ?').run(code);

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'DELETE_INVITATION', `Deleted code: ${code}`, '[Protected]');

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '删除邀请码失败', details: e.message });
    }
});

app.get('/api/admin/site-config', (req, res) => {
    const configPath = path.join(KV_DIR, 'site_config.json');
    let config = {
        siteTitle: 'CloudNav 导航',
        allowOpenRegistration: true,
        requireInvitation: false,
        security: {
            maxLoginAttempts: 5,
            loginLockoutMin: 10,
            maxRegisterPerHour: 3,
            registerLockoutHours: 24
        }
    };
    if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config = { ...config, ...fileConfig };
    }
    res.json(config);
});

app.post('/api/admin/site-config', authenticate, adminOnly, (req, res) => {
    const newConfig = req.body;
    const configPath = path.join(KV_DIR, 'site_config.json');

    try {
        let currentConfig = {};
        if (fs.existsSync(configPath)) {
            currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }

        const finalConfig = { ...currentConfig, ...newConfig };
        fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

        console.log('[Admin] Site config updated by:', req.user.username);
        res.json({ success: true, config: finalConfig });
    } catch (e) {
        res.status(500).json({ error: '保存配置失败', details: e.message });
    }
});

app.get('/api/admin/users', authenticate, adminOnly, (req, res) => {
    const page = parseInt(req.query.page || '1');
    const pageSize = parseInt(req.query.pageSize || '20');
    const keyword = req.query.keyword || '';
    const status = req.query.status || '';

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
        const totalRow = db.prepare(countQuery).bind(...params).get();
        const total = totalRow ? totalRow.total : 0;

        // 获取管理员总数
        const adminCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
        const adminCount = adminCountRow ? adminCountRow.count : 0;

        // 排序与分页
        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        const users = db.prepare(query).bind(...params, pageSize, (page - 1) * pageSize).all();

        res.json({
            success: true,
            users,
            adminCount,
            pagination: {
                total,
                page,
                pageSize
            }
        });
    } catch (e) {
        res.status(500).json({ error: '获取用户列表失败', details: e.message });
    }
});

app.patch('/api/admin/users', authenticate, adminOnly, (req, res) => {
    const { userId, status, role, newPassword, adminPassword, isAlertReceiver, isDigestReceiver } = req.body;
    try {
        // 二次身份验证
        if (adminPassword) {
            const adminUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
            const adminHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
            if (adminUser.password_hash !== adminHash) {
                return res.status(401).json({ error: '管理员身份验证失败' });
            }
        }

        if (isAlertReceiver !== undefined) {
            db.prepare(`
                INSERT INTO user_settings (user_id, is_alert_receiver)
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET is_alert_receiver = excluded.is_alert_receiver
            `).run(userId, isAlertReceiver ? 1 : 0);
        }
        if (isDigestReceiver !== undefined) {
            db.prepare(`
                INSERT INTO user_settings (user_id, is_digest_receiver)
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET is_digest_receiver = excluded.is_digest_receiver
            `).run(userId, isDigestReceiver ? 1 : 0);
        }

        if (status) {
            db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
            db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
              .run(req.user.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, '[Protected]');
            dispatchInstantAdminAlert('CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, req.user.id, '[Protected]');
        }

        // 重置用户密码 - 临时密码安全增强
        if (newPassword) {
            // 强制敏感操作进行二次身份验证
            if (!adminPassword) {
                return res.status(400).json({ error: "重置密码属于敏感操作，请输入管理员密码验证" });
            }

            const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');

            // 计算临时密码过期时间 (30分钟后)
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

            db.prepare('UPDATE users SET temp_password_hash = ?, temp_password_expires_at = ?, is_temp_password_active = 1 WHERE id = ?')
                .run(newHash, expiresAt, userId);

            db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
                .run(req.user.id, 'RESET_TEMP_PASSWORD', `Generated temporary password for user ${userId}, expires at ${expiresAt}`, '[Protected]');
            dispatchInstantAdminAlert('RESET_TEMP_PASSWORD', `Generated temporary password for user ${userId}, expires at ${expiresAt}`, req.user.id, '[Protected]');
        }

        if (role) {
            // 权限等级逻辑：admin 权限最高，super_user 次之
            if (req.user.role === 'admin') {
                // admin 无限权限
            } else if (req.user.role === 'super_user') {
                if (role !== 'user') return res.status(403).json({ error: '权限不足：super_user 只能管理普通用户' });
            } else {
                return res.status(403).json({ error: '权限不足' });
            }

            // 防止降级自己
            if (userId === req.user.id && req.user.role === 'admin' && role !== 'admin') {
                return res.status(403).json({ error: '管理员不能降级自己' });
            }

            db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
            db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
              .run(req.user.id, 'CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, '[Protected]');
            dispatchInstantAdminAlert('CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, req.user.id, '[Protected]');
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新用户失败', details: e.message });
    }
});

app.delete('/api/admin/users', authenticate, adminOnly, (req, res) => {
    const { userId, adminPassword } = req.body;
    try {
        if (!userId) return res.status(400).json({ error: '缺少 userId' });
        if (!adminPassword) return res.status(400).json({ error: '删除操作非常危险，请输入管理员密码验证' });

        const adminUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
        const adminHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
        if (adminUser.password_hash !== adminHash) {
            return res.status(401).json({ error: '管理员身份验证失败，请检查密码' });
        }

        // 清理关联数据（避免外键冲突）
        db.prepare('DELETE FROM invitation_codes WHERE used_by = ?').run(userId);
        db.prepare('DELETE FROM invitation_codes WHERE creator_id = ?').run(userId);
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM announcement_read_states WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(userId);

        // 清除 KV 缓存（本地用 local_kv 目录）
        const configPath = path.join(KV_DIR, `user_config:${userId}.json`);
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

        // 删除用户主记录
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
            .run(req.user.id, 'DELETE_USER', `Deleted user account ${userId}`, '[Protected]');
        dispatchInstantAdminAlert('DELETE_USER', `Deleted user account ${userId}`, req.user.id, '[Protected]');

        console.log(`[Admin] User ${userId} deleted by ${req.user.username}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '删除用户失败', details: e.message });
    }
});

app.get('/api/admin/cron-digest', authenticate, async (req, res) => {
    // 1. 安全阻断校验：允许管理员会话直接调用，或者由 Cron Trigger 带密钥 x-cron-secret / ?secret= 触发
    const cronSecretHeader = req.headers['x-cron-secret'] || req.query.secret;
    const isAuthorizedAdmin = (req.user && (req.user.role === 'admin' || req.user.role === 'super_user'));
    const isAuthorizedCron = (CRON_SECRET && cronSecretHeader === CRON_SECRET);

    if (!isAuthorizedAdmin && !isAuthorizedCron) {
        return res.status(403).json({ error: '权限不足，仅限管理员操作或由正确的定时密匙触发', code: 'FORBIDDEN' });
    }

    try {
        // 查询 24 小时内增量审计日志 (使用 local SQLite)
        const logs = db.prepare(`
            SELECT l.id, u.username, l.action, l.details, l.ip, l.created_at
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.created_at >= datetime('now', '-1 day')
            ORDER BY l.created_at DESC
        `).all();

        let reportSubject = '';
        let reportText = '';

        if (logs.length === 0) {
            // 2.1 无增量审计日志时，发送系统健康自检日报
            const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
            const catCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get().count;
            const itemCount = db.prepare("SELECT COUNT(*) AS count FROM items").get().count;

            reportSubject = `【CloudNav 每日自检】系统安全运行正常`;
            reportText = `您好，过去 24 小时内系统运行平稳，未生成任何高危或异常的审计日志。\n\n`;
            reportText += `📅 自检时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
            reportText += `🟢 系统健康状况: 优秀 (100%)\n`;
            reportText += `📊 当前平台活跃状况:\n`;
            reportText += `    👥 注册用户总数: ${userCount} 人\n`;
            reportText += `    📁 导航分类总数: ${catCount} 个\n`;
            reportText += `    🔗 收藏网址总数: ${itemCount} 个\n`;
            reportText += `----------------------------------------\n`;
            reportText += `本邮件由 CloudNav 定时触发器自动发送，请勿直接回复。`;
        } else {
            reportSubject = `【CloudNav 每日审计日报】增量管理日志摘要`;
            reportText = `您好，这是过去 24 小时内生成的系统审计日志增量汇总：\n\n`;
            reportText += `📊 日志条数: ${logs.length} 条\n`;
            reportText += `----------------------------------------\n\n`;

            logs.forEach((log, index) => {
                reportText += `[${index + 1}] 操作行为: ${log.action}\n`;
                reportText += `    👤 操作用户: ${log.username || '未知 (ID: ' + log.user_id + ')'}\n`;
                reportText += `    🌐 来源 IP: ${log.ip || 'unknown'}\n`;
                reportText += `    🕒 操作时间: ${log.created_at} (UTC)\n`;
                reportText += `    📝 详情细节: ${log.details || ''}\n\n`;
            });

            reportText += `----------------------------------------\n本邮件由 CloudNav 定时触发器自动发送，请勿直接回复。`;
        }

        // 查询授权接收日报的用户
        const receivers = db.prepare(`
            SELECT u.username, u.email, u.telegram_chat_id
            FROM users u
            JOIN user_settings s ON u.id = s.user_id
            WHERE s.is_digest_receiver = 1
        `).all();

        console.log(`\n📬 =================== ${reportSubject} ===================`);
        console.log(reportText);
        console.log(`授权接收用户数: ${receivers.length} 个`);
        console.log(`分发邮箱列表: ${receivers.filter(r => r.email).map(r => r.email).join(', ') || '无'}`);
        console.log(`分发 TG 账号列表: ${receivers.filter(r => r.telegram_chat_id).map(r => r.telegram_chat_id).join(', ') || '无'}`);
        console.log(`=========================================================\n`);

        const dispatchPromises = [];
        const botToken = TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.trim() : "";
        const globalChatId = TELEGRAM_CHAT_ID ? TELEGRAM_CHAT_ID.trim() : "";

        // 发送 Email (如果有绑定邮箱)
        receivers.forEach(r => {
            if (r.email) {
                dispatchPromises.push((async () => {
                    try {
                        await sendEmailHelper(r.email.trim(), reportSubject, reportText);
                        return { type: 'email', target: r.username, email: r.email.trim(), status: 'success' };
                    } catch (e) {
                        return { type: 'email', target: r.username, email: r.email.trim(), status: 'failed', error: e.message };
                    }
                })());
            }
        });

        // 发送个人 Telegram Bot 消息 (如果有绑定 Telegram Chat ID)
        if (botToken) {
            const htmlContent = reportText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            receivers.forEach(r => {
                if (r.telegram_chat_id) {
                    const personalChatId = r.telegram_chat_id.trim();
                    dispatchPromises.push((async () => {
                        try {
                            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

        // 全局 Telegram 备份频道 (如果配置了全局 Chat ID)
        if (botToken && globalChatId) {
            const htmlContent = reportText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            dispatchPromises.push((async () => {
                try {
                    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: globalChatId,
                            text: `📢 <b>${reportSubject}</b>\n\n${htmlContent}`,
                            parse_mode: 'HTML'
                        })
                    });
                    const tgData = await tgRes.json();
                    if (tgRes.ok && tgData.ok) {
                        return { type: 'telegram_global', chat_id: globalChatId, status: 'success' };
                    } else {
                        return { type: 'telegram_global', chat_id: globalChatId, status: 'failed', error: tgData.description || 'API Error' };
                    }
                } catch (e) {
                    return { type: 'telegram_global', chat_id: globalChatId, status: 'failed', error: e.message };
                }
            })());
        }

        let reports = [];
        if (dispatchPromises.length > 0) {
            reports = await Promise.all(dispatchPromises);
        }

        res.json({
            success: true,
            message: `每日审计日报打包成功！已派发至 ${receivers.length} 个授权接收者。`,
            dispatchReports: reports,
            debug_receivers: receivers.map(r => ({
                username: r.username,
                has_email: !!r.email,
                email_val: r.email,
                has_tg_chat_id: !!r.telegram_chat_id,
                tg_chat_id_val: r.telegram_chat_id
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
