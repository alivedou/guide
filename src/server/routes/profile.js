import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { KV_DIR, DEBUG_MODE } from '../config.js';
import { db } from '../db.js';
import { authenticate } from '../middleware.js';

export function registerProfileRoutes(app) {
app.get('/api/user/profile', authenticate, (req, res) => {
    if (req.user.id === 'guest') {
        return res.status(401).json({ error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' });
    }
    try {
        const user = db.prepare('SELECT id, uid, username, email, telegram_chat_id, role FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let settings = db.prepare('SELECT is_shared, share_slug FROM user_settings WHERE user_id = ?').get(req.user.id);
        if (!settings) {
            settings = { is_shared: 0, share_slug: '' };
        }

        res.json({
            success: true,
            uid: user.uid,
            username: user.username,
            email: user.email || '',
            telegramChatId: user.telegram_chat_id || '',
            role: user.role,
            isShared: settings.is_shared === 1,
            shareSlug: settings.share_slug || ''
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/profile', authenticate, async (req, res) => {
    if (req.user.id === 'guest') {
        console.warn('[Profile] Auth failed: guest user detected, token invalid or missing');
        return res.status(401).json({ error: 'Unauthorized - please login first', code: 'ERR_UNAUTHORIZED' });
    }
    try {
        const { username, email, telegramChatId, password, newPassword, isShared, shareSlug } = req.body;
        if (!username || !username.trim()) {
            return res.status(400).json({ error: '用户名不能为空' });
        }

        const user = db.prepare('SELECT password_hash, temp_password_hash, temp_password_expires_at, is_temp_password_active FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let oldHash = null;

        if (newPassword && newPassword.trim()) {
            if (!password) {
                return res.status(400).json({ error: '修改密码需要输入原密码' });
            }
            oldHash = crypto.createHash('sha256').update(password).digest('hex');

            // 检查是否使用临时密码验证
            let isTempPasswordValid = false;
            if (user.temp_password_hash && (user.is_temp_password_active === 1 || user.is_temp_password_active === true || user.is_temp_password_active === '1')) {
                const expiresAt = new Date(user.temp_password_expires_at).getTime();
                const now = Date.now();
                if (expiresAt > now && user.temp_password_hash === oldHash) {
                    isTempPasswordValid = true;
                    if (DEBUG_MODE) {
                        console.log(`[Profile] User ${req.user.username} is using temporary password to change password`);
                    }
                }
            }

            // 验证密码（正常密码或临时密码）
            if (user.password_hash !== oldHash && !isTempPasswordValid) {
                if (DEBUG_MODE) {
                    console.log(`[Profile] Password validation failed - input hash: ${oldHash.substring(0,10)}..., stored: ${user.password_hash ? user.password_hash.substring(0,10) : 'NULL'}..., temp: ${user.temp_password_hash ? user.temp_password_hash.substring(0,10) : 'NULL'}..., isTempValid: ${isTempPasswordValid}`);
                }
                return res.status(401).json({ error: '原密码验证失败', code: 'ERR_PASSWORD_WRONG' });
            }
        }

        // 检测用户名冲突
        const collide = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), req.user.id);
        if (collide) {
            return res.status(400).json({ error: '用户名已被其他用户使用' });
        }

        if (email && email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
        }

        try {
            // 更新 users 表 (优先执行，确保密码修改不受 user_settings 缺失字段影响)
            if (newPassword && newPassword.trim()) {
                const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');

                // 检查是否使用临时密码验证，如果是则清除临时密码状态
                const wasTempPasswordValid = user.temp_password_hash &&
                    (user.is_temp_password_active === 1 || user.is_temp_password_active === true || user.is_temp_password_active === '1') &&
                    user.temp_password_hash === crypto.createHash('sha256').update(password).digest('hex');

                if (wasTempPasswordValid) {
                    if (DEBUG_MODE) {
                        console.log(`[Profile] Clearing temporary password for user ${req.user.username} after password change`);
                    }
                    db.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ?, password_hash = ?, temp_password_hash = NULL, temp_password_expires_at = NULL, is_temp_password_active = 0 WHERE id = ?')
                      .run(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, newHash, req.user.id);
                } else {
                    db.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ?, password_hash = ? WHERE id = ?')
                      .run(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, newHash, req.user.id);
                }
            } else {
                db.prepare('UPDATE users SET username = ?, email = ?, telegram_chat_id = ? WHERE id = ?')
                  .run(username.trim(), email ? email.trim() : null, telegramChatId ? telegramChatId.trim() : null, req.user.id);
            }

            // 校验公开分享别名
            const cleanSlug = shareSlug ? shareSlug.trim().toLowerCase() : null;
            if (cleanSlug) {
                if (!/^[a-zA-Z0-9\-]+$/.test(cleanSlug)) {
                    return res.status(400).json({ error: '个性分享别名只允许包含英文字母、数字和横线(-)' });
                }
                try {
                    const duplicate = db.prepare('SELECT user_id FROM user_settings WHERE share_slug = ? AND user_id != ?').get(cleanSlug, req.user.id);
                    if (duplicate) {
                        return res.status(400).json({ error: '该公开分享别名已被抢占，请换一个吧！' });
                    }
                } catch (slugErr) {
                    if (DEBUG_MODE) console.warn('[Profile] share_slug check skipped:', slugErr.message);
                }
            }

            // 更新 user_settings (独立执行，失败不影响密码修改结果)
            try {
                db.prepare('UPDATE user_settings SET is_shared = ?, share_slug = ? WHERE user_id = ?')
                  .run(isShared ? 1 : 0, cleanSlug || null, req.user.id);
            } catch (settingsErr) {
                if (DEBUG_MODE) console.warn('[Profile] user_settings update skipped:', settingsErr.message);
            }
        } catch (transError) {
            return res.status(400).json({ error: transError.message });
        }

        // 同步更新本地 JSON 缓存中的用户名
        const kvPath = path.join(KV_DIR, `user_${req.user.id}.json`);
        if (fs.existsSync(kvPath)) {
            let data = JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
            data.username = username.trim();
            fs.writeFileSync(kvPath, JSON.stringify(data, null, 4));
        }

        res.json({ success: true, message: '个人资料修改成功' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
