/**
 * @fileoverview Feature module: render
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

// ==================== 5. 渲染逻辑 ====================
const buildCardHtml = (i) => {
    const target = window.appData.settings?.link_target || '_blank';
    const rel = target === '_blank' ? 'rel="noopener noreferrer"' : '';

    let iconUrl = i.icon;
    // 如果没有配置图标（如默认空或 `""` 等情况），基于原站域名动态计算出最优初始网络 Favicon 路径
    if (!iconUrl && i.url && i.url.startsWith('http')) {
        try {
            const domain = new URL(i.url).hostname;
            if (domain) {
                iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
            }
        } catch(e) {}
    }
    // 智能防追踪过滤与 404 红字清零优化：如果卡片图标是指向容易爆 404 的源，自动动态升级为 DDG 的 200-OK 极速不报错源
    if (iconUrl && iconUrl.startsWith('http') && !iconUrl.includes('images.unsplash.com') && !iconUrl.includes('api.iconify.design')) {
        try {
            let domain = '';
            if (i.url && i.url.startsWith('http')) {
                domain = new URL(i.url).hostname;
            } else {
                domain = new URL(iconUrl).hostname;
            }
            if (domain && (iconUrl.includes('/favicon.ico') || iconUrl.includes('api.iowen.cn'))) {
                iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
            }
        } catch(e) {}
    }

    const icon = iconUrl && iconUrl.startsWith('http')
        ? `<img src="${iconUrl}" loading="lazy" data-retry-index="0" data-title="${escapeHTML(i.title)}" onload="utils.handleIconLoad(this, '${i.url}')" onerror="utils.handleIconError(this, '${i.url}')">`
        : `<span class="emoji-icon">${i.icon || '🔗'}</span>`;
    return `<a href="${i.url}" target="${target}" ${rel}><div class="icon-wrapper">${icon}</div><h3>${i.title}</h3></a>`;
};

const buildVideoCardHtml = (item) => {
    const isBili = item.url.includes('bilibili.com');
    const isYt = item.url.includes('youtube.com') || item.url.includes('youtu.be');

    let coverUrl = item.icon || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=60';
    let badgeClass = '';
    let badgeText = '';

    if (isBili) {
        badgeClass = 'bilibili';
        badgeText = 'Bilibili';
    } else if (isYt) {
        badgeClass = 'youtube';
        badgeText = 'YouTube';
        // 正则解析 YouTube 视频 ID 从而免流量拉取官方高清封面 (hqdefault.jpg)
        const ytMatch = item.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/i);
        if (ytMatch && !item.icon) {
            coverUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
    } else {
        badgeClass = 'other';
        badgeText = 'Video';
    }

    return `
        <div class="video-card-cover">
            <img src="${coverUrl}" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=60'">
            <div class="video-card-badge ${badgeClass}">${badgeText}</div>
            <div class="video-play-overlay">
                <div class="video-play-btn"><i class="ri-play-fill"></i></div>
            </div>
        </div>
        <div class="video-card-body">
            <h4 class="video-card-title">${item.title}</h4>
            <p class="video-card-desc">${item.desc || '暂无描述'}</p>
        </div>
    `;
};

const playVideoInline = (item) => {
    window.lastFocusedElement = document.activeElement;
    closeAllModals(true);

    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    const title = document.getElementById('video-title');
    const desc = document.getElementById('video-desc');
    const link = document.getElementById('video-link');

    if (!modal || !iframe) return;

    let embedUrl = item.url;
    const isBili = item.url.includes('bilibili.com');
    const isYt = item.url.includes('youtube.com') || item.url.includes('youtu.be');

    if (isBili) {
        const bvMatch = item.url.match(/(BV[a-zA-Z0-9]+)/i);
        if (bvMatch) {
            embedUrl = `//player.bilibili.com/player.html?bvid=${bvMatch[1]}&high_quality=1&as_wide=1&autoplay=1`;
        }
    } else if (isYt) {
        const ytMatch = item.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/i);
        if (ytMatch) {
            embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
        }
    }

    iframe.src = embedUrl;
    if (title) title.innerText = item.title;
    if (desc) desc.innerText = item.desc || '暂无描述';
    if (link) {
        link.href = item.url;
        link.style.display = 'inline-block';
    }

    modal.style.display = 'flex';
};
window.playVideoInline = playVideoInline;

const closeVideoModal = () => {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('video-iframe');
    if (modal && iframe) {
        iframe.src = ''; // 彻底清空，防止音频后台播放
        modal.style.display = 'none';
    }
    if (window.lastFocusedElement) {
        window.lastFocusedElement.focus();
        window.lastFocusedElement = null;
    }
};
window.closeVideoModal = closeVideoModal;

const renderNav = () => {
    window.renderNav = renderNav;
    if (window.isRendering) return;
    window.isRendering = true;

    try {
        const sidebarNav = document.getElementById('sidebar-nav');
        const container = document.getElementById('grid-container');
        if (!sidebarNav || !container) {
            window.isRendering = false;
            return;
        }

        // 基础数据防御与空态处理
        if (!window.appData || !window.appData.categories || window.appData.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state-tip" style="text-align:center; padding: 100px 20px; color: var(--text-dim);">
                    <i class="ri-wind-line" style="font-size: 48px; opacity: 0.3;"></i>
                    <p style="margin-top: 15px;">暂无内容，请登录后开始添加</p>
                    ${!window.sysToken ? '<button class="tab-btn" style="margin-top:20px;" onclick="showAuthModal()">立即登录</button>' : ''}
                </div>
            `;
            window.isRendering = false;
            return;
        }

        const clickData = getFrequentItemsData();
        const freqIds = Object.keys(clickData).filter(id => clickData[id] >= 10);

        sidebarNav.innerHTML = '';
        container.innerHTML = '';

        // 清空并隐藏禅意视界容器
        const zenHorizon = document.getElementById('zen-horizon');
        const zenMenu = document.getElementById('zen-nav-menu');
        const zenFreq = document.getElementById('zen-frequent-sites');
        if (zenMenu) zenMenu.innerHTML = '';
        if (zenFreq) zenFreq.innerHTML = '';

        let cats = window.isAdmin ? [...window.appData.categories] : window.appData.categories.filter(c => !c.hidden);
        if (freqIds.length > 0 && window.appData.settings?.showFrequent !== false) {
            cats.unshift({ id: 'VIRTUAL_FREQ', name: '常去网站', icon: '⭐' });
        }

        // 导航视界定义：自动校正过期的或无效 of activeCatId 深度自愈)
        const isValidActiveCat = cats.some(c => c.id === window.activeCatId);
        if (cats.length > 0 && (!window.activeCatId || !isValidActiveCat)) {
            window.activeCatId = cats[0].id;
        }

        // 渲染禅意模式下的横向菜单
        const isZen = window.appData.settings?.zenMode === true;
        if (isZen && zenMenu) {
            // 如果开启了常去网站，且有数据，在菜单上方渲染一个精简的常去图标栏
            if (window.appData.settings?.showFrequent !== false && freqIds.length > 0 && zenFreq) {
                const freqItems = window.appData.items.filter(i => freqIds.includes(i.id)).slice(0, 10);
                zenFreq.innerHTML = `<div class="zen-freq-title">常去网站</div><div class="zen-freq-list"></div>`;
                const freqList = zenFreq.querySelector('.zen-freq-list');
                freqItems.forEach((item, idx) => {
                    const icon = document.createElement('div');
                    icon.className = 'zen-freq-item';
                    icon.style.animationDelay = `${idx * 0.05}s`; // T8: Stagger
                    icon.innerHTML = item.icon?.startsWith('http')
                        ? `<img src="${item.icon}" title="${item.title}">`
                        : `<span class="emoji-icon" title="${item.title}">${item.icon || '🔗'}</span>`;
                    icon.onclick = () => {
                        recordClick(item.id);
                        const target = window.appData.settings?.link_target || '_blank';
                        window.open(item.url, target);
                    };
                    freqList.appendChild(icon);
                });
            }

            cats.forEach((cat, idx) => {
                const menuItem = document.createElement('div');
                menuItem.className = `zen-menu-item ${window.activeCatId === cat.id ? 'active' : ''}`;
                menuItem.tabIndex = 0; // 启用键盘焦点
                menuItem.style.animationDelay = `${(idx * 0.05) + 0.2}s`; // T8: Stagger
                const catIconHtml = cat.icon?.startsWith('http')
                    ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">`
                    : `<span style="font-size: 16px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;
                menuItem.innerHTML = `<span class="menu-icon" style="width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; vertical-align: middle; margin-right: 6px;">${catIconHtml}</span><span class="menu-label">${cat.name}</span>`;

                // 处理键盘激活
                menuItem.onkeydown = (e) => {
                    if (e.key === 'Enter') menuItem.click();
                };
                menuItem.onclick = () => {
                    if (window.activeCatId === cat.id) return;
                    window.activeCatId = cat.id;

                    // 切换动画与重新渲染
                    container.style.opacity = '0';
                    container.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        renderNav();
                        container.style.opacity = '1';
                        container.style.transform = 'translateY(0)';
                    }, 150);
                };
                zenMenu.appendChild(menuItem);
            });
            const activeChip = zenMenu.querySelector('.zen-menu-item.active');
            if (activeChip && window.matchMedia('(max-width: 768px)').matches) {
                requestAnimationFrame(() => {
                    activeChip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
                });
            }
        }

        const sidebarFragment = document.createDocumentFragment();
        const containerFragment = document.createDocumentFragment();

        cats.forEach(cat => {
            const navItem = document.createElement('div');
            navItem.className = `sidebar-nav-item ${window.activeCatId === cat.id ? 'active' : ''} ${cat.hidden ? 'is-hidden-cat' : ''}`;
            navItem.dataset.id = cat.id; // 增加 ID 绑定
            navItem.tabIndex = 0; // 启用键盘焦点

            if (window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                navItem.classList.add('sortable-cat'); // 标记可排序
            }

            // 计算书签数量
            const itemCount = window.appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
            const countHtml = (window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ')
                ? `<span class="nav-count">${itemCount}</span>`
                : '';

            // 基础内容 (增加拖拽手柄)
            const dragHandleHtml = (window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ')
                ? `<span class="drag-handle" style="margin-right: 6px; cursor: move; opacity: 0.5;"><i class="ri-drag-move-2-line"></i></span>`
                : '';

            const catIconHtml = cat.icon?.startsWith('http')
                ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">`
                : `<span style="font-size: 15px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;
            let navHtml = `${dragHandleHtml}<span class="nav-icon" title="" style="width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; vertical-align: middle; margin-right: 8px;">${catIconHtml}</span><span class="nav-label">${cat.name}${countHtml}</span>`;

            // 增加管理快捷按钮
            if (window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                navHtml += `
                    <div class="nav-actions">
                        <span class="nav-action-btn ${cat._isVideo ? 'active' : ''}" title="${cat._isVideo ? '视频分类：开启' : '普通分类：点击切换为视频分类'}" onclick="event.stopPropagation(); toggleCategoryVideoMode('${cat.id}')">
                            <i class="${cat._isVideo ? 'ri-video-fill' : 'ri-video-line'}"></i>
                        </span>
                        <span class="nav-action-btn" title="编辑分类" onclick="event.stopPropagation(); openCategoryEditModal('${cat.id}')">
                            <i class="ri-settings-4-line"></i>
                        </span>
                        <span class="nav-action-btn" title="${cat.hidden ? '取消隐藏' : '隐藏分类'}" onclick="event.stopPropagation(); toggleCategoryVisibility('${cat.id}')">
                            <i class="${cat.hidden ? 'ri-eye-line' : 'ri-eye-off-line'}"></i>
                        </span>
                        <span class="nav-action-btn delete" title="删除分类" onclick="event.stopPropagation(); deleteCategory('${cat.id}')">
                            <i class="ri-delete-bin-line"></i>
                        </span>
                    </div>
                `;
            }

            navItem.innerHTML = navHtml;

            // 补全键盘激活逻辑
            navItem.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navItem.click();
                }
            };

            navItem.onclick = () => {
                if (window.activeCatId === cat.id) return;

                window.activeCatId = cat.id;
                // 确定是否需要切换隔离视图
                const isIsolated = (window.appData.settings?.zenMode || window.appData.settings?.isolatedView) && !window.isPageManagementMode;

                if (isIsolated) {
                    window.isZenTempExpanded = true;
                    document.body.classList.remove('zen-silent'); // 点击切换时必然唤醒

                    // 增加切换时的淡出效果
                    const container = document.getElementById('grid-container');
                    if (container) {
                        container.style.opacity = '0';
                        container.style.transform = 'translateY(10px)';
                        setTimeout(() => {
                            renderNav();
                            container.style.opacity = '1';
                            container.style.transform = 'translateY(0)';
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 150);
                    } else {
                        renderNav();
                    }
                }
                else {
                    document.getElementById('section-' + cat.id)?.scrollIntoView({ behavior: 'smooth' });
                    // 非隔离模式下也更新 active 状态（视觉同步）
                    document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
                    navItem.classList.add('active');
                }
            };
            sidebarFragment.appendChild(navItem);

            // 视图隔离核心逻辑 深度对齐)
            // 1. 禅意模式开启时：强制执行单一视图原则，无视 isolatedView 设置
            // 2. 常规模式开启时：遵循用户的手动 isolatedView 设置 (默认为 false/长廊)
            // 3. 页面管理模式：强制全分类展示以支持拖拽
            const isIsolatedView = !window.isPageManagementMode && (window.appData.settings?.zenMode || window.appData.settings?.isolatedView);

            if (isIsolatedView && cat.id !== window.activeCatId) return;

            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = 'section-' + cat.id;
            const sectionIconHtml = cat.icon?.startsWith('http')
                ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">`
                : `<span style="font-size: 20px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;

            // 🔒 限制当前分类名展示：最多 1 个图标加 5 个字，溢出自动截断
            const truncatedCatName = cat.name.length > 5 ? cat.name.substring(0, 5) + '...' : cat.name;
            const canEditCat = window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ';

            section.innerHTML = `
                <div class="category-section-title ${canEditCat ? 'manage-clickable-cat' : ''}"
                     style="display: flex; align-items: center; gap: 8px; ${canEditCat ? 'cursor: pointer; user-select: none;' : ''}"
                     ${canEditCat ? `onclick="window.openCategoryEditModal('${cat.id}')" title="点击编辑分类名称及图标"` : ''}>
                    <span style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; vertical-align: middle;">${sectionIconHtml}</span>
                    <span class="cat-title-text">${escapeHTML(truncatedCatName)}</span>
                    ${canEditCat ? `<i class="ri-edit-line edit-pencil-icon" style="font-size: 14px; opacity: 0.5; margin-left: 4px; transition: 0.2s;"></i>` : ''}
                </div>
            `;

            const grid = document.createElement('div');
            grid.className = cat._isVideo ? 'video-grid' : 'nav-grid';

            // 健壮的过滤逻辑：同时支持 catId 和 cat_id (容错设计)，且“常去网站”分类对隐藏属性进行强校验
            const items = (cat.id === 'VIRTUAL_FREQ')
                ? window.appData.items.filter(i => freqIds.includes(i.id) && (window.isPageManagementMode || window.isAdmin || !i.hidden))
                : window.appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id) && (window.isPageManagementMode || window.isAdmin || !i.hidden));

            items.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = cat._isVideo
                    ? `video-card ${item.hidden ? 'hidden-item' : ''}`
                    : `card ${item.hidden ? 'hidden-item' : ''}`;
                // 为磁贴增加 Tab 索引与唯一 ID，方便键盘流转
                card.setAttribute('tabindex', '0');
                card.setAttribute('data-id', item.id);
                // 注入描述作为 Tooltip
                if (item.desc) {
                    card.setAttribute('data-tooltip', item.desc);
                }
                card.style.animationDelay = `${idx * 0.03}s`;

                let html = cat._isVideo ? buildVideoCardHtml(item) : buildCardHtml(item);

                // 编辑入口 (页面管理模式下对所有人开放，常规模式下仅限管理员)
                if (window.isPageManagementMode || window.isAdmin) {
                    html += `<div class="card-admin-btns">
                        ${window.isPageManagementMode ? `<button class="card-hide-toggle-btn" onclick="event.stopPropagation(); toggleItemHidden('${item.id}')" title="${item.hidden ? '设为公开显示' : '设为对外隐藏'}"><i class="${item.hidden ? 'ri-eye-off-line' : 'ri-eye-line'}"></i></button>` : ''}
                        <button class="card-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="编辑"><i class="ri-edit-line"></i></button>
                        ${window.isPageManagementMode ? `<button class="card-delete-btn" onclick="event.stopPropagation(); deleteItem('${item.id}')" title="删除"><i class="ri-delete-bin-line"></i></button>` : ''}
                    </div>`;
                }

                // 🚀 新增对外隐藏状态标识（在普通浏览态下且非管理模式，管理员/登录用户能清晰知道哪些书签是对外隐藏的）
                if (item.hidden && window.isAdmin && !window.isPageManagementMode) {
                    html += `<div class="card-hidden-badge" title="该网址已对外隐藏"><i class="ri-eye-off-line"></i></div>`;
                }

                card.innerHTML = html;

                // 处理点击逻辑 (增强点击响应稳定性)
                card.onclick = (e) => {
                    if (window.isPageManagementMode) {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = card.getAttribute('data-id');
                        if (window.selectedIds.has(id)) window.selectedIds.delete(id);
                        else window.selectedIds.add(id);
                        card.classList.toggle('selected', window.selectedIds.has(id));
                        updateBatchBar();
                    } else {
                        if (cat._isVideo) {
                            e.preventDefault();
                            recordClick(item.id);
                            if (window.playVideoInline) {
                                window.playVideoInline(item);
                            } else {
                                window.open(item.url, '_blank');
                            }
                        } else {
                            // 如果点击的是链接或其子元素，由 <a> 标签原生处理跳转
                            // JS 仅负责记录点击频率
                            recordClick(item.id);
                        }
                    }
                };

                // 键盘激活支持
                card.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        if (window.isPageManagementMode) {
                            card.click();
                        } else {
                            recordClick(item.id);
                            if (cat._isVideo) {
                                if (window.playVideoInline) {
                                    window.playVideoInline(item);
                                } else {
                                    window.open(item.url, '_blank');
                                }
                            } else {
                                const target = window.appData.settings?.link_target || '_blank';
                                window.open(item.url, target);
                            }
                        }
                    }
                };

                grid.appendChild(card);
            });

            // 磁贴末尾的新增入口 (仅管理模式)
            if (window.isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                const catItemCount = items.length;
                const quota = window.appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
                const isCatFull = catItemCount >= quota.maxItemsPerCategory;

                addCard.className = `card add-new-card ${isCatFull ? 'disabled' : ''}`;
                addCard.tabIndex = 0; // 启用键盘焦点
                addCard.innerHTML = `
                    <div class="icon-wrapper"><i class="ri-add-line"></i></div>
                    <h3>${isCatFull ? '已满' : '新增书签'}</h3>
                    <p style="font-size: 10px; opacity: 0.6; margin-top: 4px;">(${catItemCount}/${quota.maxItemsPerCategory})</p>
                `;
                addCard.onclick = () => {
                    if (isCatFull) return showToast(`该分类已达到 ${quota.maxItemsPerCategory} 个书签上限`, "#e74c3c");
                    window.activeCatId = cat.id;
                    openEditModal('');
                };

                // 键盘支持
                addCard.onkeydown = (e) => {
                    if (e.key === 'Enter') addCard.click();
                };
                grid.appendChild(addCard);
            }

            section.appendChild(grid);
            containerFragment.appendChild(section);
        });
        sidebarNav.appendChild(sidebarFragment);
        container.appendChild(containerFragment);

        // 侧边栏新增分类入口 (仅管理模式)
        if (window.isPageManagementMode) {
            const addCatBtn = document.createElement('div');
            const catCount = window.appData.categories.length;
            const quota = window.appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
            const isCatLimit = catCount >= quota.maxCategories;
            const sidebarNav = document.getElementById('sidebar-nav');
            if (sidebarNav) {
                addCatBtn.className = `sidebar-nav-item add-cat-nav ${isCatLimit ? 'disabled' : ''}`;
                addCatBtn.innerHTML = `
                    <span class="nav-icon"><i class="ri-add-line"></i></span>
                    <span class="nav-label">${isCatLimit ? '分类已满' : '添加分类'}</span>
                    <span style="font-size: 10px; opacity: 0.5; margin-left: auto; padding-right: 10px;">${catCount}/${quota.maxCategories}</span>
                `;
                addCatBtn.onclick = () => {
                    if (isCatLimit) return showToast(`最多只能创建 ${quota.maxCategories} 个分类`, "#e74c3c");
                    openCategoryEditModal("");
                };
                sidebarNav.appendChild(addCatBtn);
            }
        }

        // 统一禅意模式状态管理
        window.isActuallyZen = window.appData.settings?.zenMode && !window.isZenTempExpanded;
        if (window.isActuallyZen && !document.body.classList.contains('zen-silent-woken')) {
            document.body.classList.add('zen-silent');
        } else {
            document.body.classList.remove('zen-silent');
        }

        const zenBtn = document.getElementById('zen-expand-btn');
        if (zenBtn) zenBtn.style.display = (window.appData.settings?.zenMode && !window.isZenTempExpanded) ? 'flex' : 'none';

        // Zen Mode 下强制侧边栏行为
        if (window.appData.settings?.zenMode) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('open')) {
                document.getElementById('sidebar-overlay')?.classList.remove('visible');
            }
        }

        // UX Bridge - 游客引导
        if (!window.sysToken && window.appData.settings?.zenMode && !window.isZenTempExpanded) {
            let bridge = document.getElementById('guest-login-bridge');
            if (!bridge) {
                bridge = document.createElement('div');
                bridge.id = 'guest-login-bridge';
                bridge.className = 'guest-login-bridge';
                bridge.innerText = '管理我的书签';
                bridge.onclick = () => showAuthModal();
                const searchSection = document.getElementById('search-section');
                if (searchSection) searchSection.appendChild(bridge);
            }
        } else {
            document.getElementById('guest-login-bridge')?.remove();
        }
    } finally {
        window.isRendering = false;
    }

    if (window.isPageManagementMode && typeof window.initSortable === 'function') {
        window.initSortable();
    }
};

const renderTools = () => {
    window.renderTools = renderTools;
    const area = document.getElementById('sidebar-admin-area');
    const userArea = document.getElementById('sidebar-user-section');
    const adminBanner = document.getElementById('admin-active-banner');
    if (!area || !userArea) return;

    if (window.isSharedPageMode) {
        // 💡 1. 在分享主页只读模式下，彻底隐藏所有管理配置按钮
        area.innerHTML = '';
        userArea.innerHTML = `
            <div class="sidebar-user-card guest">
                <div class="user-avatar-wrapper" style="display: flex; align-items: center; justify-content: center; background: var(--primary); color: #fff; font-weight: bold; border-radius: 50%;">
                    <span>${(window.appData.shareOwner || 'S')[0].toUpperCase()}</span>
                </div>
                <div class="user-meta-box">
                    <span class="user-name" style="margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;">
                        @${escapeHTML(window.appData.shareOwner || '未知用户')}
                    </span>
                    <span class="user-uid" style="background: rgba(255, 255, 255, 0.08); color: var(--text-dim); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block;">只读分享主页</span>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid var(--glass-border); font-size: 11px; line-height: 1.5; color: var(--text-dim);">
                <i class="ri-information-line" style="color: var(--primary);"></i> 您当前正在浏览 <strong>@${escapeHTML(window.appData.shareOwner)}</strong> 的公开网址库。已启用隐私脱敏安全沙箱。
            </div>
        `;
        if (adminBanner) adminBanner.style.display = 'none';
        document.body.classList.remove('admin-mode');
        return;
    }

    const themeIconMap = { 'auto': 'ri-computer-line', 'light': 'ri-sun-line', 'dark': 'ri-moon-line' };
    const themeNameMap = { 'auto': '跟随系统', 'light': '明亮模式', 'dark': '暗黑模式' };

    // 1. 渲染用户信息区域
    const info = window.sysToken
        ? (window.currentUser || JSON.parse(localStorage.getItem('nav_current_user') || '{}'))
        : { username: '访客模式', role: 'guest', uid: null };

    const DEFAULT_AVATARS = [
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=John',
        'https://api.dicebear.com/7.x/miniavs/svg?seed=Lily',
        'https://api.dicebear.com/7.x/identicon/svg?seed=Jack',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Garfield'
    ];

    if (!window.sysToken) {
        const guestAvatar = DEFAULT_AVATARS[0];
        // 游客态显示登录引导
        userArea.innerHTML = `
            <div class="sidebar-user-card guest" onclick="showAuthModal()" title="点击登录同步云端">
                <div class="user-avatar-wrapper" style="display: flex; align-items: center; justify-content: center;">
                    <img src="${guestAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                </div>
                <div class="user-meta-box">
                    <span class="user-name" style="margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;">
                        访客模式
                        <div id="network-status" class="network-status-dot online" tabindex="0"></div>
                    </span>
                    <span class="user-uid" style="background: rgba(255, 255, 255, 0.08); color: var(--text-dim); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; opacity: 1; display: inline-block; width: max-content; font-family: monospace;">GUEST (点击登录)</span>
                </div>
            </div>
        `;
    } else {
        const userDisplayName = info.username || window.appData.username || '已登录用户';

        let badgeText = 'USER';
        let badgeColor = 'rgba(255, 255, 255, 0.08)';
        let badgeTextCol = 'var(--text-dim)';

        if (info.role === 'admin') {
            badgeText = 'ADMIN';
            badgeColor = '#e74c3c';
            badgeTextCol = '#fff';
        } else if (info.role === 'super_user') {
            badgeText = 'SUPER';
            badgeColor = '#3498db';
            badgeTextCol = '#fff';
        } else if (info.hasInvite || info.has_invite) {
            badgeText = 'INVITED';
            badgeColor = '#2ecc71';
            badgeTextCol = '#fff';
        }

        const userAvatar = window.appData.settings?.avatarUrl || localStorage.getItem('nav_user_avatar_' + info.id) || DEFAULT_AVATARS[0];
        const avatarHtml = `<img src="${userAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;

        const displayUid = info.uid
            ? `<span class="user-uid" style="background: ${badgeColor}; color: ${badgeTextCol}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; opacity: 1; display: inline-block; width: max-content; font-family: monospace;" title="身份: ${badgeText} | 完整内部 ID: ${info.id}">ID: ${info.uid}</span>`
            : `<span class="user-uid" style="background: ${badgeColor}; color: ${badgeTextCol}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; opacity: 1; display: inline-block; width: max-content; font-family: monospace;">ID: ${info.id?.substring(0, 8) || '---'}</span>`;

        userArea.innerHTML = `
            <div class="sidebar-user-card">
                <div class="sidebar-user-info" onclick="openProfileCenter()" title="修改个人资料">
                    <div class="user-avatar-wrapper" style="display: flex; align-items: center; justify-content: center;">
                        ${avatarHtml}
                    </div>
                    <div class="user-meta-box">
                        <span class="user-name" style="margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;">
                            ${userDisplayName}
                            <div id="network-status" class="network-status-dot online" tabindex="0"></div>
                        </span>
                        ${displayUid}
                    </div>
                </div>
                <button class="sidebar-quick-logout" onclick="doLogout()" title="安全退出登录">
                    <i class="ri-logout-box-r-line"></i>
                </button>
            </div>
        `;
    }

    // 2. 渲染底部管理工具

    // 配额状态感知
    const quota = window.appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
    const isAllFull = window.appData.categories.length >= quota.maxCategories;

    // 管理员模式视觉高亮切换 增强)
    if (window.isPageManagementMode) {
        if (adminBanner) {
            adminBanner.style.display = 'flex';
            const isGuest = !window.sysToken;

            adminBanner.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="ri-tools-fill" style="font-size:18px;"></i>
                    <span>${isGuest ? '页面预览编辑中' : '页面管理中'}</span>
                </div>
                <div class="banner-hint" style="font-size:11px; opacity:0.9; font-weight:normal; display:flex; align-items:center; gap:5px;">
                    <span>${isGuest ? '访客模式：修改仅本地生效' : '拖拽图标排序或点击分类编辑'}</span>
                    ${isGuest ? `<span style="color:var(--primary);cursor:pointer;text-decoration:underline;margin-left:5px;" onclick="showAuthModal()">立即登录同步</span>` : ''}
                    <span style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); margin-left:10px;">
                        <i class="ri-keyboard-line" style="font-size:10px;"></i> Esc 退出
                    </span>
                </div>
                <button class="banner-exit-btn" onclick="togglePageManagement(false)">退出页面管理</button>
            `;
        }
        document.body.classList.add('admin-mode');
    } else {
        if (adminBanner) adminBanner.style.display = 'none';
        document.body.classList.remove('admin-mode');
    }

    // 角色能力判定
    const role = info.role;
    const isLogged = !!window.sysToken;
    const canManageUsers = (role === 'admin' || role === 'super_user');
    const canConfigSystem = (role === 'admin');

    // 统一按钮模板
    const toolbarButtons = [
        {
            id: 'btn-page-manage',
            icon: 'ri-layout-masonry-line',
            label: '页面管理',
            tooltip: '页面管理',
            active: window.isPageManagementMode,
            onclick: 'togglePageManagement()',
            show: true
        },
        {
            id: 'btn-admin-hub',
            icon: 'ri-shield-user-line',
            label: '用户管理',
            tooltip: '用户管理中心',
            onclick: 'openAdminHub()',
            show: canManageUsers
        },
        {
            id: 'btn-sys-config',
            icon: 'ri-shield-keyhole-line',
            label: '系统配置',
            tooltip: '系统配置中心',
            onclick: 'openSystemConfigHub()',
            show: canConfigSystem
        },
        {
            id: 'btn-visual-lab',
            icon: 'ri-settings-4-line',
            label: '视觉实验室',
            tooltip: '个性化设置',
            onclick: 'openVisualLab()',
            show: true
        },
        {
            id: 'btn-theme-toggle',
            icon: themeIconMap[themeMode],
            label: '外观模式',
            tooltip: `主题模式: ${themeNameMap[themeMode]}`,
            active: themeMode !== 'auto',
            onclick: 'toggleThemeMode()',
            show: true
        },
        {
            id: 'btn-sync-center',
            icon: 'ri-cloud-line',
            label: '云端备份',
            tooltip: '云端同步中心',
            onclick: 'openSyncCenter()',
            show: isLogged // 仅登录用户可见
        }
    ];

    area.innerHTML = `
        <div class="sidebar-admin-container">
            <div class="sidebar-admin-toolbar">
                ${toolbarButtons.filter(b => b.show).map(b => `
                    <div class="sidebar-nav-item toolbar-item ${b.active ? 'active' : ''}"
                         id="${b.id}"
                         onclick="${b.onclick}"
                         tabindex="0"
                         data-tooltip="${b.tooltip}">
                        <span class="nav-icon"><i class="${b.icon}"></i></span>
                        <span class="nav-label">${b.label}</span>
                    </div>
                `).join('')}
            </div>

            <!-- 页面管理子菜单 (仅在管理模式下显示) -->
            ${window.isPageManagementMode ? `
            <div class="admin-tools-submenu">
                <div class="sidebar-nav-item"
                     onclick="openEditModal('')"
                     style="font-size: 13px; padding: 6px 12px;">
                    <span class="nav-icon"><i class="ri-add-circle-line"></i></span>
                    <span class="nav-label">新增网址</span>
                </div>
                <div class="sidebar-nav-item" onclick="openJsonEditor()" style="font-size: 13px; padding: 6px 12px;">
                    <span class="nav-icon"><i class="ri-code-s-slash-line"></i></span>
                    <span class="nav-label">专家模式</span>
                </div>
                <!-- 还原为与其他按钮样式一致的“本地导入/导出”按钮 -->
                <div class="sidebar-nav-item" onclick="openImportExportModal()" style="font-size: 13px; padding: 6px 12px;">
                    <span class="nav-icon"><i class="ri-database-2-line"></i></span>
                    <span class="nav-label">本地导入/导出</span>
                </div>
                <div class="sidebar-nav-item" onclick="doResetConfig()" style="font-size: 13px; padding: 6px 12px;">
                    <span class="nav-icon"><i class="ri-refresh-line"></i></span>
                    <span class="nav-label">重置模板</span>
                </div>
                <!-- 退出管理增强 -->
                <div class="sidebar-nav-item exit-manage-btn" onclick="togglePageManagement(false)"
                     style="font-size: 13px; padding: 8px 12px; margin-top: 10px; border-top: 1px solid var(--glass-border); color: var(--primary); font-weight: bold;">
                    <span class="nav-icon"><i class="ri-checkbox-circle-line"></i></span>
                    <span class="nav-label">保存并退出</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // 即时根据真实网络状态校准指示灯
    if (typeof window.updateNetworkStatus === 'function') {
        window.updateNetworkStatus();
    }
};

// 唤起云端备份中心 (风格对齐视觉实验室)
// Cloud sync methods (openSyncCenter, pullBackupFromCloud, executePullBackupFromCloud, manualSyncCloud, setSyncMode) are now managed in cloud-sync.js

// 唤起全站系统参数配置中枢 (Tab 架构重构)
// 全站网站与品牌系统参数配置已抽离至 sys-config.js 子模块中


// 周期性自动备份调度器
const checkAutoSyncSchedule = async () => {
    if (!window.sysToken) return;

    const intervalDays = window.appData.settings?.syncInterval || 0;
    if (intervalDays <= 0) return;

    // 安全防御：如果本地数据根本没有未同步的更改 (isDataDirty 为 false)，则绝对不触发向云端自动备份，
    // 从而 100% 避免新终端登录时，本地默认旧数据在不知情的情况下覆盖了云端的珍贵自定义数据！
    if (!window.isDataDirty) {
        console.log('[Sync] Local data is clean. Skip automatic cloud backup to protect customized cloud data.');
        return;
    }

    const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
    const now = Date.now();
    const threshold = intervalDays * 24 * 60 * 60 * 1000;

    if (now - lastSync > threshold) {
        console.log(`[Sync] Auto-sync triggered. Interval: ${intervalDays} days. Last sync: ${formatSystemDate(lastSync, false)}`);

        showToast(`自动备份中 (周期: ${intervalDays} 天)...`, "#3498db");
        await manualSyncCloud();
    }
};
// Window bridge for cross-module and inline onclick callers
window.buildCardHtml = buildCardHtml;
window.buildVideoCardHtml = buildVideoCardHtml;
window.renderNav = renderNav;
window.renderTools = renderTools;
window.checkAutoSyncSchedule = checkAutoSyncSchedule;
