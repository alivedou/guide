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
    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC').all(userId);
    const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort_order ASC').all(userId);
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    
    const userData = {
        categories: categories.map(c => ({...c, _isVideo: !!c.is_video, hidden: !!c.hidden})),
        items: items.map(i => ({...i, hidden: !!i.hidden})),
        settings: settings || defaultData.settings
    };
    
    const kvDir = path.join(__dirname, 'local_kv');
    if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);
    fs.writeFileSync(path.join(kvDir, `user_${userId}.json`), JSON.stringify(userData, null, 2));
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
            
            // 初始化设置
            db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(uuid);
            
            // 为新用户注入默认模板 (需求 4.4 / 4.6)
            // 注意：必须生成唯一的 ID 避免冲突
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
    if (userId === 'guest') data = JSON.parse(JSON.stringify(defaultData));
    else if (fs.existsSync(kvPath)) data = JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
    else data = syncUserToKV(userId);

    if (userId === 'guest') {
        data.categories = data.categories.filter(c => !c.hidden);
        data.items = data.items.filter(i => !i.hidden);
    }
    res.json({ ...data, isAdmin: req.user.role === 'admin' || req.user.role === 'super_user' });
});

app.post('/api/config', authenticate, (req, res) => {
    if (req.user.id === 'guest') return res.status(401).end();
    const { categories, items, settings } = req.body;
    const userId = req.user.id;

    if (categories.length > 20) return res.status(403).json({ error: 'Quota exceeded' });

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
    syncUserToKV(userId);
    res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'nav-main/public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'nav-main/public/index.html')));

app.listen(PORT, () => console.log(`CloudNav refactored server running on port ${PORT}`));
