/**
 * @fileoverview Feature module: boot
 * Split from the former app.js God-file. Window bridge kept for inline onclick.
 */
const initThemeMode = (...args) => window.initThemeMode(...args);
const manualSyncCloud = (...args) => window.manualSyncCloud(...args);
const escapeHTML = (...args) => (window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(...args) : String(args[0] ?? ''));
const showToast = (...args) => window.showToast(...args);
const showLoader = (...args) => window.showLoader(...args);
const hideLoader = (...args) => window.hideLoader(...args);
const updateStyles = (...args) => window.updateStyles(...args);
const renderNav = (...args) => window.renderNav(...args);
const renderTools = (...args) => window.renderTools(...args);
const toggleSidebar = (...args) => window.toggleSidebar(...args);
const initSidebar = (...args) => window.initSidebar(...args);
const initZenMode = (...args) => window.initZenMode(...args);
const initSearch = (...args) => window.initSearch(...args);
const initAuthUI = (...args) => window.initAuthUI(...args);
const initAnnouncements = (...args) => window.initAnnouncements(...args);
const initSiteConfig = (...args) => window.initSiteConfig(...args);
const initLocalBgImage = (...args) => window.initLocalBgImage(...args);
const getBingWallpaper = (...args) => window.getBingWallpaper(...args);
const shouldFetchBingWallpaper = (...args) =>
    typeof window.shouldFetchBingWallpaper === 'function'
        ? window.shouldFetchBingWallpaper(...args)
        : !window.appData?.settings?.bgUrl;
const refreshBingIfNeeded = () => {
    if (shouldFetchBingWallpaper({
        bgUrl: window.appData?.settings?.bgUrl,
        localBg: window.navLocalBgImage || localStorage.getItem('nav_local_bg_image'),
        isSharedPage: window.isSharedPageMode
    })) {
        getBingWallpaper().then(() => updateStyles());
    }
};
const handleAuthError = (...args) => window.handleAuthError(...args);
const openLoginModal = (...args) => window.openLoginModal(...args);
const openNoticeCenter = (...args) => window.openNoticeCenter(...args);
const refreshNoticeBadge = (...args) => window.refreshNoticeBadge(...args);
const checkAnnouncementsUpdate = (...args) => window.checkAnnouncementsUpdate(...args);
const initAnnouncementsWatcher = (...args) => window.initAnnouncementsWatcher(...args);
const wakeUpNavigation = (...args) => window.wakeUpNavigation(...args);
const closeSearch = (...args) => window.closeSearch(...args);
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
const getCoreDataFingerprint = (...args) => window.getCoreDataFingerprint(...args);
const openJsonEditor = (...args) => window.openJsonEditor(...args);
const requireAdminAuth = (...args) => window.requireAdminAuth(...args);
const requireSystemConfirm = (...args) => window.requireSystemConfirm(...args);
const getEmojiPickerHTML = (...args) => window.getEmojiPickerHTML(...args);
const initEmojiPicker = (...args) => window.initEmojiPicker(...args);
const toggleEmojiPicker = (...args) => window.toggleEmojiPicker(...args);
const saveItem = (...args) => window.saveItem(...args);
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

