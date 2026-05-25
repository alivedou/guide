/**
 * ==========================================
 * app.js - 核心前端逻辑（升级版 v5）
 * CloudNav 个人导航页主程序
 * 支持：左侧导航、连续滚动、视频导航、Monaco Editor
 * Style 0: 经典图标网格
 * Style 2: 缤纷模式
 * ==========================================
 */

// ==================== 全局变量定义 ====================
let appData = { settings: { cardWidth: 85 }, categories: [], items: [] };
let activeCatId = '';
let sysToken = localStorage.getItem('nav_token') || '';
let isAdmin = false;
let editingType = 'items';
let editingId = null;
let toastTimer = null;
let currentViewStyle = parseInt(localStorage.getItem('nav_view_style') || '0');
let batchSelectMode = false;
let isZenTempExpanded = false;
let selectedCardIds = new Set();
let themeMode = localStorage.getItem('nav_theme_mode') || 'auto';
let simpleMode = localStorage.getItem('nav_simple_mode') === 'true';
let monacoEditor = null;

// ==================== Bilibili 封面缓存 ====================
const bilibiliCoverCache = new Map();

/**
 * 异步获取 Bilibili 视频封面 URL
 * @param {string} bvid - BV 号
 * @returns {Promise<string|null>} 封面图片 URL
 */
const fetchBilibiliCover = async (bvid) => {
    if (bilibiliCoverCache.has(bvid)) return bilibiliCoverCache.get(bvid);
    try {
        const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
        const data = await res.json();
        if (data.code === 0 && data.data && data.data.pic) {
            bilibiliCoverCache.set(bvid, data.data.pic);
            return data.data.pic;
        }
    } catch (e) {
        console.warn('Bilibili 封面获取失败:', bvid, e);
    }
    return null;
};

/**
 * 批量异步加载视频卡片封面（在 DOM 插入后调用）
 * @param {HTMLElement} container - 包含 video-card 的容器
 */
const loadVideoCovers = async (container) => {
    const coverSlots = container.querySelectorAll('.video-cover-slot[data-bvid]');
    for (const slot of coverSlots) {
        const bvid = slot.getAttribute('data-bvid');
        const coverUrl = await fetchBilibiliCover(bvid);
        if (coverUrl) {
            slot.innerHTML = `<img src="${coverUrl}" alt="" loading="lazy" referrerpolicy="no-referrer"
                onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">`;
            // 隐藏 fallback
            const fallback = slot.querySelector('.video-card-cover-fallback');
            if (fallback) fallback.style.display = 'none';
        }
    }
};

// ==================== 视频平台检测 ====================

/**
 * 检测URL是否为视频平台链接
 * @returns {{ type: 'bilibili'|'youtube', videoId: string, bvid?: string, aid?: string } | null}
 */
const detectVideoPlatform = (url) => {
    if (!url || !url.startsWith('http')) return null;
    try {
        const urlObj = new URL(url);
        // Bilibili 检测
        if (urlObj.hostname.includes('bilibili.com')) {
            const bvidMatch = urlObj.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
            if (bvidMatch) return { type: 'bilibili', videoId: bvidMatch[1], bvid: bvidMatch[1] };
            const avidMatch = urlObj.pathname.match(/\/video\/av(\d+)/);
            if (avidMatch) return { type: 'bilibili', videoId: 'av' + avidMatch[1], aid: avidMatch[1] };
        }
        // YouTube 检测
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be') {
            let videoId = '';
            if (urlObj.hostname === 'youtu.be') {
                videoId = urlObj.pathname.slice(1);
            } else if (urlObj.pathname.startsWith('/watch')) {
                videoId = urlObj.searchParams.get('v');
            } else if (urlObj.pathname.startsWith('/shorts/')) {
                videoId = urlObj.pathname.split('/')[2];
            } else if (urlObj.pathname.startsWith('/embed/')) {
                videoId = urlObj.pathname.split('/')[2];
            }
            if (videoId) return { type: 'youtube', videoId };
        }
    } catch (e) { }
    return null;
};

/**
 * 生成视频嵌入 iframe URL
 */
const getVideoEmbedUrl = (videoInfo) => {
    if (!videoInfo) return '';
    if (videoInfo.type === 'bilibili') {
        if (videoInfo.bvid) {
            return `//player.bilibili.com/player.html?bvid=${videoInfo.bvid}&autoplay=1&high_quality=1`;
        }
        if (videoInfo.aid) {
            return `//player.bilibili.com/player.html?aid=${videoInfo.aid}&autoplay=1&high_quality=1`;
        }
    }
    if (videoInfo.type === 'youtube') {
        return `https://www.youtube.com/embed/${videoInfo.videoId}?autoplay=1`;
    }
    return '';
};

/**
 * 判断分类是否为视频分类（名称包含"视频"或图标为特定emoji）
 */
const isVideoCategory = (cat) => {
    return cat.name.includes('视频') || cat.icon === '🎬' || cat.icon === '📺' || cat.icon === '🎥' || cat._isVideo;
};

// ==================== 安全与工具函数 ====================
const hashPassword = async (password) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ==================== 初始化入口 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/ServiceWorker.js')
                .catch(err => console.log('SW 注册失败:', err));
        });
    }

    initThemeMode();
    initSimpleMode();
    initSidebar();

    // 全局监听卡片点击
    document.getElementById('grid-container').addEventListener('click', (e) => {
        const card = e.target.closest('.card');
        const link = e.target.closest('a');
        if (card && link && !card.classList.contains('card-add-new') && !e.target.closest('.admin-actions')) {
            const id = card.getAttribute('data-id');
            let clicks = JSON.parse(localStorage.getItem('nav_clicks') || '{}');
            clicks[id] = (clicks[id] || 0) + 1;
            localStorage.setItem('nav_clicks', JSON.stringify(clicks));
        }
    });

    initStyleSwitcher();
    initVideoModal();
    initMonacoModal();
    initZenMode();
    init();
    initSearch();
    initQuickNav();
});

// ==================== 极简沉浸模式 (Zen Mode) 逻辑 ====================
const initZenMode = () => {
    const expandBtn = document.getElementById('zen-expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            isZenTempExpanded = true;
            renderNav();
            showToast('已进入发现模式');
        });
    }

    // 滚轮触发展开
    window.addEventListener('wheel', (e) => {
        if (document.body.classList.contains('zen-active') && e.deltaY > 50) {
            expandZen();
        }
    });

    // 点击外部区域展开（如果不是点击搜索框）
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('zen-active') && !e.target.closest('.search-wrapper')) {
            expandZen();
        }
    });

    // 搜索框回车触发展开 (当内容为空时)
    const seaInput = document.getElementById('sea-input');
    if (seaInput) {
        seaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !seaInput.value.trim() && document.body.classList.contains('zen-active')) {
                expandZen();
            }
        });
    }
};

const expandZen = () => {
    isZenTempExpanded = true;
    renderNav();
    // 自动聚焦搜索框，防止重新渲染丢失焦点
    const seaInput = document.getElementById('sea-input');
    if (seaInput) seaInput.focus();
};

// ==================== 侧边栏初始化 ====================
const initSidebar = () => {
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    });

    // 点击侧边栏内任何操作项后关闭（针对移动端/平板）
    sidebar.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-nav-item, .sidebar-style-btn');
        if (item && window.innerWidth <= 1024) { 
            closeSidebar();
        }
    });
};

const closeSidebar = () => {
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
};

// ==================== 视频播放弹窗 ====================
const initVideoModal = () => {
    document.getElementById('btn-close-video').addEventListener('click', closeVideoModal);
    // 不允许点击弹窗外区域关闭，只能通过关闭按钮退出
};

const openVideoModal = (item, videoInfo) => {
    const iframe = document.getElementById('video-iframe');
    iframe.src = getVideoEmbedUrl(videoInfo);
    document.getElementById('video-title').textContent = item.title;
    document.getElementById('video-desc').textContent = item.desc || '';
    const extLink = document.getElementById('video-link');
    extLink.href = item.url;
    extLink.style.display = item.url ? 'inline-flex' : 'none';
    document.getElementById('video-modal').style.display = 'flex';
};

const closeVideoModal = () => {
    const iframe = document.getElementById('video-iframe');
    iframe.src = '';
    document.getElementById('video-modal').style.display = 'none';
};

// ==================== Monaco Editor 弹窗 ====================
const initMonacoModal = () => {
    document.getElementById('btn-close-monaco').addEventListener('click', closeMonacoModal);
    document.getElementById('monaco-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeMonacoModal();
    });
    document.getElementById('btn-monaco-format').addEventListener('click', () => {
        if (monacoEditor) {
            monacoEditor.getAction('editor.action.formatDocument').run();
        }
    });
    document.getElementById('btn-monaco-save').addEventListener('click', saveMonacoData);
};

const openMonacoEditor = () => {
    document.getElementById('monaco-modal').style.display = 'flex';

    if (monacoEditor) {
        monacoEditor.setValue(JSON.stringify(getCleanAppData(), null, 2));
        return;
    }

    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
        monacoEditor = monaco.editor.create(document.getElementById('monaco-container'), {
            value: JSON.stringify(getCleanAppData(), null, 2),
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true
        });
        // 注册格式化快捷键
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            saveMonacoData();
        });
    });
};

const saveMonacoData = () => {
    if (!monacoEditor) return;
    try {
        const text = monacoEditor.getValue();
        const parsed = JSON.parse(text);
        if (!parsed.categories || !parsed.items) {
            showToast('JSON 格式不正确：需要 categories 和 items 字段', '#e74c3c');
            return;
        }
        appData = { ...appData, ...parsed, isAdmin: appData.isAdmin, bgUrl: appData.bgUrl };
        localStorage.setItem('nav_app_data', JSON.stringify(appData));
        updateGridWidth();
        renderTools();
        renderNav();
        applyBackgroundConfig();
        saveAll(true);
        showToast('JSON 数据已保存');
    } catch (e) {
        showToast('JSON 解析错误: ' + e.message, '#e74c3c');
    }
};

const closeMonacoModal = () => {
    document.getElementById('monaco-modal').style.display = 'none';
};

const getCleanAppData = () => {
    const data = { ...appData };
    delete data.isAdmin;
    delete data.bgUrl;
    return data;
};

