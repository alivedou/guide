import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { defaultData } from '../../../nav-main/shared/default-data.js';
import { formatCNTime } from '../../../nav-main/shared/time.js';
import { KV_DIR } from '../config.js';
import { db } from '../db.js';
import { authenticate } from '../middleware.js';
import { getQuota } from '../quota.js';
import { getOnboardingData, syncUserToKV } from '../kv.js';

export function registerConfigRoutes(app) {
app.get('/api/config', authenticate, (req, res) => {
    const userId = req.user.id;
    const kvPath = path.join(KV_DIR, `user_${userId}.json`);
    let data;

    if (userId === 'guest') {
        data = JSON.parse(JSON.stringify(defaultData));
    } else if (fs.existsSync(kvPath)) {
        data = JSON.parse(fs.readFileSync(kvPath, 'utf-8'));
        // 实时数据归一化：确保字段名始终符合前端预期 容错)
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

    // 资源配额硬核校验
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

    try {
    // categories.id / items.id 为全局主键；必须重映射，否则跨用户导入/默认模板同 id 会 UNIQUE 冲突
    // （与 CF Functions config.js 行为对齐）
    const catIdMap = new Map();
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeItems = Array.isArray(items) ? items : [];

    db.transaction(() => {
        db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM items WHERE user_id = ?').run(userId);
        safeCategories.forEach((cat, idx) => {
            const oldId = cat.id || `temp_cat_${idx}`;
            const newId = crypto.randomUUID();
            catIdMap.set(oldId, newId);
            db.prepare('INSERT INTO categories (id, user_id, name, icon, sort_order, is_video, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                newId,
                userId,
                cat.name || '未命名分类',
                cat.icon !== undefined ? cat.icon : '📌',
                idx,
                cat._isVideo ? 1 : 0,
                cat.hidden ? 1 : 0
            );
        });
        safeItems.forEach((item, idx) => {
            const oldCatId = item.catId || item.cat_id;
            let targetCatId = catIdMap.get(oldCatId);
            if (!targetCatId) {
                targetCatId = catIdMap.values().next().value || null;
            }
            const newItemId = crypto.randomUUID();
            db.prepare('INSERT INTO items (id, user_id, cat_id, title, url, desc, icon, bg_color, sort_order, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                newItemId,
                userId,
                targetCatId,
                item.title || '未命名书签',
                item.url || '',
                item.desc !== undefined ? item.desc : null,
                item.icon !== undefined ? item.icon : null,
                item.bg_color || '',
                idx,
                item.hidden ? 1 : 0
            );
        });
        if (settings) {
            const linkTarget = settings.link_target || '_blank';
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = ?, bg_url = ?, hide_bg_mask = ?, isolated_view = ?, density = ?, simple_mode = ?, link_target = ?, theme_mode = ?, sync_interval = ? WHERE user_id = ?').run(
                settings.cardWidth,
                settings.zenMode ? 1 : 0,
                settings.showFrequent ? 1 : 0,
                settings.bgUrl,
                settings.hideBgMask ? 1 : 0,
                settings.isolatedView ? 1 : 0,
                settings.density || 'standard',
                settings.simpleMode ? 1 : 0,
                linkTarget,
                settings.themeMode,
                settings.syncInterval !== undefined ? settings.syncInterval : 7,
                userId
            );
        }
    })();

    // 关键加固：在同步到 KV 时保留点击历史
    const currentData = syncUserToKV(userId);
    currentData.lastUpdated = formatCNTime(new Date());
    if (clicks_history) {
        currentData.clicks_history = clicks_history;
    }
    const kvPath = path.join(KV_DIR, `user_${userId}.json`);
    fs.writeFileSync(kvPath, JSON.stringify(currentData, null, 2));

    res.json({ success: true });
    } catch (e) {
        console.error('[Config] POST /api/config failed:', e && e.message);
        if (e && e.message && e.message.includes('UNIQUE')) {
            return res.status(409).json({
                error: '数据 ID 冲突，请重新导出后再导入，或刷新页面后重试同步',
                code: 'ERR_ID_CONFLICT'
            });
        }
        return res.status(500).json({
            error: e.message || '保存配置失败',
            code: 'ERR_CONFIG_SAVE'
        });
    }
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
            const linkTarget = s.link_target || '_blank';
            db.prepare('UPDATE user_settings SET card_width = ?, zen_mode = ?, show_frequent = 1, bg_url = NULL, hide_bg_mask = ?, simple_mode = 0, link_target = ?, theme_mode = \'auto\', sync_interval = 7 WHERE user_id = ?').run(
                s.cardWidth || 125, s.zenMode ? 1 : 0, s.hideBgMask ? 1 : 0, linkTarget, userId
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

        // 3. 强制物理删除旧缓存文件，确保下一次 GET 请求触发新鲜同步 强一致性)
        const kvPath = path.join(KV_DIR, `user_${userId}.json`);
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
}