// ==================== 1. 初始化入口 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 优先初始化基础 UI 交互与快捷键 (不依赖云端数据)
    initThemeMode();
    initSidebar();
    initZenMode();
    initSearch();
    initAuthUI();
    initGlobalEvents();

    // PWA 离线感知与状态自愈
    window.updateNetworkStatus = (event) => {
        const dot = document.getElementById('network-status');
        if (!dot) return;
        if (navigator.onLine) {
            dot.className = 'network-status-dot online';
            dot.title = '网络状态：云端在线同步中';

            const isOnlineEvent = event && event.type === 'online';
            const intervalDays = window.appData?.settings?.syncInterval || 0;
            if (window.sysToken && window.isDataDirty && !window.isPageManagementMode && isOnlineEvent && intervalDays > 0) {
                console.log('[Network] Connection restored. Auto-syncing to cloud...');
                showToast("检测到网络已恢复，正在自动同步本地修改...", "#2ecc71");
                manualSyncCloud();
            }
        } else {
            dot.className = 'network-status-dot offline';
            dot.title = '网络状态：本地离线暂存中';

            const isOfflineEvent = event && event.type === 'offline';
            if (isOfflineEvent) {
                showToast("网络连接已断开，您当前处于离线模式。修改将暂存本地！", "#e67e22");
            }
        }
    };
    window.addEventListener('online', window.updateNetworkStatus);
    window.addEventListener('offline', window.updateNetworkStatus);
    window.updateNetworkStatus();

    // 键盘快捷键帮助指南
    window.toggleKeyboardHelp = (show) => {
        const modal = document.getElementById('keyboard-help-modal');
        if (!modal) return;
        if (show === undefined) {
            show = getComputedStyle(modal).display === 'none';
        }
        modal.style.display = show ? 'flex' : 'none';
    };
    const btnCloseKbd = document.getElementById('btn-close-keyboard-help');
    if (btnCloseKbd) {
        btnCloseKbd.onclick = () => window.toggleKeyboardHelp(false);
    }
    const kbdModal = document.getElementById('keyboard-help-modal');
    if (kbdModal) {
        kbdModal.onclick = (e) => {
            if (e.target === kbdModal) window.toggleKeyboardHelp(false);
        };
    }

    // 2. 初始视觉校准 & 本地大壁纸预载 (IndexedDB 异步)
    initLocalBgImage().then(() => {
        updateStyles();
        refreshBingIfNeeded();
    });

    // 4. 异步获取云端配置与公告
    initSiteConfig();
    init(); // 核心数据加载 (内部会触发 initAnnouncements)

    checkSWUpdate();

    // 初始化公告更新监听
    initAnnouncementsWatcher();

    // 启动自动备份调度检查 (延迟 10 秒执行，避开启动高峰)
    setTimeout(checkAutoSyncSchedule, 10000);
});