// ==================== 样式切换 ====================
const initStyleSwitcher = () => {
    document.querySelectorAll('.sidebar-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const style = parseInt(btn.getAttribute('data-style'));
            setViewStyle(style);
        });
    });
    applyViewStyle(currentViewStyle);
};

const setViewStyle = (style) => {
    if (currentViewStyle === style) return;
    currentViewStyle = style;
    localStorage.setItem('nav_view_style', style);
    applyViewStyle(style);
    renderNav();
};

const applyViewStyle = (style) => {
    document.body.classList.remove('view-style-0', 'view-style-2');
    if (style !== 0) {
        document.body.classList.add('view-style-' + style);
    }
    document.querySelectorAll('.sidebar-style-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-style')) === style);
    });
};

// ==================== 主题切换功能 ====================
const initThemeMode = () => { applyThemeMode(); };

const applyThemeMode = () => {
    document.body.classList.remove('light-theme', 'dark-theme');
    if (themeMode === 'light') {
        document.body.classList.add('light-theme');
    } else if (themeMode === 'dark') {
        document.body.classList.add('dark-theme');
    }
};

const toggleThemeMode = () => {
    if (themeMode === 'auto') themeMode = 'light';
    else if (themeMode === 'light') themeMode = 'dark';
    else themeMode = 'auto';
    localStorage.setItem('nav_theme_mode', themeMode);
    applyThemeMode();
    showToast(`主题: ${getThemeModeLabel()}`);
};

const getThemeModeLabel = () => {
    const labels = { auto: '跟随系统', light: '亮色', dark: '暗色' };
    return labels[themeMode] || '跟随系统';
};

// ==================== 简约模式 ====================
const initSimpleMode = () => {
    if (simpleMode) document.body.classList.add('no-blur');
};

const toggleSimpleMode = () => {
    simpleMode = !simpleMode;
    localStorage.setItem('nav_simple_mode', simpleMode);
    document.body.classList.toggle('no-blur', simpleMode);
    showToast(simpleMode ? '已开启简约模式' : '已关闭简约模式');
};

// ==================== 核心函数 ====================
const updateGridWidth = () => {
    const width = (appData.settings && appData.settings.cardWidth) ? appData.settings.cardWidth : 85;
    document.documentElement.style.setProperty('--card-w', width + 'px');
    // 卡片高度跟随宽度设置，保持视觉一致
    document.documentElement.style.setProperty('--card-h', width + 'px');
};

const showLoader = (text = '正在处理中...') => {
    document.getElementById('global-loading-text').innerText = text;
    document.getElementById('global-loading-overlay').style.display = 'flex';
};

const hideLoader = () => {
    document.getElementById('global-loading-overlay').style.display = 'none';
};

const showToast = (msg = "操作成功", color = "#27ae60") => {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.background = color;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
};

const toggleSkeleton = (show) => {
    document.getElementById('skeleton-screen').style.display = show ? 'block' : 'none';
    document.getElementById('main-content').style.display = show ? 'none' : 'block';
};

const loadBackground = async (url) => {
    if (!url) return;
    try {
        const bgCacheName = 'nav-bg-cache-v1';
        const cache = await caches.open(bgCacheName);
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
            const blob = await cachedResponse.blob();
            document.body.style.backgroundImage = `url('${URL.createObjectURL(blob)}')`;
        }
        fetch(url, { mode: 'cors' }).then(async response => {
            if (response.ok) {
                await cache.put(url, response.clone());
                if (!cachedResponse) {
                    const blob = await response.blob();
                    document.body.style.backgroundImage = `url('${URL.createObjectURL(blob)}')`;
                }
            }
        }).catch(() => { });
    } catch (e) {
        const img = new Image();
        img.src = url;
        img.onload = () => { document.body.style.backgroundImage = `url('${url}')`; };
    }
};

const applyBackgroundConfig = () => {
    const customBg = appData.settings?.bgUrl;
    if (customBg) {
        if (customBg.startsWith('#') || customBg.startsWith('rgb')) {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = customBg;
        } else {
            loadBackground(customBg);
        }
    } else if (appData.bgUrl) {
        loadBackground(appData.bgUrl);
    }
};

const init = async (forceRender = false) => {
    let fetchUrl = '/api/config';
    const gridContainer = document.getElementById('grid-container');
    const localCache = localStorage.getItem('nav_app_data');
    let initialIsAdmin = isAdmin;

    if (localCache) {
        try {
            appData = JSON.parse(localCache);
            isAdmin = appData.isAdmin || false;
            initialIsAdmin = isAdmin;
            updateGridWidth();
            toggleSkeleton(false);
            renderTools();
            renderNav();
            applyBackgroundConfig();
        } catch (e) {
            toggleSkeleton(true);
        }
    } else {
        toggleSkeleton(true);
    }

    try {
        const res = await fetch(fetchUrl, {
            headers: sysToken ? { 'Authorization': sysToken } : {},
            cache: 'no-store'
        });

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('nav_token');
                sysToken = '';
                isAdmin = false;
            }
            throw new Error(`HTTP Error ${res.status}`);
        }

        const newData = await res.json();
        const isDataChanged = !localCache ||
            JSON.stringify(appData.items) !== JSON.stringify(newData.items) ||
            JSON.stringify(appData.categories) !== JSON.stringify(newData.categories);

        appData = newData;
        isAdmin = appData.isAdmin || false;
        localStorage.setItem('nav_app_data', JSON.stringify(appData));

        updateGridWidth();
        const isAdminChanged = initialIsAdmin !== isAdmin;
        applyBackgroundConfig();

        if (forceRender || isDataChanged || isAdminChanged || !localCache) {
            toggleSkeleton(false);
            renderTools();
            renderNav();
        }

    } catch (e) {
        console.error("后台数据更新失败", e);
        if (!localCache) {
            gridContainer.innerHTML = `<div style="margin:50px auto; padding:20px; background:rgba(255,0,0,0.2); border:1px solid red; border-radius:10px; text-align:left;">
                <h3 style="color:#ff6b6b; margin-bottom:10px;">⚠️ 数据加载失败</h3>
                <p>${utils.escapeHTML(e.message)}</p>
            </div>`;
            toggleSkeleton(false);
        }
    }
};

// ==================== 管理工具渲染 ====================
const renderTools = () => {
    const sidebarAdminActions = document.getElementById('sidebar-admin-actions');
    sidebarAdminActions.innerHTML = '';

    const createSidebarBtn = (icon, text, action) => {
        const btn = document.createElement('div');
        btn.className = 'sidebar-nav-item';
        btn.innerHTML = `<span class="nav-icon"><i class="${icon}"></i></span><span class="nav-label">${text}</span>`;
        btn.addEventListener('click', action);
        sidebarAdminActions.appendChild(btn);
    };

    if (isAdmin) {
        document.title = "管理后台";
        // 侧边栏底部管理按钮
        createSidebarBtn('ri-settings-3-line', '偏好设置', manageCats);
        createSidebarBtn('ri-code-s-slash-line', 'JSON编辑', openMonacoEditor);
        createSidebarBtn('ri-save-line', '保存', () => saveAll(false));
        createSidebarBtn('ri-download-line', '导出', exportConfig);
        createSidebarBtn('ri-upload-line', '导入', () => document.getElementById('import-file').click());
        createSidebarBtn('ri-refresh-line', '默认', resetConfig);
        createSidebarBtn('ri-logout-box-r-line', '登出', doLogout);
    } else {
        document.title = "个人导航";
        createSidebarBtn('ri-lock-line', '管理', () => {
            document.getElementById('auth-overlay').style.display = 'flex';
            setTimeout(() => document.getElementById('auth-input').focus(), 100);
        });
    }
};

// ==================== 卡片 HTML 生成 ====================
/**
 * 处理图标加载失败的降级逻辑 (v2.5 - 中国大陆优化版)
 * @param {HTMLImageElement} el - 图片对象
 * @param {string} originalUrl - 网站源码 URL
 */
window.handleIconError = (el, originalUrl) => {
    // 防止死循环及清理旧定时器
    if (el.dataset.healing === "done") return;
    if (el.timeout) { clearTimeout(el.timeout); el.timeout = null; }
    
    const src = el.src;
    
    // 基础域名提取
    let domain = '';
    let origin = '';
    try {
        const urlObj = new URL(originalUrl);
        domain = urlObj.hostname;
        origin = urlObj.origin;
    } catch (e) {
        // 如果 URL 解析失败（可能是相对路径或格式错误），尝试简单的正则提取或直接放弃
        const match = originalUrl.match(/https?:\/\/([^\/]+)/);
        if (match) {
            domain = match[1];
            origin = match[0];
        } else {
            gotoPlaceholder(el, '🔗');
            return;
        }
    }

    const nextStep = () => {
        const attempt = parseInt(el.dataset.attempt || "0");
        el.dataset.attempt = (attempt + 1).toString();
        window.handleIconError(el, originalUrl);
    };

    const attempt = parseInt(el.dataset.attempt || "0");

    // 阶段 1: 尝试原站根目录 favicon.ico
    if (attempt === 0) {
        const rootFav = `${origin}/favicon.ico`;
        el.dataset.attempt = "1";
        if (src !== rootFav) {
            el.src = rootFav;
        } else {
            nextStep();
        }
        return;
    }

    // 阶段 2: Iowen API (国内较稳)
    if (attempt === 1) {
        el.dataset.attempt = "2";
        el.src = `https://api.iowen.cn/favicon/${domain}.png`;
        return;
    }

    // 阶段 3: QQSuu API (国内极稳)
    if (attempt === 2) {
        el.dataset.attempt = "3";
        el.src = `https://favicon.qqsuu.cn/${domain}`;
        return;
    }

    // 阶段 4: Google API (中国大陆需 2.5s 超时跳过)
    if (attempt === 3) {
        el.dataset.attempt = "4";
        el.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        el.timeout = setTimeout(() => {
            if (el.dataset.attempt === "4") nextStep();
        }, 2500);
        return;
    }

    // 阶段 5: DuckDuckGo API (中国大陆需 2.5s 超时跳过)
    if (attempt === 4) {
        el.dataset.attempt = "5";
        el.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        el.timeout = setTimeout(() => {
            if (el.dataset.attempt === "5") nextStep();
        }, 2200);
        return;
    }

    // 终极阶段: 显示文字占位图 (取域名首字母)
    gotoPlaceholder(el, domain);
};

