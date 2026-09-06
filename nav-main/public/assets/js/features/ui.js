/**
 * @fileoverview Feature module: ui
 * Split from the former app.js God-file. Window bridge kept for inline onclick.
 */
const initThemeMode = (...args) => window.initThemeMode(...args);
const manualSyncCloud = (...args) => window.manualSyncCloud(...args);
const escapeHTML = (...args) => (window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(...args) : String(args[0] ?? ''));
const closeAllModals = (...args) => window.closeAllModals(...args);
const updateStyles = (...args) => window.updateStyles(...args);
const renderNav = (...args) => window.renderNav(...args);
const renderTools = (...args) => window.renderTools(...args);
const toggleSidebar = (...args) => window.toggleSidebar(...args);
const initSidebar = (...args) => window.initSidebar(...args);
const initZenMode = (...args) => window.initZenMode(...args);
const initSearch = (...args) => window.initSearch(...args);
const initAuthUI = (...args) => window.initAuthUI(...args);
const initGlobalEvents = (...args) => window.initGlobalEvents(...args);
const initAnnouncements = (...args) => window.initAnnouncements(...args);
const initLocalBgImage = (...args) => window.initLocalBgImage(...args);
const getBingWallpaper = (...args) => window.getBingWallpaper(...args);
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

// ==================== 2. 辅助工具 ====================
window.sysSiteConfig = null; // 全局系统配置缓存

// 统一 SQLite/D1 无时区 UTC 时间安全解析网关 (解决北京时区差 8 小时 Bug)
window.parseUtcDate = (dateInput) => {
    if (!dateInput) return new Date();
    if (typeof dateInput === 'string') {
        let cleanInput = dateInput.trim();
        // 匹配 YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DD HH:MM:SS.SSS 格式，如果是 SQLite 默认 UTC 字符串，强制补上 T 和 Z 标记作为标准 UTC 解析
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleanInput)) {
            cleanInput = cleanInput.replace(' ', 'T') + 'Z';
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+$/.test(cleanInput)) {
            cleanInput = cleanInput.replace(' ', 'T') + 'Z';
        }
        return new Date(cleanInput);
    }
    return typeof dateInput === 'object' ? dateInput : new Date(dateInput);
};

window.formatSystemDate = (dateInput, includeTime = false) => {
    if (!dateInput) return '';
    const dateObj = window.parseUtcDate(dateInput);
    if (isNaN(dateObj.getTime())) return '';
    const tz = window.sysSiteConfig?.systemTimezone || 'Asia/Shanghai';
    try {
        const options = {
            timeZone: tz,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
        }
        return dateObj.toLocaleString('zh-CN', options);
    } catch (e) {
        return includeTime ? dateObj.toLocaleString('zh-CN', { hour12: false }) : dateObj.toLocaleDateString('zh-CN');
    }
};

// 全站 SEO 与标题下发 (静默处理鉴权失败)
const initSiteConfig = async () => {
    window.initSiteConfig = initSiteConfig;
    try {
        // 如果没有 token，大概率会 403，本地环境下我们选择直接跳过或静默处理
        const res = await fetch('/api/admin/site-config', {
            headers: window.sysToken ? { 'Authorization': window.sysToken } : {}
        });

        if (res.status === 403 || res.status === 401) {
            // 权限不足时不报 error，仅作为普通 warn 或忽略
            console.log('[Config] Site config is protected, using defaults.');
            return;
        }

        if (res.ok) {
            const config = await res.json();
            window.sysSiteConfig = config; // 保存至全局变量
            document.title = config.siteTitle || "CloudNav 导航";
            const favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="apple-touch-icon"]');
            if (favicon && config.faviconUrl) favicon.href = config.faviconUrl;

            // SEO Meta 注入
            if (config.seoDescription) {
                let descMeta = document.querySelector('meta[name="description"]');
                if (!descMeta) {
                    descMeta = document.createElement('meta');
                    descMeta.name = "description";
                    document.head.appendChild(descMeta);
                }
                descMeta.content = config.seoDescription;
            }

            if (config.seoKeywords) {
                let keyMeta = document.querySelector('meta[name="keywords"]');
                if (!keyMeta) {
                    keyMeta = document.createElement('meta');
                    keyMeta.name = "keywords";
                    document.head.appendChild(keyMeta);
                }
                keyMeta.content = config.seoKeywords;
            }
        }
    } catch (e) { console.warn('[Config] Failed to load site config'); }
};

// 公告系统
const showToast = (m, c = "#27ae60") => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = m; t.style.background = c; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
};
window.showToast = showToast;

const showLoader = (t) => {
    const el = document.getElementById('global-loading-text');
    if (el) el.innerText = t;
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
};
window.showLoader = showLoader;

const hideLoader = () => {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'none';
};
window.hideLoader = hideLoader;
// Window bridge for cross-module and inline onclick callers
window.initSiteConfig = initSiteConfig;
