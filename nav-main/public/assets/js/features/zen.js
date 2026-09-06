/**
 * @fileoverview Feature module: zen
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

const initZenMode = () => {
    const btn = document.getElementById('zen-expand-btn');
    if (btn) btn.onclick = () => wakeUpNavigation();

    // 智能唤醒引擎
    let moveDistance = 0;
    let moveTimer = null;

    window.resetZenSleepTimer = () => {
        if (window.zenSleepTimer) clearTimeout(window.zenSleepTimer);
        if (window.appData.settings?.zenMode && window.isZenTempExpanded) {
            window.zenSleepTimer = setTimeout(() => {
                const isModalOpen = (document.getElementById('edit-modal')?.style.display === 'flex') ||
                                     (document.getElementById('monaco-modal')?.style.display === 'block') ||
                                     (document.getElementById('auth-overlay')?.style.display === 'block');
                // 如果搜索框没有焦点，且没有处于管理模式，且没有任何模态弹窗打开，才自动沉睡
                if (document.activeElement?.id !== 'sea-input' && !window.isPageManagementMode && !isModalOpen) {
                    window.isZenTempExpanded = false;
                    updateStyles();
                    renderNav();
                    showToast("进入静默态", "#2c3e50");
                }
            }, 60000); // 1分钟无操作自动沉睡
        }
    };

    window.addEventListener('mousemove', (e) => {
        window.resetZenSleepTimer();
        if (!document.body.classList.contains('zen-silent')) {
            moveDistance = 0;
            return;
        }

        // 累计移动量，配合计时器：如果 2 秒内没有持续移动，重置距离
        moveDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
        clearTimeout(moveTimer);
        moveTimer = setTimeout(() => { moveDistance = 0; }, 2000);

        if (moveDistance > 400) { // 稍微提高阈值以防误触
            wakeUpNavigation();
            moveDistance = 0;
        }
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        window.resetZenSleepTimer();
        if (document.body.classList.contains('zen-silent')) {
            // 排除单纯的功能键 (Ctrl/Shift/Alt)
            if (e.key.length === 1 || ['Enter', 'Space', 'Backspace', 'ArrowDown'].includes(e.key)) {
                wakeUpNavigation();
            }
        }
    });

    document.addEventListener('click', (e) => {
        window.resetZenSleepTimer();
        if (document.body.classList.contains('zen-silent')) {
            // 只要点击非 Modal 区域即唤醒
            if (!e.target.closest('.modal-content')) {
                wakeUpNavigation();
            }
        }
    });
};

const wakeUpNavigation = () => {
    if (!document.body.classList.contains('zen-silent')) return;

    window.isZenTempExpanded = true;
    updateStyles(); // 应用 zen-silent-woken 逻辑前先更新状态
    document.body.classList.remove('zen-silent');
    document.body.classList.add('zen-silent-woken');

    renderNav();

    // 唤醒后重置计时器
    if (window.resetZenSleepTimer) window.resetZenSleepTimer();

    // 自动聚焦搜索框
    setTimeout(() => {
        document.getElementById('sea-input')?.focus();
    }, 100);
};
// Window bridge for cross-module and inline onclick callers
window.initZenMode = initZenMode;
window.wakeUpNavigation = wakeUpNavigation;
