/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import * as jose from 'jose';
import Database from 'better-sqlite3';
import { defaultData, MINIMAL_SAFE_DATA } from './nav-main/functions/api/defaultData.js';
import { parse } from 'node-html-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== 初始化本地数据库 (模拟 D1) ======
const dbPath = path.join(__dirname, 'local_d1.db');
const db = new Database(dbPath);

// Task 19.1: 后端自愈 - 检查核心表是否存在，不存在则自动执行迁移
const checkTables = () => {
    try {
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        if (!row) {
            console.log('[DB] Core tables missing, performing auto-initialization...');
            const initSql = path.join(__dirname, 'migrations', '0000_init.sql');
            if (fs.existsSync(initSql)) {
                db.exec(fs.readFileSync(initSql, 'utf-8'));
                console.log('[DB] 0000_init.sql applied successfully.');
            }
        }
    } catch (e) {
        console.error('[DB] Auto-check failed:', e.message);
    }
};
checkTables();

// 自动执行所有迁移文件 (Task 5.5.2)
const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).sort();
    files.forEach(file => {
        if (file.endsWith('.sql')) {
            console.log(`[DB] Processing migration: ${file}`);
            try {
                db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
            } catch (e) {
                if (e.message.includes('duplicate column name') || e.message.includes('already exists')) {
                    console.log(`[DB] Migration ${file} already applied or partially applied (skipped duplicate)`);
                } else {
                    console.error(`[DB] Migration ${file} failed:`, e.message);
                }
            }
        }
    });
}

