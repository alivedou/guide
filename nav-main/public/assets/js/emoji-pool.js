/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * emoji-pool.js - Emoji 图标库与随机生成逻辑
 * ==========================================
 */
const EMOJI_CATEGORIES = {
    natureAndTravel: ["🌍", "🌎", "🌏", "🌋", "🗻", "🏕️", "🏖️", "🏝️", "🏔️", "🌊", "🌲", "🌸", "🌞", "🌙", "⭐"],
    objectsAndSymbols: ["💡", "🔥", "✨", "🎈", "🎉", "💎", "🧭", "🎨", "📱", "💻", "🖥️", "电视", "📻", "📷", "🔋", "🔌", "💰", "💳", "❤️", "✅", "🌐", "🎵", "🎶", "🔗", "🔒", "🔑", "📦", "🎁"],
    officeAndBookmarks: ["📂", "📁", "📄", "📝", "📅", "📊", "📈", "📚", "📖", "🔖", "✉️", "📥", "📫", "🔨", "🛠️", "⚙️", "🔧"],
    activitiesAndSports: ["⚽", "🏀", "🏈", "⚾", "🎾", "🎱", "🎮", "🕹️", "🎰", "🎲", "🧩", "🎭", "🖼️"]
};
const ALL_EMOJIS = [...EMOJI_CATEGORIES.natureAndTravel, ...EMOJI_CATEGORIES.objectsAndSymbols, ...EMOJI_CATEGORIES.officeAndBookmarks, ...EMOJI_CATEGORIES.activitiesAndSports];
const EMOJI_KEYWORDS = {
    "办公": EMOJI_CATEGORIES.officeAndBookmarks,
    "自然": EMOJI_CATEGORIES.natureAndTravel,
    "数码": ["📱", "💻", "🖥️", "电视", "📻", "📷"],
    "金融": ["💰", "💳", "💸"],
    "生活": ["💡", "🔥", "✨", "🎈", "🎉", "🎁", "❤️", "🔑"]
};
const searchEmojisByKeyword = (q) => {
    if (!q) return [];
    q = q.toLowerCase().trim();
    for (const [k, v] of Object.entries(EMOJI_KEYWORDS)) if (k.includes(q)) return v;
    return ALL_EMOJIS.filter(e => e.includes(q));
};
const getRandomEmojis = (c = 30) => {
    const p = [...ALL_EMOJIS], r = [];
    while (r.length < Math.min(c, p.length)) r.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    return r;
};
window.emojiPool = { EMOJI_CATEGORIES, ALL_EMOJIS, getRandomEmojis, searchEmojisByKeyword };

