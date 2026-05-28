import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { defaultData } from './nav-main/functions/api/defaultData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== 初始化本地数据库 (模拟 D1) ======
const dbPath = path.join(__dirname, 'local_d1.db');
const db = new Database(dbPath);
db.exec(fs.readFileSync(path.join(__dirname, 'migrations/0000_init.sql'), 'utf-8'));

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cloudnav-secret-2026';

app.use(express.json({ limit: '10mb' }));

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

// ====== 鉴权中间件 ======
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { req.user = { role: 'guest', id: 'guest' }; return next(); }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// ====== 4.3 认证 API ======

app.post('/api/auth/register', (req, res) => {
    console.log('[Auth] Register request:', req.body.username);
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const uuid = crypto.randomUUID();

    try {
        // Task 1.3: 自动提升逻辑
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const role = userCount === 0 ? 'admin' : 'user';
        
        console.log(`[Auth] Creating user ${username} with role: ${role}`);

        // Task 1.2: D1 事务处理
        db.transaction(() => {
            db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(uuid, username, passwordHash, role);
            
            // 初始化设置 (显式设定 zen_mode 为 1，确保新用户立即获得沉浸体验)
            db.prepare('INSERT INTO user_settings (user_id, zen_mode) VALUES (?, 1)').run(uuid);
            
            // 为新用户注入默认模板 (需求 4.4 / 4.6)
            for (const cat of defaultData.categories) {
                const newCatId = crypto.randomUUID();
                db.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)').run(newCatId, uuid, cat.name, cat.icon, cat.hidden ? 1 : 0);
                
                // 查找该分类下的所有项目并关联到新分类 ID
                const catItems = defaultData.items.filter(i => i.catId === cat.id);
                for (const item of catItems) {
                    const newItemId = crypto.randomUUID();
                    db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(newItemId, uuid, newCatId, item.title, item.url, item.desc, item.icon, item.hidden ? 1 : 0);
                }
            }
        })();
        
        // Task 1.2: 预热缓存 (Sync to local_kv)
        syncUserToKV(uuid);
        console.log('[Auth] Register success for:', username);
        res.json({ success: true, role });
    } catch (e) { 
        console.error('[Auth] Register Error:', e.message);
        res.status(400).json({ error: 'Username already exists or database error' }); 
    }
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').get(username, hash);
    if (!user) return res.status(401).json({ error: 'Auth failed' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ success: true, token, user: { username: user.username, role: user.role } });
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

    if (categories && categories.length > 20) return res.status(403).json({ error: 'Quota exceeded' });

    db.transaction(() => {
        db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
        categories.forEach((cat, idx) => {
            db.prepare('INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)').run(cat.id, userId, cat.name, cat.icon, idx, cat._isVideo ? 1 : 0, cat.hidden ? 1 : 0);
        });
        items.forEach((item, idx) => {
            db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(item.id, userId, item.catId, item.title, item.url, item.desc, item.icon, item.bg_color, idx, item.hidden ? 1 : 0);
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
    try {
        db.transaction(() => {
            // 1. 清理该用户的所有旧数据
            db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
            
            // 2. 重置用户设置到默认状态 (确保 Zen Mode 等生效)
            db.prepare('UPDATE user_settings SET card_width = 125, zen_mode = 1, show_frequent = 1, bg_url = NULL, simple_mode = 0, open_in_new_tab = 1, theme_mode = \'auto\' WHERE user_id = ?').run(userId);
            
            // 3. 重新注入最新的 defaultData 模板 (精选的 20 个站点)
            for (const cat of defaultData.categories) {
                const newCatId = crypto.randomUUID();
                db.prepare('INSERT INTO categories (id, user_id, name, icon, hidden) VALUES (?, ?, ?, ?, ?)').run(newCatId, userId, cat.name, cat.icon, cat.hidden ? 1 : 0);
                
                const catItems = defaultData.items.filter(i => i.catId === cat.id);
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
