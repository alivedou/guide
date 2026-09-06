/**
 * @fileoverview Feature module: notices
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
const initSiteConfig = (...args) => window.initSiteConfig(...args);
const initLocalBgImage = (...args) => window.initLocalBgImage(...args);
const getBingWallpaper = (...args) => window.getBingWallpaper(...args);
const handleAuthError = (...args) => window.handleAuthError(...args);
const openLoginModal = (...args) => window.openLoginModal(...args);
const openNoticeCenter = (...args) => window.openNoticeCenter(...args);
const checkSWUpdate = (...args) => window.checkSWUpdate(...args);
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

const initAnnouncementsWatcher = () => {
    // 1. 页面可见性变化检测 (切回标签页时触发)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAnnouncementsUpdate();
        }
    });

    // 2. 定时心跳轮询 (每 5 分钟检查一次)
    setInterval(checkAnnouncementsUpdate, 300000);
};

const checkAnnouncementsUpdate = async () => {
    try {
        const res = await fetch('/api/announcements', {
            headers: window.sysToken ? { 'Authorization': window.sysToken } : {}
        });
        if (!res.ok) return;
        const { lastUpdate } = await res.json();

        const localVersion = localStorage.getItem('nav_announcements_version');
        if (lastUpdate && lastUpdate !== localVersion) {
            console.log('[Notice] New version detected, refreshing...');
            // 如果发现版本更新，重新调用初始化逻辑（内部会处理已读状态）
            await initAnnouncements();
        }
    } catch (e) { console.warn('[Notice] Update check failed'); }
};

// PWA 更新感知
const refreshNoticeBadge = () => {
    try {
        if (!Array.isArray(window.cachedAnnouncements)) return;

        let unreadCount = 0;
        if (!window.sysToken) {
            // 游客状态下小红点一直保留，去不掉 (只要存在发布的公告就一直显示)
            unreadCount = window.cachedAnnouncements.length;
        } else {
            // 登录状态下根据后端 D1 和本地已读情况来取消红点
            unreadCount = window.cachedAnnouncements.filter(notice => {
                try {
                    if (notice.is_read !== undefined && notice.is_read) return false;
                    return !localStorage.getItem(`read_notice_${notice.id}`);
                } catch (e) { return true; }
            }).length;
        }

        // 1. 侧边栏红点
        const noticeBtn = document.getElementById('btn-notice-center');
        if (noticeBtn) {
            const dot = noticeBtn.querySelector('.notice-dot');
            if (dot) dot.classList.toggle('active', unreadCount > 0);
        }

        // 2. 禅意模式同步
        const isZen = document.body.classList.contains('zen-active');
        const searchWrapper = document.getElementById('search-wrapper');
        if (isZen && searchWrapper) {
            // 移除旧的提醒点
            document.querySelectorAll('.zen-notice-dot').forEach(el => el.remove());
            if (unreadCount > 0) {
                const dot = document.createElement('div');
                dot.className = 'zen-notice-dot';
                dot.innerHTML = '<i class="ri-notification-3-line"></i>';
                dot.title = `您有 ${unreadCount} 条未读公告`;
                dot.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof openNoticeCenter === 'function') openNoticeCenter();
                };
                searchWrapper.appendChild(dot);
            }
        } else {
            document.querySelectorAll('.zen-notice-dot').forEach(el => el.remove());
        }
    } catch (e) {
        console.warn('[Notice] Badge refresh failed:', e);
    }
};

const initAnnouncements = async () => {
    try {
        const res = await fetch('/api/announcements', {
            headers: window.sysToken ? { 'Authorization': window.sysToken } : {}
        });
        if (!res.ok) return;
        const { announcements, lastUpdate } = await res.json();

        window.cachedAnnouncements = announcements || [];

        // 记录本次加载的版本号
        if (lastUpdate) {
            localStorage.setItem('nav_announcements_version', lastUpdate);
        }

        refreshNoticeBadge();

        if (!announcements || announcements.length === 0) return;

        if (!window.sysToken) {
            // 游客状态：只展示最新的置顶重要公告（如果没有置顶的，则展示最新一条重要公告），且无法去掉
            const importantNotices = announcements.filter(notice => notice.type === 'important');
            const pinned = importantNotices.filter(notice => notice.is_top === 1 || notice.is_top === true || notice.is_top === "1");
            const targetNotice = pinned.length > 0 ? pinned[0] : (importantNotices.length > 0 ? importantNotices[0] : null);

            if (targetNotice) {
                renderImportantNoticeForGuest(targetNotice);
            }
        } else {
            // 登录状态：根据 notice.is_read 或本地 localStorage 来判定
            announcements.forEach(notice => {
                const hasRead = notice.is_read || localStorage.getItem(`read_notice_${notice.id}`);
                if (hasRead) return;

                if (notice.type === 'important') {
                    renderImportantNotice(notice);
                } else {
                    // renderQuietNotice 内部逻辑由 refreshNoticeBadge 接管部分 UI
                    renderQuietNotice(notice);
                }
            });
        }
    } catch (e) { console.warn('[Notice] Failed to fetch announcements'); }
};

const renderImportantNoticeForGuest = (notice) => {
    // 移除已有横幅防止重复堆叠
    document.querySelectorAll('.important-banner').forEach(el => el.remove());

    const banner = document.createElement('div');
    banner.className = 'important-banner guest-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
        <div class="banner-content" onclick="viewNoticeDetail(${notice.id})">
            <i class="ri-error-warning-line"></i>
            <span class="banner-title"><b>重要公告：</b>${notice.title}</span>
            <span class="banner-more">查看更多 <i class="ri-arrow-right-s-line"></i></span>
            <button class="banner-close" onclick="event.stopPropagation(); this.parentElement.parentElement.remove(); showToast('游客状态关闭公告仅限本次生效，注册可永久取消！', '#e67e22');">×</button>
        </div>
    `;
    document.body.prepend(banner);
};

const renderImportantNotice = (notice) => {
    const banner = document.createElement('div');
    banner.className = 'important-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
        <div class="banner-content" onclick="viewNoticeDetail(${notice.id})">
            <i class="ri-error-warning-line"></i>
            <span class="banner-title"><b>重要公告：</b>${notice.title}</span>
            <span class="banner-more">查看更多 <i class="ri-arrow-right-s-line"></i></span>
            <button class="banner-close" onclick="event.stopPropagation(); this.parentElement.parentElement.remove(); localStorage.setItem('read_notice_${notice.id}', 'true'); refreshNoticeBadge();">不再提示</button>
        </div>
    `;
    document.body.prepend(banner);
};

// 封装核心联动函数
const viewNoticeDetail = (id) => {
    const banner = document.querySelector('.important-banner');
    if (banner && window.sysToken) { // 仅登录状态可移除横幅
        banner.remove();
    }

    // 标记为已读并刷新红点
    localStorage.setItem(`read_notice_${id}`, 'true');
    refreshNoticeBadge();

    // 打开公告中心并精确定位
    if (typeof window.openNoticeCenter === 'function') {
        window.openNoticeCenter(id);
    }
};

const renderQuietNotice = (notice) => {
    // 仅显示 Toast 提醒，不再向侧边栏底部注入铃铛
    showToast(`新公告: ${notice.title} (点击左上角查看)`, "#3498db");
};
// 公告中心交互逻辑
window.openNoticeCenter = async (targetId = null) => {
    window.lastFocusedElement = document.activeElement; 
    // 互斥显示
    closeAllModals();

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');

    if (!modal || !body) return;

    modal.dataset.modalType = 'notice-center';
    title.innerText = "公告中心 (Notice Center)";
    body.innerHTML = '<div style="text-align:center; padding:30px; opacity:0.6;">正在同步最新公示内容...</div>';
    modal.style.display = 'flex';
    confirmBtn.style.display = 'none';

    const renderList = (announcements) => {
        if (!announcements || announcements.length === 0) {
            const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            body.innerHTML = `
                <div class="empty-notice" style="text-align:center; padding:40px; opacity:0.6;">
                    <i class="ri-inbox-line" style="font-size:32px; display:block; margin-bottom:10px;"></i>
                    暂无公示中的公告
                    ${isLocal ? `
                        <div style="margin-top:20px; padding:12px; background:rgba(241,196,15,0.1); border:1px dashed #f1c40f; border-radius:8px; font-size:11px; color:#d35400;">
                            <strong>👨‍💻 开发者提示 (Local Dev):</strong><br>
                            本地 D1 数据库可能尚未同步或未添加公告。<br>
                            请检查 <code>migrations/</code> 是否执行，或进入管理后台添加。
                        </div>
                    ` : ''}
                </div>`;
            return;
        }

        const unreadCount = announcements.filter(a => !(a.is_read || localStorage.getItem(`read_notice_${a.id}`))).length;
        const hideRead = localStorage.getItem('nav_hide_read_announcements') === 'true';
        const isGuest = !window.sysToken;

        body.innerHTML = `
            <div id="notice-center-batch-bar" class="admin-batch-bar visible" style="margin-bottom:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; width:100%; box-sizing:border-box;">
                <span style="font-size:12px; font-weight:bold; color:var(--text);"><i class="ri-notification-3-line"></i> 公告实时公示</span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <label class="toggle-hide-read" ${isGuest ? 'style="opacity:0.5; cursor:not-allowed; font-size:11px;" title="登录后可同步阅读状态"' : 'style="font-size:11px; cursor:pointer;"'}>
                        <input type="checkbox" ${hideRead ? 'checked' : ''} ${isGuest ? 'disabled' : 'onchange="toggleHideRead(this.checked)"'}> 隐藏已读
                    </label>
                    ${isGuest
                        ? `<button class="batch-btn" onclick="openLoginModal()"><i class="ri-user-shared-line"></i> 登录同步</button>`
                        : (unreadCount > 0 ? `<button class="batch-btn" onclick="markAllNoticesRead()"><i class="ri-checkbox-multiple-line"></i> 全部标记已读</button>` : '')
                    }
                </div>
            </div>

            <div class="form-group" style="margin-bottom:15px;">
                <input type="text" id="notice-search-kw" placeholder="输入关键字模糊检索公告..." style="width:100%;" oninput="handleNoticeCenterSearch(this.value)">
            </div>

            <div style="font-size: 12px; opacity: 0.5; margin-bottom:10px;">共 ${announcements.length} 条公告</div>
            <div class="notice-list-container">
                ${announcements.map(a => {
                    const isRead = a.is_read || localStorage.getItem(`read_notice_${a.id}`) === 'true';
                    // 如果是目标 ID，则强制显示（即使开启了隐藏已读）
                    const forceShow = targetId && targetId == a.id;
                    return `
                        <div class="notice-list-item ${a.is_top ? 'is-top' : ''} ${isRead ? 'is-read' : 'is-unread'} ${hideRead && isRead && !forceShow ? 'hide-read' : ''}"
                             id="notice-item-${a.id}" data-id="${a.id}" onclick="toggleNotice(this, '${a.id}')">
                            <div class="notice-item-header">
                                <span class="notice-item-title">
                                    ${a.is_top ? '<span class="notice-badge badge-top">置顶</span>' : ''}
                                    ${!isRead ? '<span class="notice-badge badge-new">NEW</span>' : ''}
                                    <span class="title-text" style="margin-left: ${a.is_top || !isRead ? '8px' : '0'}">${a.title}</span>
                                </span>
                                <span class="notice-item-date">${formatSystemDate(a.created_at, false)}</span>
                                <i class="ri-arrow-down-s-line notice-item-arrow"></i>
                            </div>
                            <div class="notice-item-content">${a.content.replace(/\n/g, '<br>')}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // 处理 targetId 自动展开和滚动
        if (targetId) {
            setTimeout(() => {
                const targetEl = document.getElementById(`notice-item-${targetId}`);
                if (targetEl) {
                    toggleNotice(targetEl, targetId);
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    };

    try {
        const res = await fetch('/api/announcements', {
            headers: window.sysToken ? { 'Authorization': window.sysToken } : {}
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data && Array.isArray(data.announcements)) {
            window.cachedAnnouncements = data.announcements;
            renderList(window.cachedAnnouncements);

            // 自动聚焦第一个项
            setTimeout(() => {
                modal.querySelector('.notice-list-item')?.focus();
            }, 50);

            // 自动聚焦第一个 Tab
            setTimeout(() => {
                modal.querySelector('.hub-tab')?.focus();
            }, 50);
        } else {
            throw new Error('Invalid data format');
        }
    } catch (e) {
        console.error('[Notice Center] Error:', e);
        if (window.cachedAnnouncements && window.cachedAnnouncements.length > 0) {
            showToast("使用本地缓存数据...", "#e67e22");
            renderList(window.cachedAnnouncements);
        } else {
            body.innerHTML = `
                <div class="error-text" style="text-align:center; padding:30px;">
                    <i class="ri-wifi-off-line" style="font-size:32px; display:block; margin-bottom:10px; opacity:0.3;"></i>
                    无法获取公告信息，请检查网络连接<br>
                    <small style="opacity:0.5; font-size:11px;">Error: ${e.message}</small>
                </div>`;
        }
    }
};

window.handleNoticeCenterSearch = (kw) => {
    const keyword = kw.trim().toLowerCase();
    const items = document.querySelectorAll('.notice-list-container .notice-list-item');
    items.forEach(el => {
        const title = el.querySelector('.title-text')?.innerText.toLowerCase() || '';
        const content = el.querySelector('.notice-item-content')?.innerText.toLowerCase() || '';
        const matched = title.includes(keyword) || content.includes(keyword);
        el.style.display = matched ? 'block' : 'none';
    });
};

window.toggleNotice = async (el, id) => {
    const isExpanded = el.classList.contains('is-expanded');

    // 折叠其他已展开的 (Accordion 模式)
    document.querySelectorAll('.notice-list-item.is-expanded').forEach(item => {
        if (item !== el) item.classList.remove('is-expanded');
    });

    el.classList.toggle('is-expanded');

    // 如果是第一次展开且未读，标记为已读 (游客也可在本地标记已读)
    const isUnread = el.classList.contains('is-unread');
    if (!isExpanded && isUnread) {
        el.classList.remove('is-unread');
        el.classList.add('is-read');
        const badge = el.querySelector('.badge-new');
        if (badge) badge.remove();

        // 记录到本地，消除红点
        localStorage.setItem(`read_notice_${id}`, 'true');
        const notice = window.cachedAnnouncements.find(a => a.id == id);
        if (notice) notice.is_read = 1;

        // 立即刷新全局 Badge
        refreshNoticeBadge();

        if (window.sysToken) {
            try {
                await fetch('/api/announcements', {
                    method: 'POST',
                    headers: { 'Authorization': window.sysToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [id] })
                });
            } catch (e) { console.warn('[Notice] Sync read state failed'); }
        }
    }
};

window.toggleHideRead = (checked) => {
    localStorage.setItem('nav_hide_read_announcements', checked);
    const items = document.querySelectorAll('.notice-list-item.is-read');
    items.forEach(item => item.classList.toggle('hide-read', checked));

    // 切换隐藏状态后同步刷新 Badge 状态 (仅针对已读项被过滤的情况)
    refreshNoticeBadge();
};

window.markAllNoticesRead = async () => {
    if (!window.cachedAnnouncements.length) return;

    const unreadIds = window.cachedAnnouncements.filter(a => !(a.is_read || localStorage.getItem(`read_notice_${a.id}`))).map(a => a.id);
    if (unreadIds.length === 0) return;

    unreadIds.forEach(id => localStorage.setItem(`read_notice_${id}`, 'true'));
    window.cachedAnnouncements.forEach(a => { if (unreadIds.includes(a.id)) a.is_read = 1; });

    showToast("已全部标记为已读");
    refreshNoticeBadge();

    if (window.sysToken) {
        try {
            await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.sysToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
        } catch (e) { console.warn('[Notice] Sync bulk read failed'); }
    }

    openNoticeCenter(); // 刷新列表状态
};
window.refreshNoticeBadge = refreshNoticeBadge;
window.initAnnouncements = initAnnouncements;
// Window bridge for cross-module and inline onclick callers
window.initAnnouncementsWatcher = initAnnouncementsWatcher;
window.checkAnnouncementsUpdate = checkAnnouncementsUpdate;
window.renderImportantNoticeForGuest = renderImportantNoticeForGuest;
window.renderImportantNotice = renderImportantNotice;
window.viewNoticeDetail = viewNoticeDetail;
window.renderQuietNotice = renderQuietNotice;
