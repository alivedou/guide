/**
 * @fileoverview Feature module: styles
 * Split from the former app.js God-file. Window bridge kept for inline onclick.
 */
const initThemeMode = (...args) => window.initThemeMode(...args);
const manualSyncCloud = (...args) => window.manualSyncCloud(...args);
const escapeHTML = (...args) => (window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(...args) : String(args[0] ?? ''));
const showToast = (...args) => window.showToast(...args);
const showLoader = (...args) => window.showLoader(...args);
const hideLoader = (...args) => window.hideLoader(...args);
const closeAllModals = (...args) => window.closeAllModals(...args);
const renderNav = (...args) => window.renderNav(...args);
const renderTools = (...args) => window.renderTools(...args);
const toggleSidebar = (...args) => window.toggleSidebar(...args);
const initSidebar = (...args) => window.initSidebar(...args);
const initZenMode = (...args) => window.initZenMode(...args);
const initSearch = (...args) => window.initSearch(...args);
const initAuthUI = (...args) => window.initAuthUI(...args);
const initGlobalEvents = (...args) => window.initGlobalEvents(...args);
const initAnnouncements = (...args) => window.initAnnouncements(...args);
const initSiteConfig = (...args) => window.initSiteConfig(...args);
const initLocalBgImage = (...args) => window.initLocalBgImage(...args);
const handleAuthError = (...args) => window.handleAuthError(...args);
const openLoginModal = (...args) => window.openLoginModal(...args);
const openNoticeCenter = (...args) => window.openNoticeCenter(...args);
const refreshNoticeBadge = (...args) => window.refreshNoticeBadge(...args);
const checkSWUpdate = (...args) => window.checkSWUpdate(...args);
const checkAnnouncementsUpdate = (...args) => window.checkAnnouncementsUpdate(...args);
const initAnnouncementsWatcher = (...args) => window.initAnnouncementsWatcher(...args);
const wakeUpNavigation = (...args) => window.wakeUpNavigation(...args);
const closeSearch = (...args) => window.closeSearch(...args);
const handleDataSaveOnExit = (...args) => window.handleDataSaveOnExit(...args);
const toggleSkeleton = (...args) => window.toggleSkeleton(...args);
const recordClick = (...args) => window.recordClick(...args);
const syncClicksToCloud = (...args) => window.syncClicksToCloud(...args);
const getFrequentItemsData = (...args) => window.getFrequentItemsData(...args);
const formatSystemDate = (...args) => window.formatSystemDate(...args);
const parseUtcDate = (...args) => window.parseUtcDate(...args);
const playVideoInline = (...args) => window.playVideoInline(...args);
const closeVideoModal = (...args) => window.closeVideoModal(...args);
const checkAutoSyncSchedule = (...args) => window.checkAutoSyncSchedule(...args);
const showTempPasswordChangeAlert = (...args) => window.showTempPasswordChangeAlert(...args);
const openProfileCenter = (...args) => window.openProfileCenter(...args);
const showAuthModal = (...args) => window.showAuthModal(...args);
const doLogin = (...args) => window.doLogin(...args);
const doRegister = (...args) => window.doRegister(...args);
const doLogout = (...args) => window.doLogout(...args);
const doResetConfig = (...args) => window.doResetConfig(...args);
const initSharedPage = (...args) => window.initSharedPage(...args);
const renderViralBadge = (...args) => window.renderViralBadge(...args);
const getCoreDataFingerprint = (...args) => window.getCoreDataFingerprint(...args);
const openJsonEditor = (...args) => window.openJsonEditor(...args);
const requireAdminAuth = (...args) => window.requireAdminAuth(...args);
const requireSystemConfirm = (...args) => window.requireSystemConfirm(...args);
const getEmojiPickerHTML = (...args) => window.getEmojiPickerHTML(...args);
const initEmojiPicker = (...args) => window.initEmojiPicker(...args);
const toggleEmojiPicker = (...args) => window.toggleEmojiPicker(...args);
const saveItem = (...args) => window.saveItem(...args);
const init = (...args) => window.init(...args);
const autoAdjustSidebar = (...args) => window.autoAdjustSidebar(...args);
const updateNetworkStatus = (...args) => window.updateNetworkStatus(...args);
const resetZenSleepTimer = (...args) => window.resetZenSleepTimer(...args);
const setSearchEngine = (...args) => window.setSearchEngine(...args);
const openVisualLab = (...args) => window.openVisualLab(...args);
const openSyncCenter = (...args) => window.openSyncCenter(...args);
const toggleZenMode = (...args) => window.toggleZenMode(...args);
const togglePageManagement = (...args) => window.togglePageManagement(...args);
const setThemeMode = (...args) => window.setThemeMode(...args);
const applyThemeUpdate = (...args) => window.applyThemeUpdate(...args);