const checkSWUpdate = async () => {
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            reg.onupdatefound = () => {
                const worker = reg.installing;
                worker.onstatechange = () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast("检测到新版本，请刷新页面以体验最新功能", "#3498db");
                    }
                };
            };
        }
    }
};
// ==================== 4. 数据加载 (缓存优先秒开 + 后台静默异步校验架构) ====================
const init = async (forceRender = false) => {
    // 💡 1. 优先检测是否为“公开主页分享”访问 (如 ?p=xxxx)
    const urlParams = new URLSearchParams(window.location.search);
    const shareSlug = urlParams.get('p');
    if (shareSlug) {
        await initSharedPage(shareSlug);
        return;
    }

    // 2. 【秒开阶段】尝试从本地 LocalStorage 立即读取缓存并渲染，实现 0 延时渲染
    let hasLoadedCache = false;
    const cached = localStorage.getItem('nav_app_data');
    if (cached) {
        try {
            window.appData = JSON.parse(cached);
            // 缓存秒开加载时重新对齐 isAdmin 状态，确保本地缓存权限逻辑无缝连接
            window.isAdmin = window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.role === 'super_user');
            hasLoadedCache = true;
            toggleSkeleton(false); // 立即关闭骨架屏
            renderNav();
            renderTools();
            updateStyles();
            refreshBingIfNeeded();
            console.log('[Init] Stale-First: Loaded from local cache instantly.');
        } catch (e) {
            console.warn('[Init] Local cache parse failed:', e);
        }
    }

    // 游客态且本地已成功拉起并渲染缓存，直接结束，防止刷新被默认模板覆盖
    if (!window.sysToken && hasLoadedCache) {
        initAnnouncements();
        return;
    }

    // 2. 【异步后台校验阶段】发起非阻塞网络请求，确保云端最新的修改可以被拉取
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 4000));

    try {
        console.log('[Init] Background revalidating config from cloud...');
        const fetchPromise = fetch('/api/config', {
            headers: window.sysToken ? { 'Authorization': window.sysToken } : {}
        });

        const res = await Promise.race([fetchPromise, timeoutPromise]);

        // 解析隔离 - 检查响应头是否为 JSON
        const contentType = res.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            const errorText = await res.text();
            console.error('[Init] Server returned non-JSON response:', errorText);
            throw new Error('Server returned invalid data format');
        }

        // 处理凭证失效 (401)
        if (res.status === 401) {
            console.warn('[Init] Token stale or database reset, cleaning up...');
            handleAuthError(); // 自动清理失效信息
            // 重新获取数据（此时以访客身份获取默认数据）
            if (!hasLoadedCache) {
                const guestRes = await fetch('/api/config');
                if (guestRes.ok) {
                    window.appData = await guestRes.json();
                    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                    toggleSkeleton(false);
                    renderNav();
                    renderTools();
                    updateStyles();
                } else {
                    throw new Error('Guest data fetch failed');
                }
            }
            return;
        } else if (res.ok) {
            const cloudData = await res.json();
            console.log('[Init] Cloud config received:', cloudData);

                // 3. 【冷启动与多端同步判定】
                const localFingerprint = getCoreDataFingerprint(window.appData || {});
                const cloudFingerprint = getCoreDataFingerprint(cloudData || {});

                // 判定：当前是否切换了账号（手机端新登录），或者本地缓存其实是未登录的访客默认数据，或者本地依然处于最初加载的占位状态
                const isUserChanged = window.currentUser && cloudData.user && (cloudData.user !== window.appData.user);
                const isLocalDefault = !window.appData.user || window.appData.user === 'guest' || (window.appData.categories && window.appData.categories.length === 1 && window.appData.categories[0].id === 'temp_init');

                if (!hasLoadedCache || isUserChanged || isLocalDefault) {
                    console.log('[Init] Force overwriting local cache with cloud data due to user change or cold start.');

                    // 渲染兜底
                    if (!cloudData.categories || !cloudData.items) {
                        window.appData = { ...window.MINIMAL_SAFE_DATA, ...cloudData };
                        if (!window.appData.categories || window.appData.categories.length === 0) window.appData.categories = window.MINIMAL_SAFE_DATA.categories;
                        if (!window.appData.items) window.appData.items = [];
                    } else {
                        window.appData = cloudData;
                    }

                    window.isAdmin = window.appData.isAdmin;
                    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));

                    // 执行后台无感重渲染
                    renderNav();
                    renderTools();
                    updateStyles();
                    window.lastSyncFingerprint = cloudFingerprint;
                } else {
                    console.log('[Init] Local cache exists. Prevented cloud data from auto-overwriting local changes.');
                    window.lastSyncFingerprint = localFingerprint;

                    // 即使不覆盖书签内容，但必须即时将云端最新权威的用户配额与系统身份无感合入本地
                    if (cloudData.quota) {
                        window.appData.quota = cloudData.quota;
                    }
                    if (typeof cloudData.isAdmin !== 'undefined') {
                        window.appData.isAdmin = cloudData.isAdmin;
                        window.isAdmin = cloudData.isAdmin;
                    }
                    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                }

                // 安全对齐云端最近备份时间到本地，防止多终端“从未备份”的视觉误导和自动备份时序错乱
                if (cloudData.lastUpdated) {
                    const parseTime = Date.parse(cloudData.lastUpdated.trim().replace(/-/g, '/'));
                    if (!isNaN(parseTime)) {
                        localStorage.setItem('nav_last_cloud_sync', parseTime.toString());
                    } else {
                        localStorage.removeItem('nav_last_cloud_sync');
                    }
                } else if (window.sysToken) {
                    localStorage.removeItem('nav_last_cloud_sync');
                }

            // 同步最新的用户信息 (包含 UID)
            if (cloudData.username && cloudData.role) {
                window.currentUser = {
                    id: cloudData.user || cloudData.id,
                    uid: cloudData.uid,
                    username: cloudData.username,
                    role: cloudData.role
                };
                localStorage.setItem('nav_current_user', JSON.stringify(window.currentUser));

                // 如果当前弹窗是打开的，强制同步更新弹窗内的信息
                const userView = document.getElementById('auth-user-view');
                if (userView && userView.style.display === 'block') {
                    showAuthModal();
                }
            }

            // 恢复云端点击数据
            if (cloudData.clicks_history) {
                localStorage.setItem('nav_clicks_history', JSON.stringify(cloudData.clicks_history));
            }
        } else {
            throw new Error(`Server returned ${res.status}`);
        }
    } catch (e) {
        console.warn('[Init] Load or revalidation failed, keeping cache/default:', e.message);
        // 如果本地无缓存，且网络拉取也挂了，启用默认安全数据防止白屏
        if (!hasLoadedCache) {
            window.appData = { ...window.MINIMAL_SAFE_DATA };
            toggleSkeleton(false);
            renderNav();
            renderTools();
            updateStyles();
            showToast("网络连接超时，已启用预置安全数据", "#e67e22");
        }
    } finally {
        // 无论发生什么，强制关闭骨架屏并渲染
        toggleSkeleton(false);

        try {
            renderNav();
            renderTools();

            // 强制背景校验闭环
            refreshBingIfNeeded();

            updateStyles();

            // 同步云端搜索引擎设置：本地 localStorage 优先，避免刷新后覆盖用户本机选择
            {
                const localEngine = localStorage.getItem('nav_search_engine');
                const engineToUse = localEngine || window.appData.settings?.searchEngine;
                if (engineToUse && typeof window.setSearchEngine === 'function') {
                    window.setSearchEngine(engineToUse, true);
                }
            }

            // 在工具栏渲染完成后再初始化公告
            initAnnouncements();
        } catch (renderError) {
            console.error('[Init] Render crashed:', renderError);
            showToast("渲染失败，请刷新重试", "#e74c3c");
        }
    }
};
// 全局模态状态清理函数 (支持静默模式)
const closeAllModals = (silent = false) => {
    const editModal = document.getElementById('edit-modal');
    const modalType = editModal?.dataset.modalType;

    // 1. 逻辑分流：仅当是个性化设置(Visual)或页面管理退出时，才执行“暂存引导”
    // 注意：admin-hub 和 system-config 拥有自己的独立即时保存按钮，此处不干预
    const isPersonalSettings = (modalType === 'visual-lab' || !window.isPageManagementMode);
    const isAdminAction = (modalType === 'admin-hub' || modalType === 'system-config' || modalType === 'sync-center' || modalType === 'notice-center' || modalType === 'user-profile');

    if (!silent && window.isDataDirty && !isAdminAction && !window.isPageManagementMode) {
        handleDataSaveOnExit();
    }

    // 2. 清理常规弹窗状态并隐藏
    if (editModal) {
        editModal.style.display = 'none';
        delete editModal.dataset.modalType; // 清理标记
        const body = document.getElementById('edit-form-body');
        if (body) body.innerHTML = '';
    }

    // 2. 关闭专家模式弹窗
    const monacoModal = document.getElementById('monaco-modal');
    if (monacoModal) monacoModal.style.display = 'none';

    // 3. 关闭认证遮罩
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';

    // 4. 关闭视频预览弹窗并清除源
    const videoModal = document.getElementById('video-modal');
    if (videoModal && getComputedStyle(videoModal).display !== 'none') {
        const iframe = document.getElementById('video-iframe');
        if (iframe) iframe.src = ''; // 彻底阻断后台残留音频
        videoModal.style.display = 'none';
    }

    // 关闭键盘快捷键指南弹窗
    const keyboardHelpModal = document.getElementById('keyboard-help-modal');
    if (keyboardHelpModal) keyboardHelpModal.style.display = 'none';

    // 焦点还原
    if (!silent && window.lastFocusedElement) {
        window.lastFocusedElement.focus();
        window.lastFocusedElement = null;
    }

    // 关闭所有弹窗时隐藏管理员批量操作栏
    const adminBar = document.getElementById('admin-user-batch-bar');
    if (adminBar) adminBar.classList.remove('visible');
};
window.closeAllModals = closeAllModals;