/**
 * 切换到 SVG 占位图
 */
const gotoPlaceholder = (el, domainName) => {
    el.onerror = null;
    el.dataset.healing = "done";
    if (el.timeout) clearTimeout(el.timeout);
    
    const firstChar = domainName.split('.').filter(s => s !== 'www')[0]?.[0] || domainName[0] || '🔗';
    const bgColor = '#399dff';
    const svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${encodeURIComponent(bgColor)}"/><text x="50" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="bold" fill="white" text-anchor="middle">${encodeURIComponent(firstChar.toUpperCase())}</text></svg>`;
    el.src = svg;
    el.style.borderRadius = '20%';
    el.style.padding = '2px';
};

const buildCardInnerHTML = (item, adminHtml, style) => {
    const cardSafeUrl = utils.escapeHTML(item.url);
    const safeIcon = utils.escapeHTML(item.icon);
    const isImgIcon = item.icon && item.icon.startsWith('http');
    
    // 使用统一的错误处理函数
    let fallbackAttr = `onerror="handleIconError(this, '${cardSafeUrl}')"`;
    
    const iconHtml = isImgIcon
        ? `<img src="${safeIcon}" loading="lazy" ${fallbackAttr}>`
        : `<span class="emoji-icon">${safeIcon || '🔗'}</span>`;

    const safeTitle = utils.escapeHTML(item.title);
    const targetAttr = (appData.settings && appData.settings.openInNewTab) ? '_blank' : '_self';

    if (style === 2) {
        return `${adminHtml}<a href="${cardSafeUrl}" target="${targetAttr}">
            <div class="icon-wrapper">${iconHtml}</div>
            <div class="card-text-block"><h3>${safeTitle}</h3></div>
        </a>`;
    } else {
        return `${adminHtml}<a href="${cardSafeUrl}" target="${targetAttr}"><div class="icon-wrapper">${iconHtml}</div><h3>${safeTitle}</h3></a>`;
    }
};

// ==================== 批量选择功能 ====================
const toggleCardSelection = (id) => {
    if (selectedCardIds.has(id)) selectedCardIds.delete(id);
    else selectedCardIds.add(id);
    updateBatchUI();
    renderNav();
};

const updateBatchUI = () => {
    let batchBar = document.querySelector('.batch-actions-bar');
    if (selectedCardIds.size > 0) {
        if (!batchBar) {
            batchBar = document.createElement('div');
            batchBar.className = 'batch-actions-bar';
            batchBar.innerHTML = `
                <span>已选 <b id="batch-count">0</b> 项</span>
                <button class="batch-btn move" id="batch-move-btn">移动到分类</button>
                <button class="batch-btn delete" id="batch-delete-btn">批量删除</button>
                <button class="batch-btn" id="batch-cancel-btn" style="background:rgba(150,150,150,0.8); color:white;">取消</button>
            `;
            document.body.appendChild(batchBar);
            document.getElementById('batch-delete-btn').addEventListener('click', batchDelete);
            document.getElementById('batch-move-btn').addEventListener('click', showBatchMoveDialog);
            document.getElementById('batch-cancel-btn').addEventListener('click', clearSelection);
        }
        batchBar.classList.add('visible');
        document.getElementById('batch-count').textContent = selectedCardIds.size;
    } else {
        if (batchBar) batchBar.classList.remove('visible');
    }
};

const clearSelection = () => {
    selectedCardIds.clear();
    updateBatchUI();
    renderNav();
};

const batchDelete = async () => {
    if (!isAdmin) {
        showToast("未登录或已失效，请重新登录", "#e67e22");
        return;
    }
    if (selectedCardIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCardIds.size} 个网站？`)) return;
    
    showLoader('正在处理批量删除...');
    try {
        const idsToDelete = new Set(Array.from(selectedCardIds).map(id => String(id)));
        appData.items = appData.items.filter(item => !idsToDelete.has(String(item.id)));
        
        clearSelection(); // This clears IDs and calls renderNav()
        
        // 发起同步
        const success = await saveAll(false);
        if (success) {
            showToast('批量删除并同步成功');
        } else {
            showToast('本地操作完成，但同步失败', '#e67e22');
        }
    } catch (err) {
        console.error("Batch delete error:", err);
        showToast("批量删除过程中出错", "#e74c3c");
    } finally {
        hideLoader();
    }
};

const showBatchMoveDialog = () => {
    if (selectedCardIds.size === 0) return;
    const cats = appData.categories;
    const catOptions = cats.map(c => `<option value="${c.id}">${utils.escapeHTML(c.icon)} ${utils.escapeHTML(c.name)}</option>`).join('');
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.style.display = 'flex';
    dialog.innerHTML = `
        <div class="modal-content" style="text-align:center">
            <h3 style="margin-bottom:15px;">移动到分类</h3>
            <select id="batch-move-cat" style="width:100%; margin-bottom:15px;">${catOptions}</select>
            <div style="display:flex; gap:10px;">
                <button class="tab-btn active" id="batch-move-confirm" style="flex:1;">确认移动</button>
                <button class="tab-btn" id="batch-move-cancel" style="flex:1; background:rgba(150,150,150,0.5);">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    document.getElementById('batch-move-cancel').addEventListener('click', () => document.body.removeChild(dialog));
    document.getElementById('batch-move-confirm').addEventListener('click', () => {
        const targetCatId = document.getElementById('batch-move-cat').value;
        appData.items.forEach(item => { if (selectedCardIds.has(item.id)) item.catId = targetCatId; });
        document.body.removeChild(dialog);
        clearSelection();
        saveAll(false);
        showToast(`已移动到目标分类`);
    });
};

