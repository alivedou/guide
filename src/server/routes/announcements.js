import fs from 'fs';
import path from 'path';
import { KV_DIR } from '../config.js';
import { db } from '../db.js';
import { authenticate, adminOnly } from '../middleware.js';

export function registerAnnouncementRoutes(app) {
app.get('/api/announcements', authenticate, (req, res) => {
    try {
        const userId = req.user.id || 'guest';

        // 增强版 SQL：通过 LEFT JOIN 检查用户的已读记录
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

        const configPath = path.join(KV_DIR, 'site_config.json');
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

// 标记公告已读接口
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

        // 增强本地 KV 模拟的健壮性
        const kvDir = KV_DIR;
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

        // 更新本地 KV 中的公告版本号
        const configPath = path.join(KV_DIR, 'site_config.json');
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

        // 更新本地 KV 中的公告版本号
        const configPath = path.join(KV_DIR, 'site_config.json');
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
}