// 统一退出暂存逻辑 (针对个人偏好设置与页面管理退出)
const handleDataSaveOnExit = async () => {
    if (!window.isDataDirty) return;

    // 默认退出页面管理先保存本地
    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
    await new Promise(r => setTimeout(r, 200));

    if (!window.sysToken) {
        window.isDataDirty = false;
        showToast("访客模式：修改已在本地生效（更换浏览器或清空缓存会导致数据丢失）", "#e67e22");
        return;
    }

    const intervalDays = window.appData.settings?.syncInterval || 0;
    if (intervalDays <= 0) {
        // 选择的是手动备份，仅进行本地保存提示
        await window.SyncUI.perform('LAYOUT_SAVE', async () => {
            window.isDataDirty = true; // 虽然已存在本地，在云端数据库来说依然是DIRTY，等待后续云端手动同步
        });
    } else {
        // 选择的是自动备份，根据实际自动备份时间策略判定是否需要即刻上传
        const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
        const now = Date.now();
        const threshold = intervalDays * 24 * 60 * 60 * 1000;

        if (now - lastSync > threshold) {
            // 到了备份的周期，在保存本地后，执行自动云端备份
            await window.SyncUI.perform('BACKUP_AUTO', async () => {
                try {
                    const uploadData = JSON.parse(JSON.stringify(window.appData));
                    if (uploadData.settings) {
                        delete uploadData.settings.themeMode;
                    }

                    const res = await fetch('/api/config', {
                        method: 'POST',
                        headers: {
                            'Authorization': window.sysToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(uploadData)
                    });

                    if (res.status === 401) {
                        throw new Error("登录态失效，自动同步失败");
                    }

                    const data = await res.json();
                    if (res.ok && data.success) {
                        window.isDataDirty = false;
                        const now = Date.now();
                        localStorage.setItem('nav_last_cloud_sync', now.toString());
                        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                        window.lastSyncFingerprint = getCoreDataFingerprint(window.appData);
                    } else {
                        throw new Error(data.error || "服务器拒绝保存自动同步");
                    }
                } catch (e) {
                    console.error("[Auto-Sync] Exit page manage sync failed:", e);
                    throw { message: "本地修改已存，但自动同步云端失败，请手动同步", isWarning: true };
                }
            });
        } else {
            // 未到备份周期周期，仅进行本地保存
            await window.SyncUI.perform('LAYOUT_SAVE', async () => {
                window.isDataDirty = true; // 虽然已存在本地，在云端数据库来说依然是DIRTY，等待下一次周期自动同步
            });
        }
    }
};
window.handleDataSaveOnExit = handleDataSaveOnExit;
const initGlobalEvents = () => {
    // 快捷导航按钮逻辑
    const fabToTop = document.getElementById('scroll-to-top');
    const fabToBottom = document.getElementById('scroll-to-bottom');
    const fabGroup = document.getElementById('quick-nav-group');
    let fabTimer = null;
    let scrollActiveTimer = null;

    if (fabToTop && fabToBottom && fabGroup) {
        fabToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
        fabToBottom.onclick = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            // 滚动超过 300px 显示
            fabGroup.classList.toggle('visible', scrollTop > 300);

            // 闲置淡出逻辑
            fabGroup.classList.add('active');
            clearTimeout(fabTimer);
            fabTimer = setTimeout(() => fabGroup.classList.remove('active'), 2000);

            // 联动顶部悬浮控制按钮的全局闲置呼吸动效
            document.body.classList.add('scroll-active');
            clearTimeout(scrollActiveTimer);
            scrollActiveTimer = setTimeout(() => document.body.classList.remove('scroll-active'), 2000);
        }, { passive: true });
    }

    // 全局支持 Ctrl+V/粘贴 行为唤醒并自动填入搜索框 (配合 Ctrl+V 快捷键盘触发焦点转移)
    document.addEventListener('paste', (e) => {
        const active = document.activeElement;
        const isInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
        if (isInput) return; // 如果已经有输入框在焦点中，由浏览器自行执行默认的输入框粘贴即可

        const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
        if (activeModal || window.isPageManagementMode) return;

        const sea = document.getElementById('sea-input');
        if (sea) {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData) {
                e.preventDefault();
                document.body.classList.add('search-active');
                sea.value = pasteData;
                sea.focus();

                // 唤起禅意模式下展开逻辑
                if (window.appData.settings?.zenMode && !window.isZenTempExpanded) {
                    window.isZenTempExpanded = true;
                    renderNav();
                }

                // 光标定位至末尾
                sea.setSelectionRange(pasteData.length, pasteData.length);

                // 重新刷新并促发模糊查询
                sea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    // 监听全局键盘事件 (Core Shortcuts and Geometric Navigation)
    document.addEventListener('keydown', (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();
        const isCtrl = e.ctrlKey || e.metaKey;
        const active = document.activeElement;
        const isInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;

        // 1. Escape 键一键复位/关闭弹窗与状态
        if (e.key === 'Escape') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal) {
                e.preventDefault();
                closeAllModals();
                return;
            }
            if (document.body.classList.contains('search-active')) {
                closeSearch();
                return;
            }
            if (window.isPageManagementMode) {
                e.preventDefault();
                togglePageManagement(false);
                return;
            }
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open') && !window.isSidebarPinned) {
                toggleSidebar(false);
                return;
            }
            if (window.appData.settings?.zenMode && window.isZenTempExpanded) {
                window.isZenTempExpanded = false;
                document.body.classList.remove('zen-silent-woken');
                renderNav();
                updateStyles();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // 2. 几何方向键聚焦计算
        if (!isInput && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            e.preventDefault();
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            let pool;

            if (activeModal) {
                pool = Array.from(activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            } else {
                const isZen = window.appData.settings?.zenMode === true;
                const selectors = isZen
                    ? '.card:not(.hidden-item), .zen-menu-item, .zen-freq-item, #current-engine-trigger, .engine-item'
                    : '.card:not(.hidden-item), .sidebar-nav-item:not(.sidebar-nav-label), .zen-menu-item, .zen-freq-item, .notice-center-btn, .sidebar-pin-btn, #current-engine-trigger, .engine-item';
                pool = Array.from(document.querySelectorAll(selectors));
            }

            const current = active;
            const isInsidePool = pool.includes(current);

            if (!isInsidePool) {
                const firstVisible = pool[0];
                if (firstVisible) firstVisible.focus();
                return;
            }

            const r1 = current.getBoundingClientRect();
            const c1 = { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 };

            let bestMatch = null;
            let minScore = Infinity;

            pool.forEach(target => {
                if (target === current) return;

                const r2 = target.getBoundingClientRect();
                const c2 = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };

                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;

                let isValid = false;
                let score = 0;

                const hWeight = activeModal ? 1.5 : 2.5;
                const vWeight = activeModal ? 1.2 : 2.0;

                switch (e.key) {
                    case 'ArrowRight':
                        if (dx > 2) {
                            isValid = true;
                            score = Math.abs(dx) + Math.abs(dy) * hWeight;
                        }
                        break;
                    case 'ArrowLeft':
                        if (dx < -2) {
                            isValid = true;
                            score = Math.abs(dx) + Math.abs(dy) * hWeight;
                        }
                        break;
                    case 'ArrowDown':
                        if (dy > 2) {
                            isValid = true;
                            score = Math.abs(dy) + Math.abs(dx) * vWeight;
                        }
                        break;
                    case 'ArrowUp':
                        if (dy < -2) {
                            isValid = true;
                            score = Math.abs(dy) + Math.abs(dx) * vWeight;
                        }
                        break;
                }

                if (isValid && score < minScore) {
                    minScore = score;
                    bestMatch = target;
                }
            });

            if (bestMatch) {
                bestMatch.focus();
                bestMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        // 3. Enter/Space 键点击代理驱动
        if (!isInput && (key === 'enter' || key === ' ')) {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            let pool;

            if (activeModal) {
                pool = Array.from(activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            } else {
                const isZen = window.appData.settings?.zenMode === true;
                const selectors = isZen
                    ? '.card:not(.hidden-item), .zen-menu-item, .zen-freq-item, #current-engine-trigger, .engine-item'
                    : '.card:not(.hidden-item), .sidebar-nav-item:not(.sidebar-nav-label), .zen-menu-item, .zen-freq-item, .notice-center-btn, .sidebar-pin-btn, #current-engine-trigger, .engine-item';
                pool = Array.from(document.querySelectorAll(selectors));
            }

            if (pool.includes(active)) {
                if (active.tagName === 'DIV' || active.tagName === 'SPAN') {
                    e.preventDefault();
                    active.click();
                    active.style.transform = 'scale(0.95)';
                    setTimeout(() => active.style.transform = '', 100);
                }
            }
        }

        // 4. Ctrl+B 侧边栏折叠与展开
        if (isCtrl && key === 'b') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            e.preventDefault();

            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar?.classList.contains('open');

            if (!isOpen && window.appData.settings?.zenMode && document.body.classList.contains('zen-silent')) {
                wakeUpNavigation();
            }

            toggleSidebar(!isOpen);
            return;
        }

        // 5. Alt+Z / Ctrl+Z 禅意模式一键切换
        if ((e.altKey || isCtrl) && key === 'z') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            if (e.altKey) {
                e.preventDefault();
                window.toggleZenMode(undefined, true);
            }
            return;
        }

        // 6. 快捷输入一键唤醒搜索（首字符写入搜索框；search-ux.js capture 已处理时跳过）
        if (!isInput && (e.key.length === 1 || key === '/') && !isCtrl && !e.altKey) {
            if (e.searchUxHandled) return;
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            const sea = document.getElementById('sea-input');
            if (sea) {
                e.preventDefault();
                document.body.classList.add('search-active');
                if (key !== '/') {
                    sea.value = (sea.value || '') + e.key;
                }
                sea.focus();
                try {
                    const pos = sea.value.length;
                    sea.setSelectionRange(pos, pos);
                } catch (_) {}
                sea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // 7. Ctrl + L 唤起个人/登录面板
        if ((isCtrl || e.altKey) && key === 'l') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            e.preventDefault();
            showAuthModal();
            return;
        }

        // 8. Ctrl+K 快捷聚焦并清空搜索
        if (isCtrl && key === 'k') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            e.preventDefault();
            const sea = document.getElementById('sea-input');
            if (sea) {
                document.body.classList.add('search-active');
                sea.value = '';
                sea.focus();
            }
            return;
        }

        // 9. Ctrl+V / Cmd+V 快捷唤起搜索并自动对准输入框（配合原生 paste 事件完成极其顺畅的粘贴搜索体验）
        if (!isInput && isCtrl && key === 'v') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || window.isPageManagementMode) return;
            const sea = document.getElementById('sea-input');
            if (sea) {
                document.body.classList.add('search-active');
                sea.focus();

                // 唤起禅意模式下展开逻辑
                if (window.appData.settings?.zenMode && !window.isZenTempExpanded) {
                    window.isZenTempExpanded = true;
                    renderNav();
                }
            }
        }
    });

    // 视频预览模态框事件绑定
    const btnCloseVideo = document.getElementById('btn-close-video');
    const videoModal = document.getElementById('video-modal');
    if (btnCloseVideo) {
        btnCloseVideo.onclick = () => closeVideoModal();
    }
    if (videoModal) {
        videoModal.addEventListener('click', (e) => {
            if (e.target === videoModal) {
                closeVideoModal();
            }
        });
    }
};