// ====== Task 5.5.4: 数据库自动热迁移 (修复字段缺失) ======
try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columns = tableInfo.map(c => c.name);
    if (columns.length > 0) {
        if (!columns.includes('status')) {
            console.log('[DB] Patching: Adding status column to users table');
            db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
        }
        if (!columns.includes('role')) {
            console.log('[DB] Patching: Adding role column to users table');
            db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
        }
        if (!columns.includes('uid')) {
            console.log('[DB] Patching: Adding uid column to users table');
            db.exec("ALTER TABLE users ADD COLUMN uid INTEGER");
            db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid)");
        }
        if (!columns.includes('temp_password_hash')) {
            console.log('[DB] Patching: Adding temp_password_hash column to users table');
            db.exec("ALTER TABLE users ADD COLUMN temp_password_hash TEXT");
        }
        if (!columns.includes('temp_password_expires_at')) {
            console.log('[DB] Patching: Adding temp_password_expires_at column to users table');
            db.exec("ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME");
        }
        if (!columns.includes('is_temp_password_active')) {
            console.log('[DB] Patching: Adding is_temp_password_active column to users table');
            db.exec("ALTER TABLE users ADD COLUMN is_temp_password_active INTEGER DEFAULT 0");
        }
    }

    const annInfo = db.prepare("PRAGMA table_info(announcements)").all();
    const annCols = annInfo.map(c => c.name);
    if (annCols.length > 0) {
        if (!annCols.includes('expire_at')) {
            console.log('[DB] Patching: Adding expire_at column to announcements table');
            db.exec("ALTER TABLE announcements ADD COLUMN expire_at DATETIME");
        }
        if (!annCols.includes('status')) {
            console.log('[DB] Patching: Adding status column to announcements table');
            db.exec("ALTER TABLE announcements ADD COLUMN status TEXT DEFAULT 'published'");
        }
        if (!annCols.includes('type')) {
            console.log('[DB] Patching: Adding type column to announcements table');
            db.exec("ALTER TABLE announcements ADD COLUMN type TEXT DEFAULT 'quiet'");
        }
        if (!annCols.includes('is_top')) {
            console.log('[DB] Patching: Adding is_top column to announcements table');
            db.exec("ALTER TABLE announcements ADD COLUMN is_top BOOLEAN DEFAULT 0");
        }
        if (!annCols.includes('creator_id')) {
            console.log('[DB] Patching: Adding creator_id column to announcements table');
            db.exec("ALTER TABLE announcements ADD COLUMN creator_id TEXT");
        }
    }

    // Task 22.1 & 23.1: 补齐 user_settings 缺失字段
    const settingsInfo = db.prepare("PRAGMA table_info(user_settings)").all();
    const settingsCols = settingsInfo.map(c => c.name);
    if (settingsCols.length > 0) {
        if (!settingsCols.includes('hide_bg_mask')) {
            console.log('[DB] Patching: Adding hide_bg_mask column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN hide_bg_mask BOOLEAN DEFAULT 0");
        }
        if (!settingsCols.includes('isolated_view')) {
            console.log('[DB] Patching: Adding isolated_view column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN isolated_view BOOLEAN DEFAULT 0");
        }
        if (!settingsCols.includes('density')) {
            console.log('[DB] Patching: Adding density column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN density TEXT DEFAULT 'standard'");
        }
        if (!settingsCols.includes('link_target')) {
            console.log('[DB] Patching: Adding link_target column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN link_target TEXT DEFAULT '_blank'");
        }
        if (!settingsCols.includes('is_shared')) {
            console.log('[DB] Patching: Adding is_shared column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN is_shared BOOLEAN DEFAULT 0");
        }
        if (!settingsCols.includes('share_slug')) {
            console.log('[DB] Patching: Adding share_slug column to user_settings table');
            db.exec("ALTER TABLE user_settings ADD COLUMN share_slug TEXT");
            try {
                db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_share_slug ON user_settings(share_slug)");
            } catch (indexErr) {
                console.warn('[DB] Share index warning:', indexErr.message);
            }
        }
        
        // 💡 自动数据自愈修复：将本地已经被邀请码绑定的用户的 has_invite 状态强制修正回填为 1，确保本地开发测试时其享有 20 个书签的配额
        try {
            db.exec("UPDATE users SET has_invite = 1 WHERE id IN (SELECT used_by FROM invitation_codes WHERE used_by IS NOT NULL)");
        } catch (patchErr) {
            console.warn('[DB] Retroactive invite patch skipped:', patchErr.message);
        }
    }
} catch (e) {
    console.warn('[DB] Auto-patch skipped:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cloudnav-secret-2026';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true'; // 调试模式开关
const secret = new TextEncoder().encode(JWT_SECRET);

// ====== Task 4.3: 登录防爆破模拟 ======
const loginAttempts = new Map(); // IP -> { count, lockUntil }
const registerAttempts = new Map(); // Task 11.4: 注册防爆破 IP -> { count, lockUntil }

// ====== Task 4.3.1: 资源配额管理 ======
const QUOTA_CONFIG = {
    guest: { maxCategories: 6, maxItemsPerCategory: 12 },
    user: { maxCategories: 12, maxItemsPerCategory: 25 },
    invited_user: { maxCategories: 15, maxItemsPerCategory: 30 },
    super_user: { maxCategories: 20, maxItemsPerCategory: 40 },
    admin: { maxCategories: 150, maxItemsPerCategory: 500 }
};

function getQuota(user) {
    if (!user || !user.id || user.id === 'guest') return QUOTA_CONFIG.guest;
    if (user.role === 'admin') return QUOTA_CONFIG.admin;
    if (user.role === 'super_user') return QUOTA_CONFIG.super_user;
    if (user.role === 'user') {
        // 本地 SQLite 实时查询 has_invite 状态
        try {
            const dbUser = db.prepare('SELECT has_invite FROM users WHERE id = ?').get(user.id);
            if (dbUser && dbUser.has_invite === 1) {
                return QUOTA_CONFIG.invited_user;
            }
        } catch (e) {
            console.error('[Quota] Failed to query user invite status from DB:', e.message);
        }
        return QUOTA_CONFIG.user;
    }
    return QUOTA_CONFIG.guest;
}

// ====== 鉴权中间件 ======
const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = { role: 'guest', id: 'guest' };
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
        req.user = { role: 'guest', id: 'guest' };
        return next();
    }

    try {
        const { payload } = await jose.jwtVerify(token, secret);
        req.user = payload;
        if (DEBUG_MODE) {
            console.log(`[Auth] Token valid: user=${payload.username}, id=${payload.id}, role=${payload.role}`);
        }
        next();
    } catch (err) {
        console.error('[Auth] Token verification FAILED:', err.message, err.code || '');
        // Token 无效时，将用户设置为 guest 而不是返回错误
        req.user = { role: 'guest', id: 'guest' };
        next();
    }
};

// ====== 管理员权限拦截器 (Task 5.5.2.1) ======
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
        return res.status(403).json({ error: '权限不足，仅限管理员操作', code: 'FORBIDDEN' });
    }
    next();
};

app.use(express.json({ limit: '10mb' }));

// Task 21.1 & 13.1 & 19.3: Bing 每日壁纸代理 (提权至 API 第一顺位)
app.get('/api/bing', async (req, res) => {
    const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    try {
        // 尝试主源：Bing 官方 (强制 zh-CN 确保大陆可访问性)
        try {
            const response = await fetchWithTimeout("https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN", {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
            const data = await response.json();
            if (data.images && data.images.length > 0) {
                // Task 19.3: 后端标准化，补全绝对路径，与 Worker 保持逻辑一致
                data.images = data.images.map(img => ({
                    ...img,
                    url: img.url.startsWith('http') ? img.url : `https://cn.bing.com${img.url}`,
                    urlbase: img.urlbase.startsWith('http') ? img.urlbase : `https://cn.bing.com${img.urlbase}`
                }));
                console.log(`[Bing] Primary source success: ${data.images[0].url.substring(0, 50)}...`);
                return res.json(data);
            }
        } catch (e) {
            console.warn('[Bing] Primary source failed, trying mirror...', e.message);
        }

        // 尝试副源：高可用镜像源 (BitURL)
        console.log('[Bing] Fetching from mirror source...');
        const mirrorRes = await fetchWithTimeout("https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN");
        const mirrorData = await mirrorRes.json();
        if (mirrorData.url) {
            console.log('[Bing] Mirror source success');
            return res.json({
                images: [{ 
                    url: mirrorData.url,
                    urlbase: mirrorData.url.split('&')[0] // 简单模拟 urlbase
                }]
            });
        }

        throw new Error('All sources failed');
    } catch (e) {
        console.error('[Bing] Proxy error:', e.message);
        res.status(500).json({ error: 'Failed to fetch Bing wallpaper', details: e.message });
    }
});

// ====== Task 3.2: Magic Wand Backend (Metadata Fetcher) ======
app.get('/api/proxy/fetch-metadata', authenticate, async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL is required' });

    try {
        console.log(`[MagicWand] Fetching metadata for: ${targetUrl}`);
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(5000) // 5s timeout
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        const root = parse(html);
        
        // 提取标题
        let title = root.querySelector('title')?.text || 
                    root.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                    '';
        
        // 提取描述
        let desc = root.querySelector('meta[name="description"]')?.getAttribute('content') || 
                   root.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                   '';
        
        // 提取图标
        let icon = root.querySelector('link[rel~="icon"]')?.getAttribute('href') || 
                   root.querySelector('link[rel~="apple-touch-icon"]')?.getAttribute('href') || 
                   '/favicon.ico';

        // 图标地址转换 (相对路径 -> 绝对路径)
        try {
            const baseUrl = new URL(targetUrl);
            const iconUrl = new URL(icon, baseUrl.origin);
            icon = iconUrl.href;
        } catch (e) {
            console.warn('[MagicWand] Icon URL resolving failed', e);
        }

        res.json({
            success: true,
            data: {
                title: title.trim(),
                desc: desc.trim(),
                icon: icon
            }
        });
    } catch (err) {
        console.error('[MagicWand] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch metadata: ' + err.message });
    }
});

// ====== 核心业务逻辑 (4.6 数据持久化) ======

const syncUserToKV = (userId) => {
    console.log(`[KV] Syncing data for user: ${userId}`);
    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, name ASC').all(userId);
    const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order ASC, title ASC').all(userId);
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    
    const userData = {
        categories: categories.map(c => ({
            ...c, 
            id: c.id, 
            _isVideo: !!c.is_video, 
            hidden: !!c.hidden
        })),
        items: items.map(i => ({
            ...i, 
            catId: i.cat_id, 
            cat_id: i.cat_id, // 双重保险
            hidden: !!i.hidden
        })),
        settings: settings ? {
            cardWidth: settings.card_width,
            zenMode: !!settings.zen_mode,
            showFrequent: !!settings.show_f_requent, // 容错处理
            bgUrl: settings.bg_url,
            hideBgMask: !!settings.hide_bg_mask,
            isolatedView: !!settings.isolated_view,
            density: settings.density || 'standard',
            simpleMode: !!settings.simple_mode,
            openInNewTab: !!settings.open_in_new_tab,
            themeMode: settings.theme_mode
        } : defaultData.settings
    };
    
    // 强制修正 settings 中的 showFrequent 拼写 (容错)
    if (settings && settings.show_frequent !== undefined) {
        userData.settings.showFrequent = !!settings.show_frequent;
    }

    const kvDir = path.join(__dirname, 'local_kv');
    if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);
    
    const filePath = path.join(kvDir, `user_${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
    console.log(`[KV] Successfully wrote ${categories.length} cats and ${items.length} items to ${filePath}`);
    return userData;
};

/**
 * Task 6.1: 智能引导系统 (Onboarding)
 * 动态加载初始化数据模板
 */
const getOnboardingData = () => {
    const templatePath = path.join(__dirname, 'system_default.json');
    try {
        if (fs.existsSync(templatePath)) {
            console.log('[Onboarding] Loading template from system_default.json');
            return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        }
    } catch (e) {
        console.error('[Onboarding] Failed to read system_default.json:', e.message);
    }
    
    // 阶梯式回退：内置数据 -> 最小兜底数据
    if (defaultData && defaultData.categories && defaultData.categories.length > 0) {
        console.log('[Onboarding] Falling back to defaultData.js');
        return defaultData;
    }
    
    console.warn('[Onboarding] CRITICAL: Using MINIMAL_SAFE_DATA fallback');
    return MINIMAL_SAFE_DATA;
};

// ====== 4.3 认证 API ======

app.post('/api/auth/register', (req, res) => {
    console.log('[Auth] Register request:', req.body.username);
    const { username, password, inviteCode } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    // 0. 模拟获取策略
    const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
    let config = { allowOpenRegistration: true, requireInvitation: false };
    if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const uuid = crypto.randomUUID();
    const onboardingData = getOnboardingData();

    try {
        let finalRole = 'user';

        db.transaction(() => {
            // Task 16.3: 在事务内部计算 UID 和角色，确保并发下的原子性
            const stats = db.prepare('SELECT COUNT(*) as count, MAX(uid) as maxUid FROM users').get();
            const isFirstUser = stats.count === 0;
            finalRole = isFirstUser ? 'admin' : 'user';
            const nextUid = isFirstUser ? 10001 : (stats.maxUid || 10000) + 1;

            // Task 16.6: 策略预检（不涉及数据库写入）
            if (!isFirstUser) {
                if (config.requireInvitation && !inviteCode) throw new Error('INVITE_REQUIRED');
                if (!config.requireInvitation && !config.allowOpenRegistration) throw new Error('REGISTRATION_PAUSED');
            }

            // Task 16.6: 先插入用户，确保满足 invitation_codes 的 used_by 外键约束，并记录是否使用了邀请码 (has_invite)
            db.prepare('INSERT INTO users (id, uid, username, password_hash, role, has_invite) VALUES (?, ?, ?, ?, ?, ?)').run(uuid, nextUid, username, passwordHash, finalRole, inviteCode ? 1 : 0);

            // Task 16.2 & 16.6: 事务内原子化校验与消耗邀请码
            if (!isFirstUser && config.requireInvitation) {
                console.log(`[Auth] Attempting to consume invite: ${inviteCode} for user: ${uuid}`);
                const result = db.prepare(`UPDATE invitation_codes SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'unused'`).run(uuid, inviteCode);
                
                if (result.changes === 0) {
                    throw new Error('INVITE_INVALID'); // 抛出异常将导致上方 INSERT 自动回滚
                }
            }

            // 使用模板设置
            const s = onboardingData.settings || {};
            db.prepare('INSERT INTO user_settings (user_id, card_width, zen_mode, open_in_new_tab, hide_bg_mask) VALUES (?, ?, ?, ?, ?)').run(
                uuid, s.cardWidth || 125, s.zenMode ? 1 : 0, s.openInNewTab ? 1 : 0, s.hideBgMask ? 1 : 0
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

        // Task 16.2: 处理事务内抛出的业务错误
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

// ====== Task 4.4: 审计日志管理 API ======

app.get('/api/admin/audit-logs', authenticate, adminOnly, (req, res) => {
    // Task AC.4: 显式校验 Admin 权限
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
        // Task 21.5: 针对 super_user 实现总量配额校验
        if (req.user.role === 'super_user') {
            const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
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

app.post('/api/auth/login', async (req, res) => {
    const { username, password, email } = req.body;
    const rawIp = req.ip || "unknown";
    const ip = crypto.createHash('sha256').update(rawIp).digest('hex');
    console.log(`[Auth] Login attempt for user: ${username}`);

    // 获取动态安全配置 (Task 12.3)
    const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
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

    // Task 5.5.2: 检查账号状态 (冻结逻辑)
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
        .setExpirationTime('7d') // Task 4.3: 设置 7 天过期
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
});

// 辅助函数：记录登录失败 (Task 12.3: 支持动态配置)
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

// ====== Task 4.1: 管理员管控枢纽 (Admin Hub) ======

// Task 12.4: 获取/更新全站安全配置 (GET 接口公开，方便游客和 SEO 加载)
app.get('/api/admin/site-config', (req, res) => {
    const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
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
    const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
    
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
        let query = 'SELECT u.id, u.uid, u.username, u.role, u.status, u.last_login, u.created_at, u.email, s.is_alert_receiver, s.is_digest_receiver FROM users u LEFT JOIN user_settings s ON u.id = s.user_id WHERE 1=1';
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

        // 获取管理员总数 (Task AC.1 & DP.2)
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
        // Task 3.1: 二次身份验证
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
        }

        // Task 2024.06.10: 重置用户密码 - 临时密码安全增强
        if (newPassword) {
            // Task UM.8.2 & Task 3.1: 强制敏感操作进行二次身份验证
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
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新用户失败', details: e.message });
    }
});

// ====== 4.4 定时审计日报 API (Task N.3) ======

app.get('/api/admin/cron-digest', authenticate, adminOnly, (req, res) => {
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
            reportText += `本邮件由 Cloudflare Pages 定时触发器自动发送，请勿直接回复。`;
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

            reportText += `----------------------------------------\n本邮件由 Cloudflare Pages 定时触发器自动发送，请勿直接回复。`;
        }

        // 查询授权接收日报的用户
        const receivers = db.prepare(`
            SELECT u.email, u.telegram_chat_id 
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

        res.json({ 
            success: true, 
            message: `[Mock] 每日审计日报打包成功！已模拟打印至控制台。授权用户数: ${receivers.length}`,
            receivers: receivers.map(r => ({ email: r.email, tg: r.telegram_chat_id }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/site-config', (req, res) => {
    const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
    try {
        if (fs.existsSync(configPath)) {
            res.json(JSON.parse(fs.readFileSync(configPath, 'utf-8')));
        } else {
            res.json({
                siteTitle: "CloudNav 导航",
                faviconUrl: "/favicon.ico",
                seoKeywords: "导航, 自定义, 云端存储",
                seoDescription: "极致简洁的个人自定义导航网站",
                allowOpenRegistration: true,
                requireInvitation: false
            });
        }
    } catch (e) {
        res.status(500).json({ error: '获取站点配置失败', details: e.message });
    }
});

app.post('/api/admin/site-config', authenticate, adminOnly, (req, res) => {
    const config = req.body;
    try {
        const kvDir = path.join(__dirname, 'local_kv');
        if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);
        fs.writeFileSync(path.join(kvDir, 'site_config.json'), JSON.stringify(config, null, 2));
        
        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'UPDATE_SITE_CONFIG', JSON.stringify(config), '[Protected]');
          
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '保存站点配置失败', details: e.message });
    }
});

// ====== Task 4.2: 公告系统 (Broadcast) ======

app.get('/api/announcements', authenticate, (req, res) => {
    try {
        const userId = req.user.id || 'guest';
        
        // 增强版 SQL：通过 LEFT JOIN 检查用户的已读记录 (Task 6.23)
        const list = db.prepare(`
            SELECT a.id, a.title, a.content, a.type, a.is_top, a.created_at,
                   CASE WHEN r.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
            FROM announcements a
            LEFT JOIN announcement_read_states r ON a.id = r.announcement_id AND r.user_id = ?
            WHERE a.status = 'published' 
            AND (a.expire_at IS NULL OR datetime(replace(a.expire_at, 'T', ' ')) > datetime('now')) 
            ORDER BY a.is_top DESC, a.created_at DESC 
            LIMIT 10
        `).all(userId);
        
        const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
        let lastUpdate = '0';
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            lastUpdate = config.announcements_last_update || '0';
        }

        res.json({ 
            success: true, 
            announcements: list,
            lastUpdate: lastUpdate
        });
    } catch (e) {
        console.error('[API] Announcements error:', e.message);
        res.status(500).json({ error: '获取公告失败', details: e.message });
    }
});