const updateStyles = () => {
    // 1. 处理密度
    const density = window.appData.settings?.density || 'standard';
    document.body.classList.remove('density-compact', 'density-standard', 'density-comfortable');
    document.body.classList.add(`density-${density}`);

    // 2. 处理侧边栏风格 - 锁定经典毛玻璃
    document.body.classList.remove('sidebar-style-colorful');
    document.body.classList.add('sidebar-style-classic');

    // 3. 处理视图模态 (逻辑解耦与优先级判定)
    const isZen = window.appData.settings?.zenMode === true && !window.isPageManagementMode;
    // 优先级判定：禅意模式强制开启隔离 (Primary) > 常规模式的用户设置 (Secondary)
    const isEffectivelyIsolated = isZen || window.appData.settings?.isolatedView === true;

    document.body.classList.toggle('view-isolated', isEffectivelyIsolated);
    document.body.classList.toggle('zen-active', isZen);

    // 4. 处理卡片宽度 (彻底与 CSS 密度规范一致)
    // 移动端/手机端下由于屏幕极窄，强行忽略用户自定义偏好，完美向未登录游客态看齐（无条件复用 CSS 默认 70px/75px 黄金标准）
    const w = window.appData.settings?.cardWidth;
    const isMobile = window.innerWidth <= 768;
    if (!w || isMobile) {
        document.documentElement.style.removeProperty('--card-w');
        document.documentElement.style.removeProperty('--card-h');
    } else {
        document.documentElement.style.setProperty('--card-w', w + 'px');
        document.documentElement.style.setProperty('--card-h', w + 'px');
    }

    // 5. 处理禅意静默态逻辑  - 存在打开的弹窗时，强制禁用静默态以保留背景和操作面板
    const isModalOpen = (document.getElementById('edit-modal')?.style.display === 'flex') ||
                         (document.getElementById('monaco-modal')?.style.display === 'block') ||
                         (document.getElementById('auth-overlay')?.style.display === 'block');

    if (isZen && !window.isZenTempExpanded && !isModalOpen) {
        document.body.classList.add('zen-silent');
    } else {
        document.body.classList.remove('zen-silent');
    }

    // 容错调用公告刷新，确保不阻塞主样式更新
    try {
        if (typeof refreshNoticeBadge === 'function') refreshNoticeBadge();
    } catch (e) { console.warn('[Notice] UI sync failed'); }

    // 背景阶梯式对齐与类型标记
    let bg = window.appData.settings?.bgUrl;

    // 💡 针对公开分享页的特殊处理：若原作者使用了“本地上传图片”作为壁纸，
    // 由于该图片只保存在原作者本地浏览器的 IndexedDB 中，访客访问时绝对拿不到。
    // 为了防止页面背景空白或显示破碎，我们强行将其重置为空，以便访客自动加载必应每日壁纸！
    if (window.isSharedPageMode && bg === 'local_upload') {
        bg = '';
    }

    if (bg && bg.trim() !== '') {
        console.log('[Style] Applying user custom background:', bg);
        document.body.dataset.bgType = 'custom';
        if (bg === 'local_upload') {
            // 🚀 读取本地缓存的高清 Base64 格式壁纸
            const localBg = window.navLocalBgImage || localStorage.getItem('nav_local_bg_image');
            if (localBg) {
                document.body.style.background = `url("${localBg}") center/cover fixed`;
            } else {
                document.body.style.background = `url("/assets/img/default-bg.jpg") center/cover fixed`; // 安全兜底
            }
        } else if (bg.startsWith('http')) {
            document.body.style.background = `url("${bg}") center/cover fixed`;
        } else {
            document.body.style.background = bg;
        }
    } else {
        const cache = localStorage.getItem('nav_bing_cache');
        let bingUrl = null;
        if (cache) {
            try {
                const parsed = JSON.parse(cache);
                if (parsed.url && parsed.url.startsWith('http')) {
                    bingUrl = parsed.url;
                }
            } catch (e) {}
        }

        if (bingUrl) {
            console.log('[Style] Applying cached Bing background:', bingUrl);
            document.body.dataset.bgType = 'bing';
            document.body.style.background = `url("${bingUrl}") center/cover fixed`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
        } else {
            console.log('[Style] No valid background found, clearing inline styles for CSS fallback.');
            document.body.dataset.bgType = 'none';
            document.body.style.background = '';
        }
    }

    // 处理背景遮罩
    document.body.classList.toggle('no-bg-mask', window.appData.settings?.hideBgMask === true);

    // 同步响应式侧边栏状态
    if (window.autoAdjustSidebar) window.autoAdjustSidebar();
};
window.updateStyles = updateStyles;
// Bing 壁纸获取与缓存优化 (先用旧图，异步更同步)
const getBingWallpaper = async () => {
    const cache = localStorage.getItem('nav_bing_cache');
    const now = Date.now();
    let oldUrl = null;

    if (cache) {
        try {
            const parsed = JSON.parse(cache);
            // 增加安全性校验，如果缓存的路径不是绝对路径（http开头），则视为无效缓存
            if (parsed.url && parsed.url.startsWith('http')) {
                oldUrl = parsed.url;
                if (now - parsed.timestamp < 43200000) { // 12h 内视为新鲜
                    return oldUrl;
                }
            } else {
                localStorage.removeItem('nav_bing_cache');
            }
        } catch (e) {
            localStorage.removeItem('nav_bing_cache');
        }
    }

    // 异步拉取逻辑
    const fetchNew = async () => {
        try {
            // 增加随机参数防止浏览器缓存 304 导致的数据不更新
            const res = await fetch(`/api/bing?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            // 校验响应类型，防止拿到 HTML 错误页
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned HTML/Text instead of JSON (likely 404 or Proxy Error)');
            }

            const data = await res.json();

            if (!data.images || !data.images[0]) throw new Error('Invalid Bing response');

            const url = data.images[0].url;
            localStorage.setItem('nav_bing_cache', JSON.stringify({ url, timestamp: now }));

            // 如果新图和旧图不同，触发 UI 刷新
            if (url !== oldUrl) {
                updateStyles();
            }
            return url;
        } catch (e) {
            console.error('[Bing] 抓取失败:', e.message);
            return oldUrl;
        }
    };

    // 如果有旧图，先立即返回旧图，异步去更新
    if (oldUrl) {
        fetchNew(); // 后台跑，不 await
        return oldUrl;
    }

    // 彻底没缓存，才去等待拉取
    return await fetchNew();
};
// Window bridge for cross-module and inline onclick callers
window.getBingWallpaper = getBingWallpaper;
