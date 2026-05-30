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
 * 6 级图标自愈引擎 (Task 3.1)
 * @param {HTMLImageElement} img - 触发错误的图片元素
 * @param {string} originalUrl - 原始链接 (用于提取域名)
 */
const handleIconError = (img, originalUrl) => {
    // 防止死循环：如果已经是 span 了就不处理（通常不会发生，因为这是 img 的 onerror）
    if (!img || img.tagName !== 'IMG') return;

    // 获取当前尝试次数
    let retryIndex = parseInt(img.getAttribute('data-retry-index') || '0');
    retryIndex++;
    img.setAttribute('data-retry-index', retryIndex);

    // 提取域名 (用于各种 Favicon API)
    let domain = '';
    try {
        const url = new URL(originalUrl.startsWith('http') ? originalUrl : `https://${originalUrl}`);
        domain = url.hostname;
    } catch (e) {
        domain = originalUrl.split('/')[0];
    }

    const apis = [
        null, // 0: 原始 URL (已失败)
        `https://api.iowen.cn/favicon/${domain}.png`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];

    if (retryIndex < apis.length) {
        console.warn(`[IconHeal] Level ${retryIndex} failover for ${domain}`);
        img.src = apis[retryIndex];
    } else {
        // Level 6: 终极兜底 - 替换为文字/Emoji 磁贴
        console.error(`[IconHeal] All fallbacks failed for ${domain}, using text placeholder.`);
        const parent = img.parentElement;
        if (parent) {
            const char = domain.charAt(0).toUpperCase() || '🔗';
            const span = document.createElement('span');
            span.className = 'emoji-icon';
            span.innerText = char;
            
            // Task 2.3: 增加颜色自愈 - 基于域名生成背景色
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