// Task 6.23: 标记公告已读接口
app.post('/api/announcements/read', authenticate, (req, res) => {
    const { ids } = req.body; // 兼容单条 [id] 或多条 [id1, id2]
    const userId = req.user.id;
    if (userId === 'guest') return res.json({ success: true }); // 游客不记录持久化状态

    try {
        const insert = db.prepare('INSERT OR IGNORE INTO announcement_read_states (user_id, announcement_id) VALUES (?, ?)');
        db.transaction(() => {
            ids.forEach(id => insert.run(userId, id));
        })();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '标记已读失败', details: e.message });
    }
});

app.get('/api/admin/announcements', authenticate, adminOnly, (req, res) => {
    try {
        const list = db.prepare('SELECT * FROM announcements ORDER BY is_top DESC, created_at DESC').all();
        res.json({ success: true, announcements: list });
    } catch (e) {
        console.error('[API] Admin Announcements Get Error:', e.message);
        res.status(500).json({ error: '获取后台公告列表失败', details: e.message });
    }
});

app.post('/api/admin/announcements', authenticate, adminOnly, (req, res) => {
    const { title, content, type, is_top, expire_at } = req.body;
    try {
        // 显式指定 status = 'published' 以对齐 D1 结构
        db.prepare('INSERT INTO announcements (creator_id, title, content, type, is_top, expire_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(req.user.id, title, content, type, is_top ? 1 : 0, expire_at || null, 'published');
        
        // Task 6.20: 增强本地 KV 模拟的健壮性
        const kvDir = path.join(__dirname, 'local_kv');
        if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);

        const configPath = path.join(kvDir, 'site_config.json');
        let config = {};
        try {
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
        } catch (e) {
            console.warn('[KV] site_config.json 格式损坏，正在重置');
        }
        
        config.announcements_last_update = Date.now().toString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'CREATE_ANNOUNCEMENT', `Created announcement: ${title}`, '[Protected]');

        res.json({ success: true });
    } catch (e) {
        console.error('[API] Create Announcement Error:', e.message);
        res.status(500).json({ error: '创建公告失败', details: e.message });
    }
});