// ==================== 智能 Emoji 推荐、Icon 获取与抓取辅助函数 ====================
const RECOMMENDED_EMOJI_KEYWORDS = {
    'github': '🐙', 'git': '📦', 'code': '💻', '编程': '💻', '开发': '🛠️',
    'google': '🔍', 'search': '🔍', '搜索': '🔍',
    'youtube': '📺', 'video': '🎬', '视频': '🎬', 'music': '🎵', '音乐': '🎵',
    'twitter': '🐦', 'facebook': '👥', 'social': '🌐', '社交': '🌐',
    'mail': '📧', 'email': '📧', '邮箱': '📧', 'message': '💬', '消息': '💬',
    'shop': '🛒', 'store': '🏪', '购物': '🛒', 'buy': '🛍️',
    'game': '🎮', 'games': '🎲', '游戏': '🎮', 'play': '▶️',
    'book': '📚', 'read': '📖', 'learn': '📝', '学习': '📚', '教育': '🎓',
    'news': '📰', 'newspaper': '📰', '新闻': '📰', 'blog': '📝',
    'weather': '🌤️', '天气': '🌤️',
    'photo': '📷', 'image': '🖼️', '图片': '🖼️', 'camera': '📸',
    'food': '🍔', 'restaurant': '🍽️', '美食': '🍜', 'eat': '🍕',
    'travel': '✈️', 'trip': '🧳', '旅行': '🧳', 'map': '🗺️',
    'money': '💰', 'finance': '💵', 'pay': '💳', '支付': '💳', 'bank': '🏦',
    'cloud': '☁️', 'cloudflare': '☁️', 'aws': '☁️', 'server': '🖥️',
    'chat': '💬', 'talk': '🗣️', 'ai': '🤖', 'bot': '🤖',
    'home': '🏠', '生活': '🏠',
    'work': '💼', 'office': '🏢', 'business': '💼', '工作': '💼',
    'health': '🏥', 'medical': '🏥', '医院': '🏥', 'doctor': '👨‍⚕️',
    'sport': '⚽', 'sports': '🏃', '运动': '⚽', 'fitness': '💪',
    'star': '⭐', 'favorite': '⭐', '收藏': '⭐', 'bookmark': '🔖',
    'setting': '⚙️', 'config': '🔧', '设置': '⚙️', 'tool': '🛠️',
    'download': '⬇️', 'upload': '⬆️', 'file': '📁', 'folder': '📁',
    'link': '🔗', 'connect': '🔗', 'chain': '🔗', '链接': '🔗',
    'lock': '🔒', 'security': '🔐', 'secure': '🔒', '安全': '🔐',
    'design': '🎨', 'art': '🎨', 'creative': '🎨', '设计': '🎨',
    'api': '🔌', 'data': '📊', 'database': '🗄️', '数据': '📊',
    'terminal': '💻', 'console': '⌨️', 'ssh': '🔐', '命令': '⌨️',
    'wifi': '📶', 'network': '🌐', 'internet': '🌐', 'web': '🌐',
    'notification': '🔔', 'bell': '🔔', 'alert': '⚠️', '通知': '🔔',
    'fire': '🔥', 'hot': '🔥', 'trending': '📈', '热门': '🔥',
    'bilibili': '📺', 'b站': '📺', '哔哩哔哩': '📺'
};

const getRecommendedEmojis = (title) => {
    const results = new Set();
    const lowerTitle = (title || "").toLowerCase();
    for (const [keyword, emoji] of Object.entries(RECOMMENDED_EMOJI_KEYWORDS)) {
        if (lowerTitle.includes(keyword)) results.add(emoji);
    }
    if (results.size === 0) {
        return window.emojiPool ? window.emojiPool.getRandomEmojis(8) : ['🌐', '🔗', '📌', '⭐', '💡', '✨', '🎯', '🚀'];
    }
    const extras = window.emojiPool ? window.emojiPool.getRandomEmojis(4) : ['🌟', '💫', '✨', '🔮'];
    return [...results, ...extras].slice(0, 8);
};

const selectIcon = (url) => {
    if (!url) return;
    const input = document.getElementById('edit-icon');
    if (input) {
        input.value = url;
        input.dispatchEvent(new Event('input')); 
    }
};

const handleUrlInput = (url, autoSelect = false) => {
    if (!url || !url.startsWith('http')) {
        ['0', '1', '2', '3'].forEach(n => {
            const txt = document.getElementById('txt-fav' + n);
            const img = document.getElementById('img-fav' + n);
            const opt = document.getElementById('opt-fav' + n);
            if (txt) txt.value = "";
            if (img) { img.src = ""; img.style.display = 'none'; }
            if (opt) { opt.checked = false; opt.disabled = true; }
        });
        return;
    }

    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const origin = urlObj.origin;
        
        const favs = [
            `${origin}/favicon.ico`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            `https://api.iowen.cn/favicon/${domain}.png`
        ];

        let firstSuccessIdx = -1;

        favs.forEach((favUrl, i) => {
            const txt = document.getElementById('txt-fav' + i);
            const img = document.getElementById('img-fav' + i);
            const opt = document.getElementById('opt-fav' + i);
            if (i === 3 && !txt) return; 

            if (txt && img) {
                txt.value = favUrl;
                img.src = favUrl;
                img.style.display = 'block';
                
                img.onerror = () => {
                    img.style.display = 'none';
                    if (opt) opt.disabled = true;
                };

                img.onload = () => {
                    img.style.display = 'block';
                    if (opt) opt.disabled = false;
                    
                    if (autoSelect) {
                        const currentIconVal = document.getElementById('edit-icon').value.trim();
                        if (!currentIconVal || currentIconVal === '') {
                             if (firstSuccessIdx === -1) {
                                 firstSuccessIdx = i;
                                 selectIcon(favUrl);
                                 if (opt) opt.checked = true;
                                 const labels = ['原站', 'DDG', 'Google', 'Iowen'];
                                 showToast(`已自动匹配最优图标 (${labels[i] || '未知'})`);
                             }
                        }
                    }
                };
            }
        });

        const currentIconInput = document.getElementById('edit-icon');
        if (currentIconInput && !currentIconInput.value) {
            const preview = document.getElementById('edit-icon-preview');
            if (preview) {
                preview.innerHTML = `<img src="${favs[1]}">`;
            }
        }
    } catch (e) { }
};

