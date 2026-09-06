/**
 * @fileoverview Feature module: sidebar
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

// ==================== 6. 其他初始化 ====================
// 主题更新与模式控制已抽离至独立的 theme-mode.js 子模块中，并已安全挂载至 window

const toggleSidebar = (force) => {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (!s || !o) return;
    const isOpen = typeof force === 'boolean' ? force : !s.classList.contains('open');
    s.classList.toggle('open', isOpen);
    o.classList.toggle('visible', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);

    // - 侧边栏打开时，同步锁定禅意模式为唤醒态 ---
    if (isOpen && window.appData.settings?.zenMode) {
        window.isZenTempExpanded = true;
        document.body.classList.remove('zen-silent');
        // 确保不会因为静默态而无法操作侧边栏
        updateStyles();
    }
};
window.toggleSidebar = toggleSidebar;

const initSidebar = () => {
    const t = document.getElementById('sidebar-toggle');
    const o = document.getElementById('sidebar-overlay');
    const pinBtn = document.getElementById('btn-sidebar-pin');
    const noticeBtn = document.getElementById('btn-notice-center');

    if (t) t.onclick = () => toggleSidebar();
    if (o) o.onclick = () => toggleSidebar(false);
    if (noticeBtn) noticeBtn.onclick = () => typeof openNoticeCenter === 'function' && openNoticeCenter();

    // - JS 状态控制与“图钉”逻辑兼容 ---
    window.autoAdjustSidebar = () => {
        const width = window.innerWidth;
        const isZen = window.appData.settings?.zenMode === true;

        // 禅意模式下强制不折叠（因为侧边栏通常是隐藏的）
        if (isZen) {
            document.body.classList.remove('sidebar-folded');
            return;
        }

        if (width <= 768) {
            // 移动端：移除折叠类，使用 transform 隐藏
            document.body.classList.remove('sidebar-folded');
        } else if (width <= 1024) {
            // Tablet 端：根据图钉状态决定
            document.body.classList.toggle('sidebar-folded', !window.isSidebarPinned);
        } else {
            // Desktop 端：根据图钉状态决定
            document.body.classList.toggle('sidebar-folded', !window.isSidebarPinned);
        }

        // 更新图钉按钮图标状态
        if (pinBtn) {
            const icon = pinBtn.querySelector('i');
            if (icon) {
                icon.className = window.isSidebarPinned ? 'ri-pushpin-2-fill' : 'ri-pushpin-2-line';
            }
        }
    };

    // 监听窗口缩放
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(window.autoAdjustSidebar, 100);
    });

    // 移动端边缘滑动抽屉 (Swipe Engine)
    let touchStartX = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e) => {
        // 记录起点 X 坐标和时间
        touchStartX = e.touches[0].clientX;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diffX = touchEndX - touchStartX;
        const diffTime = Date.now() - touchStartTime;

        // 判定条件：
        // 1. 从左侧边缘触发 (起始点距离屏幕左侧 < 40px)
        // 2. 向右滑动距离足够 (距离 > 60px)
        // 3. 滑动速度较快 (时间 < 300ms)
        // 4. 侧边栏当前是关闭状态
        if (touchStartX < 40 && diffX > 60 && diffTime < 300) {
            const s = document.getElementById('sidebar');
            if (s && !s.classList.contains('open')) {
                toggleSidebar(true);
            }
        }

        // 可选：向左滑动关闭侧边栏 (任意位置触发)
        if (diffX < -60 && diffTime < 300) {
            const s = document.getElementById('sidebar');
            if (s && s.classList.contains('open')) {
                toggleSidebar(false);
            }
        }
    }, { passive: true });

    // 图钉初始化
    document.body.classList.toggle('sidebar-pinned', window.isSidebarPinned);
    window.autoAdjustSidebar();

    if (pinBtn) {
        pinBtn.onclick = () => {
            window.isSidebarPinned = !window.isSidebarPinned;
            document.body.classList.toggle('sidebar-pinned', window.isSidebarPinned);
            localStorage.setItem('nav_sidebar_pinned', window.isSidebarPinned);

            // 重新校准布局
            window.autoAdjustSidebar();

            // 如果取消固定且是移动端，自动关闭侧边栏
            if (!window.isSidebarPinned && window.innerWidth <= 768) toggleSidebar(false);

            showToast(window.isSidebarPinned ? "侧边栏已固定" : "侧边栏已设为自动折叠");
        };
    }
};
// Window bridge for cross-module and inline onclick callers
window.initSidebar = initSidebar;