// ==================== 渲染导航内容（连续滚动） ====================
const renderNav = () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const container = document.getElementById('grid-container');
    sidebarNav.innerHTML = '';
    container.innerHTML = '';

    const clickData = JSON.parse(localStorage.getItem('nav_clicks') || '{}');
    const hasFrequent = Object.keys(clickData).length > 0;

    let cats = isAdmin ? [...appData.categories] : appData.categories.filter(c => !c.hidden);

    // 常去虚拟分类
    if (hasFrequent) {
        cats.unshift({ id: 'VIRTUAL_FREQ', name: '常去网站', icon: '⭐', hidden: false });
    }

    if (cats.length > 0 && !activeCatId) activeCatId = cats[0].id;
    if (!cats.find(c => c.id === activeCatId) && cats.length > 0) activeCatId = cats[0].id;

    // 渲染侧边栏导航项
    cats.forEach((cat) => {
        const item = document.createElement('div');
        item.className = 'sidebar-nav-item' + (activeCatId === cat.id ? ' active' : '') + (cat.hidden ? ' hidden-item' : '');
        item.setAttribute('data-cat-id', cat.id);
        item.innerHTML = `<span class="nav-icon">${utils.escapeHTML(cat.icon)}</span><span class="nav-label">${utils.escapeHTML(cat.name)}</span>`;
        item.addEventListener('click', () => {
            activeCatId = cat.id;
            renderNav();
            // 滚动到对应分类区块
            const section = document.getElementById('section-' + cat.id);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        sidebarNav.appendChild(item);
    });

    // 连续滚动：渲染所有分类区块
    cats.forEach((cat) => {
        const section = document.createElement('div');
        section.className = 'category-section';
        section.id = 'section-' + cat.id;

        // 分类标题
        const title = document.createElement('div');
        title.className = 'category-section-title';
        title.innerHTML = `<span class="cat-icon">${utils.escapeHTML(cat.icon)}</span> ${utils.escapeHTML(cat.name)}`;
        section.appendChild(title);

        // 判断是否为视频分类
        const catIsVideo = isVideoCategory(cat);

        // 获取该分类下的项目
        let catItems = [];
        if (cat.id === 'VIRTUAL_FREQ') {
            const allAvailableItems = appData.items.filter(i => isAdmin || !i.hidden);
            catItems = allAvailableItems
                .filter(i => clickData[i.id] > 0)
                .sort((a, b) => (clickData[b.id] || 0) - (clickData[a.id] || 0))
                .slice(0, 12);
        } else {
            catItems = appData.items.filter(i => i.catId === cat.id && (isAdmin || !i.hidden));
        }

        if (catIsVideo) {
            // 视频分类：使用视频卡片网格
            const videoGrid = document.createElement('div');
            videoGrid.className = 'video-grid';

            catItems.forEach((item) => {
                const videoInfo = detectVideoPlatform(item.url);
                const videoCard = buildVideoCard(item, videoInfo);
                videoGrid.appendChild(videoCard);
            });

            // 管理员模式：新增卡片
            if (isAdmin && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                addCard.className = 'video-card';
                addCard.style.borderStyle = 'dashed';
                addCard.style.display = 'flex';
                addCard.style.alignItems = 'center';
                addCard.style.justifyContent = 'center';
                addCard.style.minHeight = '120px';
                addCard.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.5);"><i class="ri-add-line" style="font-size:32px;"></i><div style="font-size:12px; margin-top:4px;">新增</div></div>`;
                addCard.addEventListener('click', (e) => {
                    e.preventDefault();
                    openItemEdit('', cat.id);
                });
                videoGrid.appendChild(addCard);
            }

            section.appendChild(videoGrid);

            // 异步加载 Bilibili 封面
            loadVideoCovers(videoGrid);

            // 视频分类拖拽排序
            if (isAdmin && typeof Sortable !== 'undefined' && cat.id !== 'VIRTUAL_FREQ') {
                new Sortable(videoGrid, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    filter: '.card-add-new',
                    onMove: (evt) => {
                        // 不允许拖到"新增"卡片位置
                        if (evt.related && evt.related.style && evt.related.style.borderStyle === 'dashed') return false;
                    },
                    onEnd: () => {
                        const newIdOrder = Array.from(videoGrid.querySelectorAll('.video-card[data-id]')).map(el => el.getAttribute('data-id'));
                        const currentCatItems = appData.items.filter(i => i.catId === cat.id);
                        const sortedCurrentItems = newIdOrder.map(id => currentCatItems.find(i => i.id === id));
                        let newGlobalItems = [];
                        appData.categories.forEach(c => {
                            if (c.id === cat.id) newGlobalItems.push(...sortedCurrentItems);
                            else newGlobalItems.push(...appData.items.filter(i => i.catId === c.id));
                        });
                        appData.items = newGlobalItems;
                        saveAll(true);
                    }
                });
            }
        } else {
            // 普通网站分类：使用原有网格
            const grid = document.createElement('div');
            grid.className = 'nav-grid';
            grid.id = 'grid-' + cat.id;

            grid.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('.action-mini');
                if (actionBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const action = actionBtn.getAttribute('data-action');
                    const targetId = actionBtn.getAttribute('data-id');
                    if (action === 'toggleHide') toggleHide('items', targetId);
                    if (action === 'edit') openItemEdit(targetId, null);
                    if (action === 'delete') deleteObj('items', targetId);
                    return;
                }
                if (e.target.closest('.card-add-new')) {
                    e.preventDefault();
                    e.stopPropagation();
                    openItemEdit('', cat.id);
                }
            });

            const fragment = document.createDocumentFragment();

            catItems.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'card' + (item.hidden ? ' hidden-item' : '');
                card.setAttribute('data-id', utils.escapeHTML(item.id));

                // 检测是否有视频链接（非视频分类中的视频链接）
                const videoInfo = detectVideoPlatform(item.url);

                if (currentViewStyle === 2 && item.bgColor) {
                    card.style.setProperty('--card-bg-color', item.bgColor);
                    card.classList.add('has-bg');
                }

                const safeDesc = utils.escapeHTML(item.desc || '');
                const safeTitle = utils.escapeHTML(item.title);
                const tooltip = safeDesc ? `${safeTitle}\n${safeDesc}` : safeTitle;
                card.setAttribute('data-tooltip', tooltip);

                let adminHtml = '';
                if (isAdmin && cat.id !== 'VIRTUAL_FREQ') {
                    adminHtml = `<div class="admin-actions">
                        <button class="action-mini batch-select-btn" data-id="${utils.escapeHTML(item.id)}"><i class="ri-checkbox-${selectedCardIds.has(item.id) ? 'fill' : 'blank-line'}"></i></button>
                        <button class="action-mini" data-action="toggleHide" data-id="${utils.escapeHTML(item.id)}"><i class="ri-eye-${item.hidden ? 'off-' : ''}line"></i></button>
                        <button class="action-mini" data-action="edit" data-id="${utils.escapeHTML(item.id)}"><i class="ri-edit-line"></i></button>
                        <button class="action-mini" data-action="delete" data-id="${utils.escapeHTML(item.id)}"><i class="ri-delete-bin-line"></i></button>
                    </div>`;
                }

                card.innerHTML = buildCardInnerHTML(item, adminHtml, currentViewStyle);

                // 如果检测到视频链接，点击卡片打开视频播放弹窗
                if (videoInfo) {
                    const linkEl = card.querySelector('a');
                    if (linkEl) {
                        linkEl.addEventListener('click', (e) => {
                            if (e.target.closest('.admin-actions')) return;
                            e.preventDefault();
                            openVideoModal(item, videoInfo);
                        });
                    }
                }

                if (selectedCardIds.has(item.id)) {
                    card.classList.add('selected');
                }
                fragment.appendChild(card);
            });

            // 新增卡片按钮
            if (isAdmin && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                addCard.className = 'card card-add-new';
                addCard.style.borderStyle = 'dashed';
                if (currentViewStyle === 2) {
                    addCard.innerHTML = `<a href="javascript:void(0)">
                        <div class="icon-wrapper"><div class="emoji-icon">➕</div></div>
                        <div class="card-text-block"><h3>新增</h3></div>
                    </a>`;
                } else {
                    addCard.innerHTML = '<a href="javascript:void(0)"><div class="icon-wrapper"><div class="emoji-icon">➕</div></div><h3>新增</h3></a>';
                }
                fragment.appendChild(addCard);
            }

            grid.appendChild(fragment);
            section.appendChild(grid);

            // 批量选择事件
            if (isAdmin && cat.id !== 'VIRTUAL_FREQ') {
                grid.querySelectorAll('.batch-select-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = btn.getAttribute('data-id');
                        toggleCardSelection(id);
                    });
                });
            }

            // 拖拽排序
            if (isAdmin && typeof Sortable !== 'undefined' && cat.id !== 'VIRTUAL_FREQ') {
                new Sortable(grid, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    filter: '.card-add-new',
                    onMove: (evt) => { if (evt.related.classList.contains('card-add-new')) return false; },
                    onEnd: () => {
                        const newIdOrder = Array.from(grid.querySelectorAll('.card[data-id]')).map(el => el.getAttribute('data-id'));
                        const currentCatItems = appData.items.filter(i => i.catId === cat.id);
                        const sortedCurrentItems = newIdOrder.map(id => currentCatItems.find(i => i.id === id));
                        let newGlobalItems = [];
                        appData.categories.forEach(c => {
                            if (c.id === cat.id) newGlobalItems.push(...sortedCurrentItems);
                            else newGlobalItems.push(...appData.items.filter(i => i.catId === c.id));
                        });
                        appData.items = newGlobalItems;
                        saveAll(true);
                    }
                });
            }
        }

        container.appendChild(section);
    });

    // 渲染动态搜索框位置
    const searchSection = document.getElementById('search-section');
    const searchPos = (appData.settings && appData.settings.searchPosition) || 'top';
    const isZenModeSetting = appData.settings && appData.settings.zenMode;
    const isActuallyZen = isZenModeSetting && !isZenTempExpanded;

    // 处理 Zen Mode 初始状态
    if (isActuallyZen) {
        document.body.classList.add('zen-active');
        document.getElementById('zen-expand-btn').style.display = 'flex';
    } else {
        document.body.classList.remove('zen-active');
        document.getElementById('zen-expand-btn').style.display = 'none';
    }

    // 移除动态移动搜索框位置的逻辑，改为纯 CSS 控制，防止 DOM 重插导致的闪烁和焦点丢失
    if (searchSection && searchPos === 'belowFirst' && !isActuallyZen) {
        const firstSec = container.querySelector('.category-section');
        if (firstSec && firstSec.nextSibling !== searchSection) {
            firstSec.parentNode.insertBefore(searchSection, firstSec.nextSibling);
        }
    } else if (searchSection && searchPos !== 'belowFirst' && !isActuallyZen) {
        const mainContent = document.getElementById('main-content');
        if (mainContent && mainContent.firstChild !== searchSection) {
            mainContent.insertBefore(searchSection, container);
        }
    }

    // 滚动监听：自动高亮当前可见分类
    initScrollSpy();
};

// ==================== 视频卡片构建 ====================
const buildVideoCard = (item, videoInfo) => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.setAttribute('data-id', utils.escapeHTML(item.id));

    const safeTitle = utils.escapeHTML(item.title);
    const safeDesc = utils.escapeHTML(item.desc || '');
    const videoSafeUrl = utils.escapeHTML(item.url);

    // 平台标识
    let badgeHtml = '';
    if (videoInfo) {
        const badgeClass = videoInfo.type === 'bilibili' ? 'bilibili' : 'youtube';
        const badgeText = videoInfo.type === 'bilibili' ? 'Bilibili' : 'YouTube';
        badgeHtml = `<div class="video-card-badge ${badgeClass}">${badgeText}</div>`;
    }

    // 封面区域
    let coverHtml = '';
    if (videoInfo?.type === 'bilibili') {
        // Bilibili：使用异步加载封面（需要 API 获取真实 URL）
        coverHtml = `<div class="video-cover-slot" data-bvid="${videoInfo.bvid}">
            <div class="video-card-cover-fallback"><i class="ri-play-circle-line"></i></div>
        </div>`;
    } else if (videoInfo?.type === 'youtube') {
        coverHtml = `<img src="https://img.youtube.com/vi/${videoInfo.videoId}/mqdefault.jpg" alt="${safeTitle}" loading="lazy"
            onerror="this.style.display='none';">`;
    } else {
        coverHtml = `<div class="video-card-cover-fallback"><i class="ri-play-circle-line"></i></div>`;
    }

    // 管理员操作
    let adminHtml = '';
    if (isAdmin) {
        adminHtml = `<div class="admin-actions">
            <button class="action-mini" data-action="toggleHide" data-id="${utils.escapeHTML(item.id)}"><i class="ri-eye-${item.hidden ? 'off-' : ''}line"></i></button>
            <button class="action-mini" data-action="edit" data-id="${utils.escapeHTML(item.id)}"><i class="ri-edit-line"></i></button>
            <button class="action-mini" data-action="delete" data-id="${utils.escapeHTML(item.id)}"><i class="ri-delete-bin-line"></i></button>
        </div>`;
    }

    card.innerHTML = `
        ${adminHtml}
        <div class="video-card-cover">
            ${badgeHtml}
            ${coverHtml}
            <div class="video-play-overlay">
                <div class="video-play-btn"><i class="ri-play-fill"></i></div>
            </div>
        </div>
        <div class="video-card-body">
            <div class="video-card-title">${safeTitle}</div>
            <div class="video-card-desc">${safeDesc || (videoInfo ? (videoInfo.type === 'bilibili' ? 'Bilibili' : 'YouTube') : '')}</div>
        </div>
    `;

    // 点击播放视频
    card.addEventListener('click', (e) => {
        if (e.target.closest('.admin-actions')) {
            // 管理操作
            const actionBtn = e.target.closest('.action-mini');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                const action = actionBtn.getAttribute('data-action');
                const targetId = actionBtn.getAttribute('data-id');
                if (action === 'toggleHide') toggleHide('items', targetId);
                if (action === 'edit') openItemEdit(targetId, null);
                if (action === 'delete') deleteObj('items', targetId);
            }
            return;
        }
        if (videoInfo) {
            e.preventDefault();
            openVideoModal(item, videoInfo);
        } else if (item.url) {
            const openTarget = (appData.settings && appData.settings.openInNewTab) ? '_blank' : '_self';
            window.open(item.url, openTarget);
        }
    });

    if (item.hidden) {
        card.style.opacity = '0.3';
        card.style.filter = 'grayscale(1)';
    }

    return card;
};

