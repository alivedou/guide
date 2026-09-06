/**
 * @fileoverview Feature module: sync-ui
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

// = 全局语义化同步反馈引擎 ====================
window.SyncUI = {
    // 1. 话术矩阵 (根据操作类型分流)
    messages: {
        'LOGIN': { loading: '正在验证账户信息...', success: '登录成功，欢迎回来！' },
        'REGISTER': { loading: '正在通过安全通道创建账户...', success: '注册成功！请使用刚才注册的账号进行登录。' },
        'ADMIN_CONFIG': { loading: '正在保存系统配置至云端...', success: '系统配置已保存，立即全站生效！' },
        'USER_MANAGE': { loading: '正在同步权限变更...', success: '角色授权更新成功，立即生效！' },
        'INVITE_GEN': { loading: '正在生成新邀请凭证...', success: '邀请码生成成功' },
        'INVITE_DEL': { loading: '正在作废此邀请凭证...', success: '已成功移除该邀请码' },
        'ANNOUNCE_SAVE': { loading: '正在全站下发通知条幅...', success: '公告发布成功，已对全员可见' },
        'ANNOUNCE_DEL': { loading: '正在清理该公告记录...', success: '公告已成功下架' },
        'LAYOUT_SAVE': () => {
            const isGuest = !window.sysToken;
            if (isGuest) {
                return {
                    loading: '正在保存修改至本地...',
                    success: '保存成功！登录后可实现多设备同步'
                };
            }
            const intervalDays = window.appData?.settings?.syncInterval || 0;
            if (intervalDays > 0) {
                return {
                    loading: '正在暂存修改至本地...',
                    success: '已暂存至本地！将根据您的自动备份周期同步至云端'
                };
            }
            return {
                loading: '正在暂存修改至本地...',
                success: '已保存至本地！由于您目前是手动备份模式，请记得前往「云端备份」手动同步'
            };
        },
        'BACKUP_AUTO': { loading: '正在保存并自动同步到云端...', success: '保存到本地成功，且已自动同步至云端！' },
        'BACKUP_MANUAL': { loading: '正在执行手动云端备份...', success: '备份完成，你的数据已在云端安全存档' },
        'RESTORE_MANUAL': { loading: '正在从云端拉取备份数据...', success: '云端备份拉取成功，本地已完全覆盖更新！' },
        'CLIPBOARD': { loading: '正在准备数据...', success: '内容已加密复制至剪贴板' },
        'ADMIN_ANNOUNCE': { loading: '正在批量处理公告中...', success: '批量操作完成' },
        'INVITE_BATCH': { loading: '正在批量下架邀请凭证...', success: '批量操作完成' }
    },

    // 2. 统一动作包装器
    async perform(actionKey, task) {
        let msg = this.messages[actionKey] || { loading: '正在处理中...', success: '操作已成功完成！' };
        // 如果是函数则执行获取对象 (用于区分角色话术)
        if (typeof msg === 'function') msg = msg();

        showLoader(msg.loading);
        try {
            const result = await task();
            showToast(msg.success, "#27ae60");
            return result;
        } catch (e) {
            console.error(`[SyncUI] Action ${actionKey} failed:`, e);
            // 区分普通错误与引导性警告
            const toastColor = e.isWarning ? "#e67e22" : "#e74c3c";
            showToast(e.message || "操作失败", toastColor);
            // 如果是警告，我们可能不想让调用者认为任务彻底失败了，但在目前的 Promise 链中 throw 是必要的
            throw e;
        } finally {
            hideLoader();
        }
    }
};