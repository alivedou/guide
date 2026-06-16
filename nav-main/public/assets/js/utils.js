/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

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

    // 移除 HTML 上的 inline onload 和 onerror，防止干扰后续程序赋值的 onload/onerror 行为
    img.removeAttribute('onload');
    img.removeAttribute('onerror');

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
        handleIconError(img, originalUrl);
    };

    // 绑定正常加载成功时的清理函数
    img.onload = () => {
        if (img.timeout) {
            clearTimeout(img.timeout);
            img.timeout = null;
        }
        let currentRetry = parseInt(img.getAttribute('data-retry-index') || '0');
        // 检测是否加载了 1x1 透明占位图 (SW 返回的 404/错误兜底图)
        if (img.naturalWidth && img.naturalWidth <= 1) {
            console.log(`[IconHealer] 1x1 placeholder loaded at level ${currentRetry} for ${domain}`);
            if (currentRetry < 4) {
                nextStep();
            } else {
                fallbackToText(img, domain);
            }
        } else {
            // Level 级别校验：如果是 API 或者尝试次数过多，且图片本身过小或过单调，强制 fallback
            if (currentRetry >= 4 && img.naturalWidth < 16) {
                console.log(`[IconHealer] Small/Suspicious icon detected for: ${domain}, forcing fallback.`);
                fallbackToText(img, domain);
            }
        }
    };
    
    // 明确绑定 onerror 事件，确保加载失败时能触发流程
    img.onerror = () => {
        nextStep();
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

    // Level 2: DuckDuckGo API (不报 404，极速响应，包含 200 代码的保底灰地球)
    if (retryIndex === 2) {
        img.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        return;
    }

    // Level 3: Google S2 API (高分辨率，200 OK 灰地球保底)
    if (retryIndex === 3) {
        img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        return;
    }

    // Level 4: Iowen API (备用中国服务器环境)
    if (retryIndex === 4) {
        img.src = `https://api.iowen.cn/favicon/${domain}.png`;
        return;
    }

    // Level 5: 终极兜底 - 替换为文字/Emoji 磁贴
    fallbackToText(img, domain);
};

/**
 * 第一次或者后续加载成功时的触发函数
 * 为了兼容 Service Worker 劫持了 HTTP/CORS 异常返回 1x1 状态为 200 OK 像素点的情况。
 * 由于 200 OK 会直接触发 image 的 onload，导致外部声明的 onerror 无法执行。
 * 在此通过 onload 拦截 1x1，并注入进入 handleIconError 自愈机制。
 * @param {HTMLImageElement} img - 图标元素
 * @param {string} originalUrl - 原始链接
 */
const handleIconLoad = (img, originalUrl) => {
    if (!img || img.tagName !== 'IMG') return;
    if (img.getAttribute('data-healing') === 'done') return;

    // 当图片加载成功，由于 1x1 是透明点，如果 naturalWidth <= 1 则认定为 Service Worker 的 404 拦截代理
    if (img.naturalWidth && img.naturalWidth <= 1) {
        console.log(`[IconHealer] 1x1 Transparent placeholder detected via handleIconLoad for: ${originalUrl}. Running self-healing.`);
        handleIconError(img, originalUrl);
    }
};

const fallbackToText = (img, domain) => {
    img.onerror = null;
    img.onload = null;
    img.removeAttribute('onload');
    img.removeAttribute('onerror');
    img.setAttribute('data-healing', 'done');
    if (img.timeout) clearTimeout(img.timeout);

    const parent = img.parentElement;
    if (parent) {
        const title = img.getAttribute('data-title') || '';
        let char = '';
        if (title && title.trim() !== '') {
            char = title.trim().charAt(0);
            if (/^[a-zA-Z]$/.test(char)) {
                char = char.toUpperCase();
            }
        } else {
            char = domain.split('.').filter(s => s !== 'www')[0]?.[0] || domain.charAt(0).toUpperCase() || '🔗';
        }
        
        console.log(`[IconHealer] Creating fallback for: ${domain}, char: ${char}`);
        
        const span = document.createElement('span');
        span.className = 'emoji-icon';
        span.innerText = char;
        
        const hue = Array.from(domain).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
        const bgColor = `hsla(${hue}, 70%, 45%, 0.8)`;
        console.log(`[IconHealer] BgColor: ${bgColor}`);
        
        span.style.background = bgColor;
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
    handleIconError,
    handleIconLoad
};