// ==================== 滚动监听（自动高亮侧边栏） ====================
let scrollSpyInitialized = false;
const initScrollSpy = () => {
    // 使用 IntersectionObserver 替代 scroll 监听以提升性能
    const sections = document.querySelectorAll('.category-section');
    if (sections.length === 0) return;

    // 清理旧的 observer
    if (window._scrollSpyObserver) {
        window._scrollSpyObserver.disconnect();
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const catId = entry.target.id.replace('section-', '');
                activeCatId = catId;
                // 更新侧边栏高亮
                document.querySelectorAll('.sidebar-nav-item').forEach(item => {
                    item.classList.toggle('active', item.getAttribute('data-cat-id') === catId);
                });
            }
        });
    }, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    });

    sections.forEach(section => observer.observe(section));
    window._scrollSpyObserver = observer;
};

// ==================== 编辑相关函数 ====================
const debouncedHandleUrlInput = utils.debounce((val) => handleUrlInput(val), 500);

const openItemEdit = (id, catId) => {
    editingType = 'items';
    editingId = id;

    const item = id
        ? appData.items.find(i => i.id === id)
        : { id: 'i' + Date.now(), title: '', url: '', desc: '', icon: '', catId: catId };

    const editSafeUrl = utils.escapeHTML(item.url);
    const safeTitle = utils.escapeHTML(item.title);
    const safeIcon = utils.escapeHTML(item.icon);
    const safeDesc = utils.escapeHTML(item.desc || '');
    const safeBgColor = utils.escapeHTML(item.bgColor || '');

    // 检测当前是否为视频分类
    const currentCat = appData.categories.find(c => c.id === (item.catId || catId));
    const isVideoCat = currentCat && isVideoCategory(currentCat);
    const videoInfo = detectVideoPlatform(item.url);

    document.getElementById('edit-title').innerText = id ? '编辑网站' : '新增网站';
    document.getElementById('edit-form-body').innerHTML = `
        <div class="form-row">
            <label>网站 URL</label>
            <div style="display:flex; width:100%; gap:8px;">
                <input id="f-url" value="${editSafeUrl}" placeholder="https://..." style="flex:1;">
                <button type="button" class="manage-cat-btn" id="btn-icon-magic" title="一键抓取并修复图标" style="border:1px solid var(--primary); color:white; background:var(--primary); padding:0 12px; height:40px; border-radius:10px;"><i class="ri-magic-line"></i></button>
            </div>
        </div>
        ${isVideoCat || videoInfo ? `<div style="background:rgba(57,157,255,0.1); border:1px solid rgba(57,157,255,0.3); border-radius:8px; padding:8px 12px; margin-bottom:8px; font-size:12px; color:rgba(255,255,255,0.8);">
            <i class="ri-film-line"></i> 视频链接已自动识别${videoInfo ? '（' + (videoInfo.type === 'bilibili' ? 'Bilibili' : 'YouTube') + '）' : ''}，点击卡片将直接播放
        </div>` : ''}
        <div class="form-row"><label>网站名称</label><input id="f-title" value="${safeTitle}"></div>
        <div class="form-row"><label>网站说明</label><input id="f-desc" value="${safeDesc}" placeholder="选填，鼠标悬停时显示"></div>
        <div class="form-row"><label>当前图标</label>
            <div style="display:flex; width:100%; align-items:center;">
                <input id="f-icon" value="${safeIcon}" placeholder="可手动填入，或选择下方智能接口">
                <div id="preview-box" class="preview-container"></div>
            </div>
        </div>
        <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:10px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; color:#aaa;">多源图标备份 (自动抓取)</span>
            </div>
            <div class="form-row" style="margin-bottom:8px;"><label style="font-size:11px; font-weight:normal; color:#999;">原生图标 (Origin)</label>
                <div style="display:flex; align-items:center; width:100%;">
                    <input type="radio" name="icon_sel" id="opt-fav0" style="width:18px; height:18px; flex-shrink:0; margin:0 6px 0 0; cursor:pointer;">
                    <input id="txt-fav0" readonly placeholder="站点根目录 favicon.ico" style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3);">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3);"><img id="img-fav0" src="" loading="lazy"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:8px;"><label style="font-size:11px; font-weight:normal; color:#999;">Iowen API (首选加速)</label>
                <div style="display:flex; align-items:center; width:100%;">
                    <input type="radio" name="icon_sel" id="opt-fav1" style="width:18px; height:18px; flex-shrink:0; margin:0 6px 0 0; cursor:pointer;">
                    <input id="txt-fav1" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3);">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3);"><img id="img-fav1" src="" loading="lazy"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:8px;"><label style="font-size:11px; font-weight:normal; color:#999;">DuckDuckGo API</label>
                <div style="display:flex; align-items:center; width:100%;">
                    <input type="radio" name="icon_sel" id="opt-fav2" style="width:18px; height:18px; flex-shrink:0; margin:0 6px 0 0; cursor:pointer;">
                    <input id="txt-fav2" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3);">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3);"><img id="img-fav2" src="" loading="lazy"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:0;"><label style="font-size:11px; font-weight:normal; color:#999;">Google API</label>
                <div style="display:flex; align-items:center; width:100%;">
                    <input type="radio" name="icon_sel" id="opt-fav3" style="width:18px; height:18px; flex-shrink:0; margin:0 6px 0 0; cursor:pointer;">
                    <input id="txt-fav3" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3);">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3);"><img id="img-fav3" src="" loading="lazy"></div>
                </div>
            </div>
        </div>
        <div class="form-row"><label style="font-size:12px; font-weight:normal; color:#999;">图标搜索</label>
            <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                <div style="display:flex; gap:5px;">
                    <input id="iconify-search" placeholder="输入英文关键词, 如 github" style="flex:1;">
                    <button type="button" class="manage-cat-btn" id="btn-iconify-search" style="border: 1px solid var(--primary); color: white; background: var(--primary);">搜索</button>
                </div>
                <div id="iconify-results" style="display:flex; flex-wrap:wrap; gap:5px; max-height:80px; overflow-y:auto; margin-top:5px;"></div>
            </div>
        </div>
        <div class="form-row" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 10px;">
            <label style="font-size:12px; font-weight:normal; color:#999;">智能 Emoji</label>
            <div style="display:flex; flex-direction:column; width:100%; gap:5px;">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input id="emoji-recommend-title" value="${safeTitle}" placeholder="输入网站名称获取推荐" style="flex:1;">
                    <button type="button" class="manage-cat-btn" id="btn-emoji-recommend" style="border: 1px solid var(--primary); color: white; background: var(--primary);">推荐</button>
                    <button type="button" class="manage-cat-btn" id="btn-emoji-refresh" title="换一组" style="padding:8px 12px;">🔄</button>
                </div>
                <div id="emoji-results" style="display:flex; flex-wrap:wrap; gap:5px; max-height:60px; overflow-y:auto; margin-top:5px;">
                    ${safeIcon && !safeIcon.startsWith('http') ? `<span class="emoji-suggestion selected" data-emoji="${safeIcon}">${safeIcon}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="form-row" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 10px;">
            <label style="font-size:12px;">网格背景色</label>
            <div style="display:flex; align-items:center; gap:8px; width:100%;">
                <input type="color" id="f-bg-color" value="${safeBgColor || '#399dff'}" style="width:40px; height:36px; padding:2px; border:none; border-radius:6px; cursor:pointer; background:transparent; flex-shrink:0;">
                <input id="f-bg-color-text" value="${safeBgColor}" placeholder="如 rgba(57,157,255,0.45) 或 #3b82f6，留空使用默认" style="flex:1;">
            </div>
        </div>
        <div class="form-row"><label>归属分类</label>
            <select id="f-cat">${appData.categories.map(c => `<option value="${utils.escapeHTML(c.id)}" ${c.id === item.catId ? 'selected' : ''}>${utils.escapeHTML(c.name)}</option>`).join('')}</select>
        </div>
    `;

    // 背景色取色器与输入框联动
    const colorInput = document.getElementById('f-bg-color');
    const colorText = document.getElementById('f-bg-color-text');
    colorInput.addEventListener('input', () => { colorText.value = colorInput.value; });
    colorText.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) colorInput.value = colorText.value;
    });

    document.getElementById('f-url').addEventListener('input', (e) => debouncedHandleUrlInput(e.target.value));
    document.getElementById('f-icon').addEventListener('input', (e) => updatePreview(e.target.value));
    
    // 一键抓取修复功能
    document.getElementById('btn-icon-magic').addEventListener('click', () => {
        const url = document.getElementById('f-url').value.trim();
        if (!url) { showToast('请先输入网站 URL', '#e67e22'); return; }
        handleUrlInput(url, true); // 强制执行并自动选优
    });

    ['0', '1', '2', '3'].forEach(num => {
        const opt = document.getElementById('opt-fav' + num);
        const txt = document.getElementById('txt-fav' + num);
        if (!opt || !txt) return;
        opt.addEventListener('change', () => selectIcon(txt.value));
        txt.addEventListener('click', () => { if (txt.value) { opt.checked = true; selectIcon(txt.value); } });
    });

    document.getElementById('btn-iconify-search').addEventListener('click', async () => {
        const query = document.getElementById('iconify-search').value.trim();
        if (!query) return;
        const resBox = document.getElementById('iconify-results');
        resBox.innerHTML = '<span style="font-size:12px;">搜索中...</span>';
        try {
            const req = await fetch(`https://api.iconify.design/search?query=${query}&limit=12`);
            const data = await req.json();
            resBox.innerHTML = '';
            if (data.icons && data.icons.length > 0) {
                data.icons.forEach(iconName => {
                    const imgUrl = `https://api.iconify.design/${iconName}.svg`;
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.style.cssText = 'width:30px; height:30px; cursor:pointer; background:rgba(255,255,255,0.1); border-radius:6px; padding:4px; transition: 0.2s;';
                    img.onmouseover = () => img.style.background = 'rgba(255,255,255,0.3)';
                    img.onmouseout = () => img.style.background = 'rgba(255,255,255,0.1)';
                    img.onclick = () => selectIcon(imgUrl);
                    resBox.appendChild(img);
                });
            } else {
                resBox.innerHTML = '<span style="font-size:12px; color:#aaa;">未找到结果</span>';
            }
        } catch (e) {
            resBox.innerHTML = '<span style="font-size:12px; color:#e74c3c;">网络或接口错误</span>';
        }
    });

    const EMOJI_KEYWORDS = {
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
        const lowerTitle = title.toLowerCase();
        for (const [keyword, emoji] of Object.entries(EMOJI_KEYWORDS)) {
            if (lowerTitle.includes(keyword)) results.add(emoji);
        }
        if (results.size === 0) {
            return window.emojiPool ? window.emojiPool.getRandomEmojis(8) : ['🌐', '🔗', '📌', '⭐', '💡', '✨', '🎯', '🚀'];
        }
        const extras = window.emojiPool ? window.emojiPool.getRandomEmojis(4) : ['🌟', '💫', '✨', '🔮'];
        return [...results, ...extras].slice(0, 8);
    };

    const renderEmojiSuggestions = (emojis) => {
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
    };

    const recommendEmojis = () => {
        const title = document.getElementById('emoji-recommend-title').value;
        renderEmojiSuggestions(getRecommendedEmojis(title || safeTitle));
    };

    document.getElementById('btn-emoji-recommend').addEventListener('click', recommendEmojis);
    document.getElementById('btn-emoji-refresh').addEventListener('click', () => {
        renderEmojiSuggestions(getRecommendedEmojis(document.getElementById('emoji-recommend-title').value || safeTitle));
    });
    document.getElementById('emoji-recommend-title').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') recommendEmojis();
    });

    updatePreview(item.icon);
    if (item.url) handleUrlInput(item.url, false);
    document.getElementById('edit-modal').style.display = 'flex';
};