app.patch('/api/admin/announcements', authenticate, adminOnly, (req, res) => {
    let { id, title, content, type, is_top, expire_at } = req.body;
    if (!id) return res.status(400).json({ error: "Missing ID" });

    // 强制转换为数字，防止字符串匹配失败
    const targetId = Number(id);

    try {
        // 统一处理空字符串为 null，确保数据库日期比较逻辑正确
        const finalExpire = (expire_at && expire_at.trim() !== '') ? expire_at : null;

        const stmt = db.prepare('UPDATE announcements SET title = ?, content = ?, type = ?, is_top = ?, expire_at = ? WHERE id = ?');
        const info = stmt.run(title, content, type, is_top ? 1 : 0, finalExpire, targetId);

        if (info.changes === 0) {
            console.warn(`[API] Update failed: No announcement found with ID ${targetId}`);
            return res.status(404).json({ error: "更新失败：未找到对应 ID 的公告", code: "NOT_FOUND" });
        }

        // Task 6.20: 更新本地 KV 中的公告版本号
        const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config.announcements_last_update = Date.now().toString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'UPDATE_ANNOUNCEMENT', `Updated announcement ID: ${id}, Title: ${title}`, '[Protected]');

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新公告失败', details: e.message });
    }
});

app.delete('/api/admin/announcements', authenticate, adminOnly, (req, res) => {
    const { id } = req.body;
    try {
        db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

        // Task 6.20: 更新本地 KV 中的公告版本号
        const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config.announcements_last_update = Date.now().toString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`, '[Protected]');

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '删除公告失败', details: e.message });
    }
});

// ====== 4.4 个人资料 API (Task N.1) ======

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

        if (newPassword && newPassword.trim()) {
            if (!password) {
                return res.status(400).json({ error: '修改密码需要输入原密码' });
            }
            const oldHash = crypto.createHash('sha256').update(password).digest('hex');

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
            db.transaction(() => {
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
                        throw new Error('个性分享别名只允许包含英文字母、数字和横线(-)');
                    }
                    const duplicate = db.prepare('SELECT user_id FROM user_settings WHERE share_slug = ? AND user_id != ?').get(cleanSlug, req.user.id);
                    if (duplicate) {
                        throw new Error('该公开分享别名已被抢占，请换一个吧！');
                    }
                }

                db.prepare('UPDATE user_settings SET is_shared = ?, share_slug = ? WHERE user_id = ?')
                  .run(isShared ? 1 : 0, cleanSlug || null, req.user.id);
            })();
        } catch (transError) {
            return res.status(400).json({ error: transError.message });
        }

        // 同步更新本地 JSON 缓存中的用户名
        const kvPath = path.join(__dirname, 'local_kv', `user_${req.user.id}.json`);
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

// ====== 4.4 主页分享 API ======
app.get('/api/share', (req, res) => {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    try {
        const settings = db.prepare('SELECT user_id, is_shared, share_slug FROM user_settings WHERE share_slug = ? AND is_shared = 1').get(slug);
        if (!settings) return res.status(404).json({ error: 'NOT_FOUND', message: '该分享主页未开启或不存在' });
        
        const userId = settings.user_id;
        const kvPath = path.join(__dirname, 'local_kv', `user_${userId}.json`);
        if (!fs.existsSync(kvPath)) {
            return res.status(404).json({ error: 'EMPTY_DATA', message: '该用户尚未同步任何导航数据' });
        }
        
        const dataObj = JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
        
        // 严格的安全过滤脱敏，防止隐藏内容与个人隐私泄漏
        dataObj.categories = (dataObj.categories || []).filter(c => !c.hidden);
        dataObj.items = (dataObj.items || []).filter(i => !i.hidden);

        const owner = db.prepare('SELECT username, uid FROM users WHERE id = ?').get(userId);

        res.json({
            categories: dataObj.categories,
            items: dataObj.items,
            settings: dataObj.settings || {},
            isReadOnlyShare: true,
            shareOwner: owner ? owner.username : "Nav User",
            shareUid: owner ? owner.uid : null,
            shareSlug: slug
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ====== 4.4 页面数据 API ======

app.get('/api/config', authenticate, (req, res) => {
    const userId = req.user.id;
    const kvPath = path.join(__dirname, 'local_kv', `user_${userId}.json`);
    let data;
    
    if (userId === 'guest') {
        data = JSON.parse(JSON.stringify(defaultData));
    } else if (fs.existsSync(kvPath)) {
        data = JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
        // 实时数据归一化：确保字段名始终符合前端预期 (Task 2.1 容错)
        if (data.items) {
            data.items = data.items.map(i => ({
                ...i,
                catId: i.catId || i.cat_id
            }));
        }
        if (data.categories) {
            data.categories = data.categories.map(c => ({
                ...c,
                id: c.id,
                _isVideo: c._isVideo ?? !!c.is_video
            }));
        }
    } else {
        data = syncUserToKV(userId);
    }

    if (userId === 'guest') {
        data.categories = data.categories.filter(c => !c.hidden);
        data.items = data.items.filter(i => !i.hidden);
    }
    
    const quota = getQuota(req.user);
    res.json({ 
        ...data, 
        isAdmin: req.user.role === 'admin' || req.user.role === 'super_user',
        user: userId,
        uid: req.user.uid,
        username: req.user.username,
        role: req.user.role,
        quota
    });
});

app.post('/api/config', authenticate, (req, res) => {
    if (req.user.id === 'guest') return res.status(401).end();
    const { categories, items, settings, clicks_history } = req.body;
    const userId = req.user.id;
    const quota = getQuota(req.user);

    // Task 4.3: 资源配额硬核校验
    if (categories && categories.length > quota.maxCategories) {
        return res.status(403).json({ error: `分类数量已达到上限 (${quota.maxCategories})`, code: 'ERR_QUOTA_EXCEEDED' });
    }
    
    // 统计每个分类下的书签数量
    if (items) {
        const catCounts = {};
        for (const item of items) {
            const cId = item.catId || item.cat_id;
            catCounts[cId] = (catCounts[cId] || 0) + 1;
            if (catCounts[cId] > quota.maxItemsPerCategory) {
                return res.status(403).json({ error: `单个分类下的书签不能超过 ${quota.maxItemsPerCategory} 个`, code: 'ERR_QUOTA_EXCEEDED' });
            }
        }
    }

    db.transaction(() => {
        db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
        categories.forEach((cat, idx) => {
            db.prepare('INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)').run(cat.id, userId, cat.name, cat.icon, idx, cat._isVideo ? 1 : 0, cat.hidden ? 1 : 0);
        });
        items.forEach((item, idx) => {
            const targetCatId = item.catId || item.cat_id;
            db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(item.id, userId, targetCatId, item.title, item.url, item.desc, item.icon, item.bg_color, idx, item.hidden ? 1 : 0);
        });
        if (settings) {
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, hide_bg_mask = ?, isolated_view = ?, density = ?, simple_mode = ?, open_in_new_tab = ?, theme_mode = ? WHERE user_id = ?').run(
                settings.cardWidth, 
                settings.zenMode ? 1 : 0, 
                settings.showFrequent ? 1 : 0, 
                settings.bgUrl, 
                settings.hideBgMask ? 1 : 0, 
                settings.isolatedView ? 1 : 0,
                settings.density || 'standard',
                settings.simpleMode ? 1 : 0, 
                settings.openInNewTab ? 1 : 0, 
                settings.themeMode, 
                userId
            );
        }
    })();
    
    // 关键加固：在同步到 KV 时保留点击历史 (Task 2.5.4)
    const currentData = syncUserToKV(userId);
    if (clicks_history) {
        currentData.clicks_history = clicks_history;
        const kvPath = path.join(__dirname, 'local_kv', `user_${userId}.json`);
        fs.writeFileSync(kvPath, JSON.stringify(currentData, null, 2));
    }
    
    res.json({ success: true });
});

app.delete('/api/config', authenticate, (req, res) => {
    const userId = req.user.id;
    if (userId === 'guest') return res.status(401).end();

    console.log(`[Config] Resetting data for user: ${userId}`);
    const onboardingData = getOnboardingData();

    try {
        db.transaction(() => {
            // 1. 清理该用户的所有旧数据
            db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
            
            // 2. 重置用户设置到模板状态
            const s = onboardingData.settings || {};
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = 1, bg_url = NULL, hide_bg_mask = ?, simple_mode = 0, open_in_new_tab = ?, theme_mode = \'auto\' WHERE user_id = ?').run(
                s.cardWidth || 125, s.zenMode ? 1 : 0, s.hideBgMask ? 1 : 0, s.openInNewTab ? 1 : 0, userId
            );
            
            // 3. 重新注入最新的模板
            for (const cat of onboardingData.categories) {
                const newCatId = crypto.randomUUID();
                db.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)').run(newCatId, userId, cat.name, cat.icon, cat.hidden ? 1 : 0);
                
                const catItems = onboardingData.items.filter(i => (i.catId || i.cat_id) === cat.id);
                for (const item of catItems) {
                    const newItemId = crypto.randomUUID();
                    db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(newItemId, userId, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0);
                }
            }
        })();

        // 3. 强制物理删除旧缓存文件，确保下一次 GET 请求触发新鲜同步 (Task 2.1 强一致性)
        const kvPath = path.join(__dirname, 'local_kv', `user_${userId}.json`);
        if (fs.existsSync(kvPath)) {
            fs.unlinkSync(kvPath);
        }

        // 4. 立即执行一次同步
        syncUserToKV(userId);
        
        console.log(`[Config] Reset success and cache cleared for user: ${userId}`);
        res.json({ success: true, message: "已恢复默认配置" });
    } catch (e) {
        console.error('[Config] Reset Error:', e.message);
        res.status(500).json({ error: 'Reset failed', details: e.message });
    }
});

app.use(express.static(path.join(__dirname, 'nav-main/public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'nav-main/public/index.html')));

app.listen(PORT, () => console.log(`CloudNav refactored server running on port ${PORT}`));
