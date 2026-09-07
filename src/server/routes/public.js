import { parse } from 'node-html-parser';
import { authenticate } from '../middleware.js';
import { db } from '../db.js';
import { syncUserToKV } from '../kv.js';
import { filterHiddenNav, navSnapshotIsEmpty, sharePagePayload } from '../../../nav-main/shared/share-page.js';

export function registerPublicRoutes(app) {
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
                // 后端标准化，补全绝对路径，与 Worker 保持逻辑一致
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

app.get('/api/share', (req, res) => {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    try {
        const settings = db.prepare('SELECT user_id, is_shared, share_slug FROM user_settings WHERE share_slug = ? AND is_shared = 1').get(slug);
        if (!settings) return res.status(404).json({ error: 'NOT_FOUND', message: '该分享主页未开启或不存在' });

        const userId = settings.user_id;
        // 分享页以 SQL 为准，避免 KV 快照停留在注册时的默认主页
        const dataObj = syncUserToKV(userId);
        const publicNav = filterHiddenNav(dataObj);
        if (navSnapshotIsEmpty(publicNav)) {
            return res.status(404).json({ error: 'EMPTY_DATA', message: '该用户尚未同步任何导航数据' });
        }

        const owner = db.prepare('SELECT username, uid FROM users WHERE id = ?').get(userId);
        res.json(sharePagePayload(publicNav, owner, slug));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