const debouncedHandleUrlInput = utils.debounce((val) => handleUrlInput(val), 500);

function renderEmojiSuggestions(emojis) {
    const container = document.getElementById('emoji-results');
    if (!container) return;
    container.innerHTML = '';
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-suggestion';
        span.textContent = emoji;
        span.dataset.emoji = emoji;
        span.onclick = () => {
            document.querySelectorAll('.emoji-suggestion').forEach(el => el.classList.remove('selected'));
            span.classList.add('selected');
            selectIcon(emoji);
        };
        container.appendChild(span);
    });
}

async function recommendEmojisAndSearchIconify(isRefreshEmojiOnly = false) {
    const query = document.getElementById('emoji-recommend-title').value.trim();
    const fallbackTitleInput = document.getElementById('edit-title-input') || document.getElementById('edit-cat-name');
    const fallbackTitle = fallbackTitleInput ? fallbackTitleInput.value.trim() : '';
    const searchWord = query || fallbackTitle;

    renderEmojiSuggestions(getRecommendedEmojis(searchWord));

    if (isRefreshEmojiOnly) return; 

    if (!searchWord) return;
    const resBox = document.getElementById('iconify-results');
    if (!resBox) return;
    resBox.innerHTML = '<span style="font-size:12px; color:#aaa;">搜索中...</span>';
    try {
        const req = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(searchWord)}&limit=12`);
        const data = await req.json();
        resBox.innerHTML = '';
        if (data.icons && data.icons.length > 0) {
            data.icons.forEach(iconName => {
                const imgUrl = `https://api.iconify.design/${iconName}.svg`;
                const img = document.createElement('img');
                img.src = imgUrl;
                img.style.cssText = 'width:30px; height:30px; cursor:pointer; background:rgba(255,255,255,0.06); border-radius:6px; padding:4px; transition: 0.2s; border:1px solid rgba(255,255,255,0.1);';
                img.onmouseover = () => img.style.background = 'rgba(255,255,255,0.2)';
                img.onmouseout = () => img.style.background = 'rgba(255,255,255,0.06)';
                img.onclick = () => selectIcon(imgUrl);
                resBox.appendChild(img);
            });
        } else {
            resBox.innerHTML = '<span style="font-size:12px; color:#aaa;">未找到结果</span>';
        }
    } catch (e) {
        resBox.innerHTML = '<span style="font-size:12px; color:#e74c3c;">网络或接口错误</span>';
    }
}

// 导出一键抓取与智能搜索辅助函数至 window 级别的全局空间中
window.getRecommendedEmojis = getRecommendedEmojis;
window.selectIcon = selectIcon;
window.handleUrlInput = handleUrlInput;
window.debouncedHandleUrlInput = debouncedHandleUrlInput;
window.renderEmojiSuggestions = renderEmojiSuggestions;
window.recommendEmojisAndSearchIconify = recommendEmojisAndSearchIconify;
