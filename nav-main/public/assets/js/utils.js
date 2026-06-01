/**
 * ==========================================
 * utils.js - 通用工具函数库
 * ==========================================
 */

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} - 防抖后的函数
 * @description 在连续触发时，只执行最后一次调用
 */
const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

/**
 * HTML 转义函数
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的安全字符串
 * @description 防止 XSS 攻击，将特殊字符转换为 HTML 实体
 */
const escapeHTML = (str) => {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
};

/**
 * 备用 Emoji 列表
 * @description 当图标加载失败时随机显示的 Emoji
 */
const FALLBACK_EMOJIS = ['🌍', '🌟', '🚀', '💡', '🔥', '✨', '🎈', '🎉', '🍀', '💎', '🧭', '🛸', '🔮', '🧩', '🎨'];

/**
 * 获取随机 Emoji
 * @returns {string} - 随机 Emoji 字符
 */
const getRandomEmoji = () => FALLBACK_EMOJIS[Math.floor(Math.random() * FALLBACK_EMOJIS.length)];

/**
 * 3 级极速图标自愈引擎 (大陆网络高敏优化)
 * @param {HTMLImageElement} img - 触发错误的图片元素
 * @param {string} originalUrl - 原始链接 (用于提取域名)
 */
const handleIconError = (img, originalUrl) => {
    // 防止死循环：如果已经是 span 了就不处理
    if (!img || img.tagName !== 'IMG') return;
    if (img.getAttribute('data-healing') === 'done') return;

    // 清理可能存在的旧定时器
    if (img.timeout) {
        clearTimeout(img.timeout);
        img.timeout = null;
    }

    // 获取当前尝试次数
    let retryIndex = parseInt(img.getAttribute('data-retry-index') || '0');
    retryIndex++;
    img.setAttribute('data-retry-index', retryIndex);

    // 提取域名和 Origin
    let domain = '';
    let origin = '';
    try {
        const urlObj = new URL(originalUrl.startsWith('http') ? originalUrl : `https://${originalUrl}`);
        domain = urlObj.hostname;
        origin = urlObj.origin;
    } catch (e) {
        const match = originalUrl.match(/https?:\/\/([^\/]+)/);
        if (match) {
            domain = match[1];
            origin = match[0];
        } else {
            domain = originalUrl.split('/')[0] || '';
            origin = domain ? `https://${domain}` : '';
        }
    }

    if (!domain) {
        fallbackToText(img, '🔗');
        return;
    }

    const nextStep = () => {
        let currentIdx = parseInt(img.getAttribute('data-retry-index') || '0');
        img.setAttribute('data-retry-index', currentIdx.toString()); // 会在 handleIconError 中被自增
        handleIconError(img, originalUrl);
    };

    // 绑定正常加载成功时的清理函数
    img.onload = () => {
        if (img.timeout) {
            clearTimeout(img.timeout);
            img.timeout = null;
        }
    };

    // Level 1: 尝试原站根目录 favicon.ico
    if (retryIndex === 1) {
        const rootFav = origin ? `${origin}/favicon.ico` : '';
        if (rootFav && img.src !== rootFav) {
            img.src = rootFav;
        } else {
            nextStep();
        }
        return;
    }

    // Level 2: Iowen API (国内较稳)
    if (retryIndex === 2) {
        img.src = `https://api.iowen.cn/favicon/${domain}.png`;
        return;
    }

    // Level 3: 终极兜底 - 替换为文字/Emoji 磁贴
    fallbackToText(img, domain);
};

const fallbackToText = (img, domain) => {
    img.onerror = null;
    img.onload = null;
    img.setAttribute('data-healing', 'done');
    if (img.timeout) clearTimeout(img.timeout);

    const parent = img.parentElement;
    if (parent) {
        const title = img.getAttribute('data-title') || '';
        let char = '';
        if (title && title.trim() !== '') {
            char = title.trim().charAt(0);
            // 如果是单英文字母，强制大写以保持规整美观
            if (/^[a-zA-Z]$/.test(char)) {
                char = char.toUpperCase();
            }
        } else {
            char = domain.split('.').filter(s => s !== 'www')[0]?.[0] || domain.charAt(0).toUpperCase() || '🔗';
        }
        const span = document.createElement('span');
        span.className = 'emoji-icon';
        span.innerText = char;
        
        // 基于域名生成背景色
        const hue = Array.from(domain).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
        span.style.background = `hsla(${hue}, 70%, 45%, 0.8)`;
        span.style.color = '#fff';
        span.style.borderRadius = '8px';
        span.style.width = '100%';
        span.style.height = '100%';
        span.style.display = 'flex';
        span.style.alignItems = 'center';
        span.style.justifyContent = 'center';
        
        parent.replaceChild(span, img);
    }
};

// 导出工具函数（全局挂载）
window.utils = {
    debounce,
    escapeHTML,
    getRandomEmoji,
    FALLBACK_EMOJIS,
    handleIconError
};
