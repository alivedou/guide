import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { defaultData } from './nav-main/functions/api/defaultData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ====== SHA-256 哈希辅助函数用于校验管理员令牌 ======
const TOKEN_ENV = process.env.TOKEN || "";
let expectedToken = TOKEN_ENV;
if (expectedToken.length !== 64) {
    expectedToken = crypto.createHash('sha256').update(TOKEN_ENV).digest('hex');
}

function formatCNTime(date) {
    try {
        const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
        const d = new Date();
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}

// 模拟 KV 存储，在没有 Cloudflare binding 时在本地用 json 代替，实现离线/在线一键全通！
let localKVData = null;
const kvFilePath = path.join(__dirname, 'kv_mock.json');

const loadKV = () => {
    try {
        if (fs.existsSync(kvFilePath)) {
            return JSON.parse(fs.readFileSync(kvFilePath, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to load mock KV:', e);
    }
    // 首次运行时深度克隆默认数据作为初始配置
    return JSON.parse(JSON.stringify(defaultData));
};

const saveKV = (data) => {
    try {
        fs.writeFileSync(kvFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
         console.error('Failed to write mock KV:', e);
    }
};

localKVData = loadKV();

// 静态资源托管
app.use(express.static(path.join(__dirname, 'nav-main/public')));

// 模拟 API KV 端点 - 与 Cloudflare functions 逻辑完美契合且默认加载数据
app.get('/api/config', (req, res) => {
    const auth = req.headers['authorization'] || req.query.token || '';
    const isAdmin = (auth === expectedToken);

    // 复制局部数据以防外部污染
    let dataObj = JSON.parse(JSON.stringify(localKVData || defaultData));

    // 非管理员，过滤掉 hidden 内容
    if (!isAdmin) {
        if (dataObj.categories) {
            dataObj.categories = dataObj.categories.filter(c => !c.hidden);
        }
        if (dataObj.items) {
            dataObj.items = dataObj.items.filter(i => !i.hidden);
        }
    }

    const bgUrl = dataObj.settings?.bgUrl || "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920";

    res.json({
        ...dataObj,
        bgUrl,
        isAdmin,
        lastUpdated: dataObj.lastUpdated || formatCNTime(new Date())
    });
});

app.post('/api/config', (req, res) => {
    const auth = req.headers['authorization'] || '';
    if (auth !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized', message: '权限不足' });
    }

    const data = req.body;
    data.lastUpdated = formatCNTime(new Date());
    localKVData = data;
    saveKV(data);
    res.json({ success: true });
});

app.delete('/api/config', (req, res) => {
    const auth = req.headers['authorization'] || '';
    if (auth !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized', message: '权限不足' });
    }

    const resetData = JSON.parse(JSON.stringify(defaultData));
    resetData.lastUpdated = formatCNTime(new Date());
    localKVData = resetData;
    saveKV(resetData);
    res.json({ success: true, message: '已重置为默认配置' });
});

// 其它路由兜底
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'nav-main/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Development static host server listening on port ${PORT}`);
});

