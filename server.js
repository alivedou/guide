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

// 自动执行所有迁移文件 (Task 5.5.2)
const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).sort();
    files.forEach(file => {
        if (file.endsWith('.sql')) {
            console.log(`[DB] Executing migration: ${file}`);
            db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
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
    }
} catch (e) {
    console.warn('[DB] Auto-patch skipped:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cloudnav-secret-2026';
const secret = new TextEncoder().encode(JWT_SECRET);

// ====== Task 4.3: 登录防爆破模拟 ======
const loginAttempts = new Map(); // IP -> { count, lockUntil }

// ====== 鉴权中间件 ======
const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { req.user = { role: 'guest', id: 'guest' }; return next(); }
    
    try {
        const { payload } = await jose.jwtVerify(token, secret);
        req.user = payload;
        next();
    } catch (err) {
        console.error('[Auth] Token verification failed:', err.message);
        // 区分过期与其他错误
        const status = err.code === 'ERR_JWT_EXPIRED' ? 401 : 403;
        return res.status(status).json({ error: 'Invalid or expired token', code: err.code });
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

    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const isFirstUser = userCount === 0;
        const role = isFirstUser ? 'admin' : 'user';

        // 策略拦截
        if (!isFirstUser) {
            if (config.requireInvitation) {
                if (!inviteCode) return res.status(403).json({ error: '请提供邀请码' });
                const invite = db.prepare('SELECT status FROM invitation_codes WHERE code = ? AND status = "unused"').get(inviteCode);
                if (!invite) return res.status(403).json({ error: '无效或已被使用的邀请码' });
            } else if (!config.allowOpenRegistration) {
                return res.status(403).json({ error: '系统当前暂停注册，请联系管理员' });
            }
        }
        
        console.log(`[Auth] Creating user ${username} with role: ${role}`);

        const onboardingData = getOnboardingData();

        db.transaction(() => {
            db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(uuid, username, passwordHash, role);
            
            // 使用模板设置
            const s = onboardingData.settings || {};
            db.prepare('INSERT INTO user_settings (user_id, card_width, zen_mode, open_in_new_tab) VALUES (?, ?, ?, ?)').run(
                uuid, s.cardWidth || 125, s.zenMode ? 1 : 0, s.openInNewTab ? 1 : 0
            );
            
            if (!isFirstUser && inviteCode) {
                db.prepare('UPDATE invitation_codes SET status = "used", used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?').run(uuid, inviteCode);
            }

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
        res.json({ success: true, role });
    } catch (e) { 
        res.status(400).json({ error: 'Username already exists or database error' }); 
    }
});

// ====== Task 4.4: 邀请码管理 API ======

app.get('/api/admin/invitations', authenticate, adminOnly, (req, res) => {
    try {
        const list = db.prepare(`
            SELECT ic.*, u2.username as used_by_name 
            FROM invitation_codes ic
            LEFT JOIN users u2 ON ic.used_by = u2.id
            ORDER BY ic.created_at DESC
        `).all();
        res.json({ success: true, invitations: list });
    } catch (e) {
        res.status(500).json({ error: '获取邀请码失败', details: e.message });
    }
});

app.post('/api/admin/invitations', authenticate, adminOnly, (req, res) => {
    const { count } = req.body;
    try {
        db.transaction(() => {
            for (let i = 0; i < (count || 1); i++) {
                const code = Math.random().toString(36).substring(2, 10).toUpperCase();
                db.prepare('INSERT INTO invitation_codes (code, creator_id) VALUES (?, ?)').run(code, req.user.id);
            }
        })();

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'BATCH_GENERATE_INVITATIONS', `Generated ${count || 1} codes`, req.ip);

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
          .run(req.user.id, 'DELETE_INVITATION', `Deleted code: ${code}`, req.ip);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '删除邀请码失败', details: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip;
    console.log(`[Auth] Login attempt for user: ${username} from IP: ${ip}`);

    // 防爆破检查
    const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    if (attempt.lockUntil > Date.now()) {
        const waitMin = Math.ceil((attempt.lockUntil - Date.now()) / 60000);
        console.warn(`[Auth] IP ${ip} is currently locked out`);
        return res.status(429).json({ error: `登录尝试过多，请在 ${waitMin} 分钟后再试` });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
        console.warn(`[Auth] User not found: ${username}`);
        return recordLoginFailure(ip, res);
    }

    if (user.password_hash !== hash) {
        console.warn(`[Auth] Password mismatch for user: ${username}`);
        return recordLoginFailure(ip, res);
    }

    // Task 5.5.2: 检查账号状态 (冻结逻辑)
    if (user.status === 'frozen') {
        console.warn(`[Auth] Account frozen: ${username}`);
        return res.status(403).json({ error: '账号已被冻结，请联系管理员', code: 'ACCOUNT_FROZEN' });
    }
    
    // 登录成功，重置尝试次数
    loginAttempts.delete(ip);
    console.log(`[Auth] Login successful: ${username} (${user.role})`);
    
    const token = await new jose.SignJWT({ id: user.id, username: user.username, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d') // Task 4.3: 设置 7 天过期
        .sign(secret);
        
    res.json({ success: true, token, user: { username: user.username, role: user.role } });
});

// 辅助函数：记录登录失败
function recordLoginFailure(ip, res) {
    const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    attempt.count++;
    if (attempt.count >= 5) {
        attempt.lockUntil = Date.now() + 10 * 60 * 1000;
        console.log(`[Security] IP ${ip} locked for 10 mins due to failures`);
    }
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: '用户名或密码错误' });
}

// ====== Task 4.1: 管理员管控枢纽 (Admin Hub) ======

app.get('/api/admin/users', authenticate, adminOnly, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role, status, last_login, created_at FROM users ORDER BY created_at DESC').all();
        res.json({ success: true, users });
    } catch (e) {
        res.status(500).json({ error: '获取用户列表失败', details: e.message });
    }
});

app.patch('/api/admin/users', authenticate, adminOnly, (req, res) => {
    const { userId, status, role, adminPassword } = req.body;
    try {
        // Task 3.1: 二次身份验证
        if (adminPassword) {
            const adminUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
            const adminHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
            if (adminUser.password_hash !== adminHash) {
                return res.status(401).json({ error: '管理员身份验证失败' });
            }
        }

        if (status) {
            db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
            db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
              .run(req.user.id, 'CHANGE_USER_STATUS', `Changed user ${userId} status to ${status}`, req.ip);
        }

        if (role) {
            if (req.user.role !== 'admin') return res.status(403).json({ error: '权限不足' });
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
            db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
              .run(req.user.id, 'CHANGE_USER_ROLE', `Changed user ${userId} role to ${role}`, req.ip);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新用户失败', details: e.message });
    }
});

app.get('/api/admin/site-config', authenticate, adminOnly, (req, res) => {
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
          .run(req.user.id, 'UPDATE_SITE_CONFIG', JSON.stringify(config), req.ip);
          
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
        db.prepare('INSERT INTO announcements (creator_id, title, content, type, is_top, expire_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.user.id, title, content, type, is_top ? 1 : 0, expire_at || null);
        
        // Task 6.20: 更新本地 KV 中的公告版本号
        const configPath = path.join(__dirname, 'local_kv', 'site_config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        config.announcements_last_update = Date.now().toString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        db.prepare('INSERT INTO audit_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'CREATE_ANNOUNCEMENT', `Created announcement: ${title}`, req.ip);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '创建公告失败', details: e.message });
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
          .run(req.user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`, req.ip);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '删除公告失败', details: e.message });
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
    res.json({ ...data, isAdmin: req.user.role === 'admin' || req.user.role === 'super_user' });
});

app.post('/api/config', authenticate, (req, res) => {
    if (req.user.id === 'guest') return res.status(401).end();
    const { categories, items, settings, clicks_history } = req.body;
    const userId = req.user.id;

    // Task 4.3: 资源配额硬核校验
    if (categories && categories.length > 20) {
        return res.status(403).json({ error: '分类数量超出上限 (20)', code: 'ERR_QUOTA_EXCEEDED' });
    }
    
    // 统计每个分类下的书签数量
    if (items) {
        const catCounts = {};
        for (const item of items) {
            const cId = item.catId || item.cat_id;
            catCounts[cId] = (catCounts[cId] || 0) + 1;
            if (catCounts[cId] > 100) {
                return res.status(403).json({ error: '单个分类下的书签不能超过 100 个', code: 'ERR_QUOTA_EXCEEDED' });
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
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, simple_mode = ?, open_in_new_tab = ?, theme_mode = ? WHERE user_id = ?').run(
                settings.cardWidth, settings.zenMode ? 1 : 0, settings.showFrequent ? 1 : 0, settings.bgUrl, settings.simpleMode ? 1 : 0, settings.openInNewTab ? 1 : 0, settings.themeMode, userId
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
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = 1, bg_url = NULL, simple_mode = 0, open_in_new_tab = ?, theme_mode = \'auto\' WHERE user_id = ?').run(
                s.cardWidth || 125, s.zenMode ? 1 : 0, s.openInNewTab ? 1 : 0, userId
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