// ====== 书签管理及编辑逻辑 (已迁移至 page-manage.js) ======

// ====== 💡 公开主页分享服务积木 ======
const initSharedPage = async (slug) => {
    toggleSkeleton(true);
    showLoader('正在加载公开分享主页...');
    try {
        const res = await fetch(`/api/share?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "加载公开主页失败");
        }
        const data = await res.json();

        // 渲染分享主页的数据
        window.appData = data;
        window.isAdmin = false; // 分享主页对访客绝对禁止管理员权限
        window.currentUser = null; // 访客无当前用户
        window.sysToken = null; // 无 token

        // 标记为只读分享状态
        window.isSharedPageMode = true;

        toggleSkeleton(false);
        renderNav();
        renderTools();
        updateStyles();

        // 渲染病毒式裂变徽章 (Viral Badge)
        renderViralBadge(data.shareOwner);

        showToast(`已成功载入 @${data.shareOwner} 的公开主页`, "#2ecc71");
    } catch (e) {
        hideLoader();
        toggleSkeleton(false);
        showToast(e.message || "分享主页不存在或已关闭", "#e74c3c");
        // 3秒后跳转回主站
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    } finally {
        hideLoader();
    }
};

const renderViralBadge = (ownerName) => {
    // 检查是否已存在
    if (document.getElementById('viral-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'viral-badge';
    badge.style.position = 'fixed';
    badge.style.bottom = '15px';
    badge.style.right = '15px';
    badge.style.zIndex = '9999';
    badge.style.padding = '8px 12px';
    badge.style.borderRadius = '30px';
    badge.style.background = 'rgba(0, 0, 0, 0.4)';
    badge.style.backdropFilter = 'blur(10px)';
    badge.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    badge.style.color = '#fff';
    badge.style.fontSize = '12px';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.style.cursor = 'pointer';
    badge.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    badge.style.transition = '0.3s ease';

    badge.innerHTML = `
        <span style="color: #f1c40f;"><i class="ri-flashlight-line"></i></span>
        <span>我也要搭建 @${escapeHTML(ownerName)} 这样的高颜值导航</span>
    `;

    badge.onmouseenter = () => {
        badge.style.transform = 'translateY(-2px)';
        badge.style.background = 'rgba(0, 0, 0, 0.6)';
    };
    badge.onmouseleave = () => {
        badge.style.transform = 'translateY(0)';
        badge.style.background = 'rgba(0, 0, 0, 0.4)';
    };

    badge.onclick = () => {
        window.location.href = '/';
    };

    document.body.appendChild(badge);
};
// Window bridge for cross-module and inline onclick callers
window.checkSWUpdate = checkSWUpdate;
window.init = init;
window.initGlobalEvents = initGlobalEvents;
window.initSharedPage = initSharedPage;
window.renderViralBadge = renderViralBadge;
