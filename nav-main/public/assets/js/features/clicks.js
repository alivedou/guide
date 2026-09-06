/**
 * @fileoverview Feature module: clicks
 * Split from the former app.js God-file. Window bridge kept for inline onclick.
 */
const initThemeMode = (...args) => window.initThemeMode(...args);
const manualSyncCloud = (...args) => window.manualSyncCloud(...args);
const escapeHTML = (...args) => (window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(...args) : String(args[0] ?? ''));
const showToast = (...args) => window.showToast(...args);
const showLoader = (...args) => window.showLoader(...args);
const hideLoader = (...args) => window.hideLoader(...args);
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
const initSiteConfig = (...args) => window.initSiteConfig(...args);
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

const getFrequentItemsData = () => {
    try {
        const h = JSON.parse(localStorage.getItem('nav_clicks_history') || '{}');
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
        const counts = {};

        Object.keys(h).forEach(id => {
            if (!Array.isArray(h[id])) return;
            const valid = h[id].filter(ts => ts > sevenDaysAgo);
            if (valid.length >= 10) counts[id] = valid.length;
        });
        return counts;
    } catch (e) { return {}; }
};

const recordClick = (id) => {
    let h = JSON.parse(localStorage.getItem('nav_clicks_history') || '{}');
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    if (!h[id]) h[id] = [];
    h[id].push(now);
    h[id] = h[id].filter(ts => ts > sevenDaysAgo);

    localStorage.setItem('nav_clicks_history', JSON.stringify(h));

    // 触发防抖同步
    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(syncClicksToCloud, 5000); // 停止操作 5 秒后上报
};

// 云端同步点击数据 - 增强版)
const syncClicksToCloud = async () => {
    if (!window.sysToken || window.isAdmin) return;

    const clicks = localStorage.getItem('nav_clicks_history');
    if (!clicks) return;

    const payload = { ...window.appData, clicks_history: JSON.parse(clicks) };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Authorization': window.sysToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) return handleAuthError(); // Token 过期

        if (res.status === 403) {
            const err = await res.json();
            if (err.code === 'ERR_QUOTA_EXCEEDED') {
                return showToast(err.error || "已达到配额上限", "#e74c3c");
            }
        }

        if (res.ok) {
            console.log('[Sync] Cloud sync successful');
            window.syncRetryCount = 0;
        } else {
            throw new Error('Sync failed');
        }
    } catch (e) {
        console.warn('[Sync] Background sync failed:', e.message);
    }
};
// Window bridge for cross-module and inline onclick callers
window.getFrequentItemsData = getFrequentItemsData;
window.recordClick = recordClick;
window.syncClicksToCloud = syncClicksToCloud;