const selectIcon = (url) => {
    if (!url) return;
    document.getElementById('f-icon').value = url;
    updatePreview(url);
};

/**
 * 自动识别 URL 对应的图标备选项
 * @param {string} url - 网站 URL
 * @param {boolean} autoSelect - 是否自动选择最可能成功的图标
 */
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
            `https://api.iowen.cn/favicon/${domain}.png`,
            `https://favicon.qqsuu.cn/${domain}`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
        ];

        let firstSuccessIdx = -1;

        favs.forEach((favUrl, i) => {
            const txt = document.getElementById('txt-fav' + i);
            const img = document.getElementById('img-fav' + i);
            const opt = document.getElementById('opt-fav' + i);
            if (i === 4 && !txt) return; // 容错处理

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
                    
                    // 智能选优逻辑：如果开启了自动选择，且当前还没选过，选第一个加载成功的
                    if (autoSelect) {
                        const currentIconVal = document.getElementById('f-icon').value;
                        if (!currentIconVal || currentIconVal === '') {
                             if (firstSuccessIdx === -1) {
                                 firstSuccessIdx = i;
                                 selectIcon(favUrl);
                                 if (opt) opt.checked = true;
                                 const labels = ['原站', 'Iowen', 'QQSuu', 'DDG', 'Google'];
                                 showToast(`已自动匹配最优图标 (${labels[i] || '未知'})`);
                             }
                        }
                    }
                };
            }
        });

        // 默认预览 (给第一个 Iowen 接口)
        if (!document.getElementById('f-icon').value) {
            updatePreview(favs[1]);
        }
    } catch (e) { }
};

const updatePreview = (val) => {
    const box = document.getElementById('preview-box');
    if (!val) { box.innerHTML = '🔗'; return; }
    const safeVal = utils.escapeHTML(val);
    if (safeVal.startsWith('http')) {
        let fallbackAttr = `onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%23999\\'><path d=\\'M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z\\'/></svg>';"`;
        box.innerHTML = `<img src="${safeVal}" loading="lazy" ${fallbackAttr}>`;
    } else {
        box.innerHTML = `<span class="emoji-icon">${safeVal}</span>`;
    }
};

// ==================== 分类管理 ====================
const manageCats = () => {
    editingType = 'cats';
    document.getElementById('edit-title').innerText = '偏好与分类设置';

    const currentWidth = (appData.settings && appData.settings.cardWidth) ? appData.settings.cardWidth : 85;
    const currentBg = (appData.settings && appData.settings.bgUrl) ? appData.settings.bgUrl : '';
    const bgIsColor = /^#[0-9a-fA-F]{6}$/.test(currentBg);

    const themeOptions = [
        { value: 'auto', label: '跟随系统' },
        { value: 'light', label: '亮色模式' },
        { value: 'dark', label: '暗色模式' }
    ].map(opt => `<option value="${opt.value}" ${themeMode === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');

    document.getElementById('edit-form-body').innerHTML = `
        <div class="form-row" style="margin-bottom: 12px;">
            <label><i class="ri-ruler-2-line"></i> 网格尺寸</label>
            <div style="display:flex; flex-direction:column; gap:8px; flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="setting-width" value="${currentWidth}" style="flex:1;">
                    <span style="color:#666;">px</span>
                </div>
                <div class="preset-width-btns" style="display:flex; gap:6px;">
                    <button class="preset-w-btn" data-w="85" style="flex:1; padding:4px; font-size:11px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; cursor:pointer;">紧凑</button>
                    <button class="preset-w-btn" data-w="105" style="flex:1; padding:4px; font-size:11px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; cursor:pointer;">标准</button>
                    <button class="preset-w-btn" data-w="125" style="flex:1; padding:4px; font-size:11px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc; cursor:pointer;">舒适</button>
                </div>
            </div>
        </div>
        <div class="form-row" style="margin-bottom: 15px; background: rgba(57, 157, 255, 0.1); padding: 12px; border-radius: 12px; border: 1px solid rgba(57, 157, 255, 0.2);">
            <label style="color: #399dff;"><i class="ri-focus-3-line"></i> 极简沉浸</label>
            <div style="display:flex; align-items:flex-start; gap:8px; flex:1;">
                <input type="checkbox" id="setting-zen-mode" ${appData.settings && appData.settings.zenMode ? 'checked' : ''} style="width:20px; height:20px; cursor:pointer; margin-top:2px;">
                <span style="font-size:12px; color:rgba(255,255,255,0.7); line-height:1.4;">开启后仅显示搜索框，点击或滚动后展开书签区</span>
            </div>
        </div>
        <div class="form-row" style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
            <label><i class="ri-layout-top-line"></i> 搜索框位置</label>
            <select id="setting-search-pos" style="flex:1;">
                <option value="top" ${(appData.settings && appData.settings.searchPosition === 'top') || !(appData.settings && appData.settings.searchPosition) ? 'selected' : ''}>固定在页面顶部</option>
                <option value="belowFirst" ${appData.settings && appData.settings.searchPosition === 'belowFirst' ? 'selected' : ''}>首个分类下方（居中效果）</option>
            </select>
        </div>
        <div class="form-row" style="margin-bottom: 12px;">
            <label><i class="ri-image-line"></i> 自定义背景</label>
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="color" id="setting-bg-color" value="${bgIsColor ? currentBg : '#222222'}" style="width:40px; height:36px; padding:2px; border:none; border-radius:6px; cursor:pointer; background:transparent; flex-shrink:0;">
                <input type="text" id="setting-bg" value="${utils.escapeHTML(currentBg)}" placeholder="填URL或纯色, 留空使用Bing" style="flex:1;">
            </div>
        </div>
        <div class="form-row" style="margin-bottom: 12px;">
            <label><i class="ri-palette-line"></i> 主题模式</label>
            <select id="setting-theme" style="flex:1;">${themeOptions}</select>
        </div>
        <div class="form-row" style="margin-bottom: 12px;">
            <label><i class="ri-shadow-line"></i> 简约模式</label>
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" id="setting-simple-mode" ${simpleMode ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                <span style="font-size:12px; color:#999;">关闭背景模糊效果</span>
            </div>
        </div>
        <div class="form-row" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 15px;">
            <label><i class="ri-external-link-line"></i> 新窗口打开</label>
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" id="setting-new-tab" ${(appData.settings && appData.settings.openInNewTab) ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                <span style="font-size:12px; color:#999;">点击书签时在新标签页打开</span>
            </div>
        </div>
        <div style="margin-bottom: 10px; font-weight: bold; font-size: 14px; color: #399dff; display: flex; align-items: center; gap: 6px;">
            <i class="ri-list-settings-line"></i> 分类管理与排序
        </div>
        <div id="cat-list-sort" style="max-height: 280px; overflow-y: auto;">
            ${appData.categories.map((c) => `
                <div class="cat-item-row" data-id="${utils.escapeHTML(c.id)}" style="display:flex; gap:8px; margin-bottom:10px; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:10px;">
                    <i class="ri-drag-move-fill drag-handle"></i>
                    <input class="cat-icon-input" data-id="${utils.escapeHTML(c.id)}" value="${utils.escapeHTML(c.icon)}" style="width:40px; text-align:center; padding:5px">
                    <input class="cat-name-input" data-id="${utils.escapeHTML(c.id)}" value="${utils.escapeHTML(c.name)}" style="flex:1; padding:5px">
                    <label style="font-size:11px; color:#999; display:flex; align-items:center; gap:3px; flex-shrink:0; cursor:pointer;">
                        <input type="checkbox" class="cat-video-toggle" data-id="${utils.escapeHTML(c.id)}" ${c._isVideo ? 'checked' : ''} style="width:14px; height:14px; cursor:pointer;"> 🎬
                    </label>
                    <button class="action-mini btn-cat-hide" data-id="${utils.escapeHTML(c.id)}"><i class="ri-eye-${c.hidden ? 'off-' : ''}line"></i></button>
                    <button class="action-mini btn-cat-del" data-id="${utils.escapeHTML(c.id)}"><i class="ri-delete-bin-line"></i></button>
                </div>
            `).join('')}
        </div>
        <button class="tab-btn active" id="btn-add-cat" style="width:100%; margin-top:15px">+ 新增分类</button>
    `;

    document.getElementById('setting-width').addEventListener('input', (e) => changeCardWidth(e.target.value));
    
    document.querySelectorAll('.preset-w-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const w = btn.getAttribute('data-w');
            document.getElementById('setting-width').value = w;
            changeCardWidth(w);
            // Highlight selected
            document.querySelectorAll('.preset-w-btn').forEach(b => b.style.background = 'rgba(255,255,255,0.05)');
            btn.style.background = 'rgba(255,255,255,0.15)';
        });
    });

    document.getElementById('setting-theme').addEventListener('change', (e) => {
        themeMode = e.target.value;
        localStorage.setItem('nav_theme_mode', themeMode);
        applyThemeMode();
    });
    document.getElementById('setting-simple-mode').addEventListener('change', (e) => {
        simpleMode = e.target.checked;
        localStorage.setItem('nav_simple_mode', simpleMode);
        document.body.classList.toggle('no-blur', simpleMode);
    });
    document.getElementById('setting-new-tab').addEventListener('change', (e) => {
        if (!appData.settings) appData.settings = {};
        appData.settings.openInNewTab = e.target.checked;
        renderNav();
        saveAll(true);
    });
    document.getElementById('setting-search-pos').addEventListener('change', (e) => {
        if (!appData.settings) appData.settings = {};
        appData.settings.searchPosition = e.target.value;
        renderNav();
        saveAll(true);
    });
    document.getElementById('setting-zen-mode').addEventListener('change', (e) => {
        if (!appData.settings) appData.settings = {};
        appData.settings.zenMode = e.target.checked;
        isZenTempExpanded = false; // 切换设置时重置临时状态
        renderNav();
        saveAll(true);
    });

    const bgColorPicker = document.getElementById('setting-bg-color');
    const bgTextInput = document.getElementById('setting-bg');
    bgColorPicker.addEventListener('input', () => {
        bgTextInput.value = bgColorPicker.value;
        if (!appData.settings) appData.settings = {};
        appData.settings.bgUrl = bgColorPicker.value;
        applyBackgroundConfig();
    });
    bgTextInput.addEventListener('input', () => {
        const val = bgTextInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) bgColorPicker.value = val;
        if (!appData.settings) appData.settings = {};
        appData.settings.bgUrl = val;
        applyBackgroundConfig();
    });
    document.getElementById('btn-add-cat').addEventListener('click', addCat);

    const catListSort = document.getElementById('cat-list-sort');
    catListSort.addEventListener('change', (e) => {
        if (e.target.classList.contains('cat-icon-input')) {
            updateCatData(e.target.getAttribute('data-id'), 'icon', e.target.value);
        } else if (e.target.classList.contains('cat-name-input')) {
            updateCatData(e.target.getAttribute('data-id'), 'name', e.target.value);
        } else if (e.target.classList.contains('cat-video-toggle')) {
            updateCatData(e.target.getAttribute('data-id'), '_isVideo', e.target.checked);
            renderNav();
        }
    });
    catListSort.addEventListener('click', (e) => {
        const hideBtn = e.target.closest('.btn-cat-hide');
        if (hideBtn) { e.preventDefault(); toggleHide('categories', hideBtn.getAttribute('data-id')); }
        const delBtn = e.target.closest('.btn-cat-del');
        if (delBtn) { e.preventDefault(); deleteObj('categories', delBtn.getAttribute('data-id')); }
    });

    new Sortable(catListSort, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: () => {
            const newIdOrder = Array.from(catListSort.querySelectorAll('.cat-item-row')).map(el => el.getAttribute('data-id'));
            appData.categories = newIdOrder.map(id => appData.categories.find(c => c.id === id));
            let newGlobalItems = [];
            appData.categories.forEach(cat => {
                newGlobalItems.push(...appData.items.filter(i => i.catId === cat.id));
            });
            appData.items = newGlobalItems;
            renderNav();
            saveAll(true);
        }
    });

    document.getElementById('edit-modal').style.display = 'flex';
};

const changeCardWidth = (val) => {
    if (!appData.settings) appData.settings = {};
    appData.settings.cardWidth = parseInt(val) || 85;
    updateGridWidth();
};

const updateCatData = (id, field, val) => {
    const cat = appData.categories.find(c => c.id === id);
    if (cat) cat[field] = val;
    renderNav();
};

const addCat = () => {
    const usedLetters = appData.categories.map(c => c.id.charAt(0).toUpperCase());
    let nextLetter = 'A';
    if (usedLetters.length > 0) {
        const maxCharCode = Math.max(...usedLetters.map(l => l.charCodeAt(0)));
        nextLetter = String.fromCharCode(maxCharCode + 1);
    }
    if (nextLetter > 'Z') nextLetter = 'Z' + Date.now().toString().slice(-2);
    appData.categories.push({ id: `${nextLetter}01`, name: '新分类', icon: '📁', hidden: false });
    manageCats();
    renderNav();
};

const confirmEdit = () => {
    if (editingType === 'items') {
        const url = document.getElementById('f-url').value;
        const title = document.getElementById('f-title').value;
        const desc = document.getElementById('f-desc').value;
        const icon = document.getElementById('f-icon').value;
        const bgColor = document.getElementById('f-bg-color-text').value.trim();
        const catId = document.getElementById('f-cat').value;

        if (editingId) {
            const idx = appData.items.findIndex(i => i.id === editingId);
            if (idx > -1) {
                appData.items[idx] = { ...appData.items[idx], url, title, desc, icon, bgColor, catId };
            }
        } else {
            // 使用更可靠的全局唯一 ID，避免分类 ID 首字母相同导致的冲突
            const newId = 'i' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            appData.items.push({ id: newId, url, title, desc, icon, bgColor, catId, hidden: false });
        }
    }
    renderNav();
    closeModal();
    saveAll(false);
};

const toggleHide = (type, id) => {
    const item = appData[type].find(o => o.id === id);
    if (item) item.hidden = !item.hidden;
    saveAll(false);
    renderNav();
    if (type === 'categories') manageCats();
};

const deleteObj = async (type, id) => {
    if (!isAdmin) {
        showToast("管理权限未开启，无法删除", "#e67e22");
        return;
    }
    if (!id) {
        console.error("Delete failed: No ID provided");
        return;
    }
    const confirmMsg = type === 'categories' ? '确定删除该分类及其下的所有网址吗？' : '确定删除该网址吗？';
    
    if (confirm(confirmMsg)) {
        showLoader('正在处理删除请求...');
        try {
            console.log(`Deleting ${type} with ID: ${id}`);
            const targetId = String(id);

            if (type === 'categories') {
                appData.categories = appData.categories.filter(c => String(c.id) !== targetId);
                appData.items = appData.items.filter(i => String(i.catId) !== targetId);
            } else {
                appData.items = appData.items.filter(i => String(i.id) !== targetId);
            }

            // 同步前先刷新 UI 给用户即时反馈
            renderNav();
            if (type === 'categories') manageCats();
            
            // 发起持久化保存
            const success = await saveAll(false);
            
            if (success) {
                showToast("删除并同步成功");
            } else {
                showToast("本地已移除，但云端保存失败", "#e67e22");
            }
        } catch (err) {
            console.error("Delete error:", err);
            showToast("删除操作中途出错", "#e74c3c");
        } finally {
            hideLoader();
        }
    }
};

// ==================== 认证相关 ====================
const doLogin = async () => {
    showLoader('正在验证管理员身份...');
    try {
        const rawPwd = document.getElementById('auth-input').value.trim();
        // 如果环境变量 TOKEN 为空，理论上空密码是对的，这里不强制拦截，只做简单提示
        if (!rawPwd && !confirm("您正在尝试使用空密码登录，如果未设置 TOKEN 变量这是正确的。确认继续？")) {
            hideLoader();
            return;
        }

        sysToken = await hashPassword(rawPwd);
        localStorage.setItem('nav_token', sysToken);
        document.getElementById('auth-overlay').style.display = 'none';

        await init(true);
    } catch (err) {
        console.error("登录验证失败:", err);
    } finally {
        hideLoader();
    }

    if (!isAdmin) {
        showToast("验证失败，密码不正确", "#e74c3c");
        localStorage.removeItem('nav_token');
        sysToken = '';
    } else {
        showToast("已进入管理模式");
        document.getElementById('auth-input').value = '';
    }
};

const doLogout = async () => {
    showLoader('正在退出管理模式...');
    try {
        await new Promise(r => setTimeout(r, 600));
        localStorage.removeItem('nav_token');
        sysToken = '';
        isAdmin = false;
        appData.isAdmin = false;
        localStorage.setItem('nav_app_data', JSON.stringify(appData));
        await init(true);
    } catch (err) {
        console.error("登出异常:", err);
    } finally {
        hideLoader();
        showToast("已退出管理模式", "#399dff");
    }
};

// ==================== 数据操作 ====================
const saveAll = async (silent = false) => {
    if (isAdmin === false) {
        if (!silent) showToast("未进入管理状态", "#e67e22");
        return false;
    }
    if (!silent) showLoader('正在同步配置中...');

    const dataToSave = { ...appData };
    delete dataToSave.isAdmin;
    delete dataToSave.bgUrl;
    localStorage.setItem('nav_app_data', JSON.stringify(appData));

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        if (!silent) hideLoader();
        if (res.ok) {
            if (!silent) showToast("保存成功！");
            return true;
        } else {
            if (!silent) showToast("保存失败，权限不足", "#e74c3c");
            return false;
        }
    } catch (error) {
        if (!silent) { 
            hideLoader(); 
            showToast("网络错误，配置仅保存在本地", "#e67e22"); 
        }
        return false;
    }
};

const importConfig = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.categories && imported.items) {
                appData = imported;
                renderTools();
                renderNav();
                await saveAll(false);
                showToast("配置导入成功！");
            } else {
                showToast("无效的配置文件格式", "#e74c3c");
            }
        } catch (err) {
            showToast("文件解析失败", "#e74c3c");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

const exportConfig = () => {
    let sortedItems = [];
    appData.categories.forEach(cat => {
        sortedItems.push(...appData.items.filter(i => i.catId === cat.id));
    });
    const dataToExport = { settings: appData.settings, categories: appData.categories, items: sortedItems };
    let jsonStr = JSON.stringify(dataToExport, null, 2);
    jsonStr = jsonStr.replace(/\{[\s\S]*?\}/g, (match) => match.replace(/\n\s+/g, ' '));

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `nav-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("配置已按紧凑格式导出");
};

const resetConfig = async () => {
    if (!confirm('确定恢复默认配置？此操作不可撤销。')) return;
    showLoader('正在重置...');
    try {
        const res = await fetch('/api/config', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken }
        });
        hideLoader();
        if (res.ok) {
            localStorage.removeItem('nav_app_data');
            showToast("已重置为默认配置");
            init(true);
        } else {
            showToast("重置失败，权限不足", "#e74c3c");
        }
    } catch (e) {
        hideLoader();
        showToast("网络错误", "#e74c3c");
    }
};

const closeModal = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

// ==================== 高颜值多模式检索模块 ====================
/**
 * 初始化快捷导航（回到顶部/直达底部）
 */
const initQuickNav = () => {
    const group = document.getElementById('quick-nav-group');
    const toTopBtn = document.getElementById('scroll-to-top');
    const toBottomBtn = document.getElementById('scroll-to-bottom');
    
    if (!group || !toTopBtn || !toBottomBtn) return;

    // 监听滚动显示/隐藏
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            group.classList.add('visible');
        } else {
            group.classList.remove('visible');
        }
    });

    // 回到顶部
    toTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // 直达底部
    toBottomBtn.addEventListener('click', () => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
    });
};

const initSearch = () => {
    const seaInput = document.getElementById('sea-input');
    const seaClearBtn = document.getElementById('sea-clear-btn');
    const seaDropdown = document.getElementById('sea-dropdown');
    const resultsHeader = document.getElementById('local-results-header');
    const resultsList = document.getElementById('local-results-list');
    
    // 新增：搜素引擎选择器相关
    const engineTrigger = document.getElementById('current-engine-trigger');
    const engineList = document.getElementById('engine-list');
    const engineItems = document.querySelectorAll('.engine-item');

    if (!seaInput) return;

    let currentEngine = localStorage.getItem('nav_search_engine') || 'bing';
    let currentEnginePrefix = localStorage.getItem('nav_search_prefix') || 'https://cn.bing.com/search?q=';

    // 更新触发器 UI 的函数
    const updateEngineTriggerUI = (engineId) => {
        const item = Array.from(engineItems).find(i => i.getAttribute('data-engine') === engineId);
        if (item && engineTrigger) {
            const logo = item.querySelector('.engine-logo').innerHTML;
            engineTrigger.innerHTML = logo;
            
            // 同时更新所有 item 的激活状态
            engineItems.forEach(i => i.classList.toggle('active', i === item));
        }
    };

    // 初始化 UI
    updateEngineTriggerUI(currentEngine);

    // 1. 搜索引擎切换逻辑
    if (engineTrigger) {
        engineTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 先尝试移除所有之前的状态，再切换
            const isShown = engineList.classList.contains('show');
            document.querySelectorAll('.engine-list').forEach(el => el.classList.remove('show'));
            if (!isShown) {
                engineList.classList.add('show');
            }
        });
    }

    engineItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const engineId = item.getAttribute('data-engine');
            const actionUrl = item.getAttribute('data-action');
            
            if (engineId && actionUrl) {
                currentEngine = engineId;
                currentEnginePrefix = actionUrl;
                
                // 持久化选择
                localStorage.setItem('nav_search_engine', currentEngine);
                localStorage.setItem('nav_search_prefix', currentEnginePrefix);
                
                updateEngineTriggerUI(currentEngine);
                engineList.classList.remove('show');
                seaInput.focus();
    
                // 如果输入框有内容，切换引擎顺便触发搜索
                const query = seaInput.value.trim();
                if (query) {
                    window.open(currentEnginePrefix + encodeURIComponent(query), '_blank');
                }
            }
        });
    });

    // 2. 渲染空值下的“导航全部分类快捷直达”
    const renderCategoryShortcuts = () => {
        resultsHeader.innerHTML = `<i class="ri-folder-open-line"></i> 快速查找分类直达`;
        
        let cats = isAdmin ? [...appData.categories] : appData.categories.filter(c => !c.hidden);
        if (cats.length === 0) {
            resultsList.innerHTML = `<div class="local-search-empty">暂无任何分类数据</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'search-categories-grid';
        
        cats.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = 'search-cat-btn';
            btn.innerHTML = `<span class="cat-icon">${utils.escapeHTML(cat.icon)}</span> ${utils.escapeHTML(cat.name)}`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                seaDropdown.style.display = 'none';
                seaInput.blur();
                const section = document.getElementById('section-' + cat.id);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            grid.appendChild(btn);
        });

        resultsList.innerHTML = '';
        resultsList.appendChild(grid);
    };

    let currentSearchIndex = -1;
    let searchResultItems = [];

    // 3. 执行本站模糊联想搜索
    const executeLocalSearch = (val) => {
        const query = val.toLowerCase().trim();
        currentSearchIndex = -1; // 重置选中索引

        if (!query) {
            seaClearBtn.style.display = 'none';
            renderCategoryShortcuts();
            return;
        }

        seaClearBtn.style.display = 'flex';
        // 模糊过滤
        const matched = appData.items.filter(item => {
            const titleMatch = item.title && item.title.toLowerCase().includes(query);
            const descMatch = item.desc && item.desc.toLowerCase().includes(query);
            const urlMatch = item.url && item.url.toLowerCase().includes(query);
            
            // 归属分类名称模糊过滤
            const parentCat = appData.categories.find(c => c.id === item.catId);
            const catMatch = parentCat && parentCat.name.toLowerCase().includes(query);

            return (titleMatch || descMatch || urlMatch || catMatch) && (isAdmin || !item.hidden);
        });

        if (matched.length === 0) {
            resultsHeader.innerHTML = `<i class="ri-global-line"></i> 本站搜索`;
            resultsList.innerHTML = `<div class="local-search-empty">未匹配到本站内容，回车直接进行 Bing 检索 🔍</div>`;
            searchResultItems = [];
            return;
        }

        resultsHeader.innerHTML = `<i class="ri-global-line"></i> 匹配本站内容 (${matched.length} 项)`;
        resultsList.innerHTML = '';
        searchResultItems = [];

        matched.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'local-result-item';
            itemElement.setAttribute('data-index', index);

            const parentCat = appData.categories.find(c => c.id === item.catId);
            const catName = parentCat ? parentCat.name : '未分类';

            const fallbackAttr = `onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%23999\\'><path d=\\'M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z\\'/></svg>';"`;
            const safeIcon = utils.escapeHTML(item.icon);
            const isImgIcon = item.icon && item.icon.startsWith('http');
            const iconHtml = isImgIcon
                ? `<img src="${safeIcon}" loading="lazy" ${fallbackAttr}>`
                : `<span class="emoji-icon" style="font-size:16px;">${safeIcon || '🔗'}</span>`;

            itemElement.innerHTML = `
                <div class="local-result-left">
                    <div class="local-result-icon">${iconHtml}</div>
                    <div class="local-result-info">
                        <div class="local-result-title">${utils.escapeHTML(item.title)}</div>
                        <div class="local-result-desc">${utils.escapeHTML(item.desc || item.url)}</div>
                    </div>
                </div>
                <div class="local-result-cat">${utils.escapeHTML(catName)}</div>
            `;

            const triggerAction = () => {
                seaDropdown.style.display = 'none';
                seaInput.value = '';
                seaClearBtn.style.display = 'none';
                seaInput.blur();

                const target = (appData.settings && appData.settings.openInNewTab) ? '_blank' : '_self';
                const videoInfo = detectVideoPlatform(item.url);
                if (videoInfo) {
                    openVideoModal(item, videoInfo);
                } else if (item.url) {
                    window.open(item.url, target);
                }
            };

            itemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerAction();
            });

            resultsList.appendChild(itemElement);
            searchResultItems.push({ element: itemElement, action: triggerAction });
        });
    };

    const updateSearchHighlight = () => {
        searchResultItems.forEach((item, idx) => {
            item.element.classList.toggle('active', idx === currentSearchIndex);
            if (idx === currentSearchIndex) {
                item.element.scrollIntoView({ block: 'nearest' });
            }
        });
    };

    // 4. 事件监听与绑定
    seaInput.addEventListener('focus', () => {
        seaDropdown.style.display = 'flex';
        executeLocalSearch(seaInput.value);
    });

    seaInput.addEventListener('input', (e) => {
        executeLocalSearch(e.target.value);
    });

    // 清空按钮事件
    seaClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        seaInput.value = '';
        seaClearBtn.style.display = 'none';
        executeLocalSearch('');
        seaInput.focus();
    });

    // 键盘回车快捷搜索网页与本站内容导航
    seaInput.addEventListener('keydown', (e) => {
        if (searchResultItems.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentSearchIndex = (currentSearchIndex + 1) % searchResultItems.length;
                updateSearchHighlight();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentSearchIndex = (currentSearchIndex - 1 + searchResultItems.length) % searchResultItems.length;
                updateSearchHighlight();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                currentSearchIndex = (currentSearchIndex + 1) % searchResultItems.length;
                updateSearchHighlight();
                return;
            }
            if (e.key === 'Enter') {
                if (currentSearchIndex >= 0) {
                    e.preventDefault();
                    searchResultItems[currentSearchIndex].action();
                    return;
                }
            }
        }

        if (e.key === 'Enter') {
            const query = seaInput.value.trim();
            if (query) {
                window.open(currentEnginePrefix + encodeURIComponent(query), '_blank');
            }
        }
    });

    // 点击页面其他区域自动关闭
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('search-wrapper');
        const selector = document.getElementById('search-engine-selector');
        if (wrapper && !wrapper.contains(e.target)) {
            seaDropdown.style.display = 'none';
        }
        if (selector && !selector.contains(e.target)) {
            engineList.classList.remove('show');
        }
    });

    // 自动聚焦搜索框
    setTimeout(() => {
        if (seaInput) seaInput.focus();
    }, 200);
};

// ==================== 事件绑定 ====================
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('auth-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
document.getElementById('btn-close-auth').addEventListener('click', () => { document.getElementById('auth-overlay').style.display = 'none'; });
document.getElementById('btn-confirm-edit').addEventListener('click', confirmEdit);
document.getElementById('btn-close-edit').addEventListener('click', closeModal);
document.getElementById('import-file').addEventListener('change', importConfig);
