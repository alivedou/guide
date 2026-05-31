// Task SYNC.GUARD.2: 获取核心数据指纹（仅包含分类和网址内容）
const getCoreDataFingerprint = (data) => {
    if (!data) return '';
    return JSON.stringify({
        c: data.categories || [],
        i: data.items || [],
        s: data.settings || {} // 包含设置，但不包含像 isAdmin 这种运行时状态
    });
};

// ==================== 全局状态 ====================
let appData = { 
    settings: { cardWidth: 85, zenMode: false, isolatedView: false }, 
    categories: [
        { id: 'temp_init', name: '加载中...', icon: '⌛' }
    ], 
    items: [] 
};
let activeCatId = 'temp_init';
let sysToken = localStorage.getItem('nav_token') || '';
let currentUser = JSON.parse(localStorage.getItem('nav_current_user') || 'null'); // Task 39.4
let isAdmin = false;
let isZenTempExpanded = true;
let isActuallyZen = false;
let isRendering = false; // 渲染防抖锁
let lastSyncFingerprint = ''; // Task SYNC.GUARD.2: 数据指纹，用于过滤无效同步
let isPageManagementMode = false; // 页面管理模式开关 (Task 3.3)
let zenMoveAccumulator = 0; // 禅意模式位移累加器 (Task 11.1)
let lastMouseX = 0;
let lastMouseY = 0;
let isSidebarPinned = localStorage.getItem('nav_sidebar_pinned') !== 'false'; // 默认开启图钉 (Task 4.5.3)
let selectedIds = new Set(); // 已选中的 ID 集合
let sortableInstances = []; // Sortable 实例存储
let syncTimer = null; // 同步防抖计时器 (Task 2.5.4)
let syncRetryCount = 0; // 重试计数
let touchStartY = 0; // 触摸起点 (Task 2.5.1)
let currentSearchIndex = -1;
let historyIndex = -1;
let searchHistory = JSON.parse(localStorage.getItem('search_history') || '[]');
let themeMode = localStorage.getItem('nav_theme_mode') || 'auto';
let simpleMode = localStorage.getItem('nav_simple_mode') === 'true';
let currentEnginePrefix = localStorage.getItem('nav_search_prefix') || 'https://cn.bing.com/search?q=';
let isDataDirty = false; // Task O+.1: 全局数据变更标记
let lastSyncActionTime = 0; // Task 11.1: 云端同步冷却计时器
let currentEditingAnnounceId = null; // Task 34.2: 正在编辑的公告 ID
let lastFocusedElement = null; // Task 37.2: 记录弹窗前的焦点元素
let adminUserFilters = { page: 1, pageSize: 20, keyword: '', status: '' }; // Task UM.3: 管理员用户筛选
let adminSelectedUserIds = new Set(); // Task UM.4: 选中的用户 ID
let adminAnnounceFilters = { page: 1, pageSize: 20, keyword: '', status: '', type: '' }; // Task AN.3: 公告筛选
let adminSelectedAnnounceIds = new Set(); // Task AN.3: 选中的公告 ID
let adminInviteFilters = { page: 1, pageSize: 20, keyword: '', status: '' }; // Task STD.2: 邀请码筛选
let adminSelectedInviteIds = new Set(); // Task STD.2: 选中的邀请码
let adminAuditFilters = { page: 1, pageSize: 20, keyword: '', actionType: '' }; // Task STD.3: 审计日志筛选
let adminData = { users: [], invitations: [], announcements: [], logs: [], pagination: {} }; // 管理员全站数据缓存

// Task AL.1: 审计日志动作语义化映射
const AuditActionMap = {
    'LOGIN': { label: '安全登录', color: '#2ecc71' },
    'CREATE_USER': { label: '创建用户', color: '#3498db' },
    'DELETE_USER': { label: '危险：物理删除', color: '#e74c3c' },
    'CHANGE_USER_STATUS': { label: '状态切换', color: '#f39c12' },
    'CHANGE_USER_ROLE': { label: '权限变更', color: '#9b59b6' },
    'RESET_PASSWORD': { label: '重置密码', color: '#e67e22' },
    'UPDATE_SITE_CONFIG': { label: '配置修改', color: '#e74c3c' },
    'CREATE_ANNOUNCEMENT': { label: '发布公告', color: '#3498db' },
    'UPDATE_ANNOUNCEMENT': { label: '编辑公告', color: '#f39c12' },
    'DELETE_ANNOUNCEMENT': { label: '下架公告', color: '#95a5a6' },
    'BATCH_GENERATE_INVITATIONS': { label: '批量生成邀请码', color: '#1abc9c' },
    'DELETE_INVITATION': { label: '作废邀请码', color: '#95a5a6' }
};

// ==================== Task 22.1: 全局语义化同步反馈引擎 ====================
const SyncUI = {
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
            const isGuest = !sysToken;
            return {
                loading: isGuest ? '正在保存修改至本地...' : '正在暂存修改至本地...',
                success: isGuest ? '保存成功！登录后可实现多设备同步' : '已暂存至本地，退出登录时将自动同步'
            };
        },
        'BACKUP_MANUAL': { loading: '正在执行手动云端备份...', success: '备份完成，你的数据已在云端安全存档' },
        'CLIPBOARD': { loading: '正在准备数据...', success: '内容已加密复制至剪贴板' }
    },

    // 2. 统一动作包装器
    async perform(actionKey, task) {
        let msg = this.messages[actionKey];
        // 如果是函数则执行获取对象 (用于区分角色话术)
        if (typeof msg === 'function') msg = msg();
        
        showLoader(msg.loading);
        try {
            const result = await task();
            showToast(msg.success, "#27ae60");
            return result;
        } catch (e) {
            console.error(`[SyncUI] Action ${actionKey} failed:`, e);
            // Task EXIT.1: 区分普通错误与引导性警告
            const toastColor = e.isWarning ? "#e67e22" : "#e74c3c";
            showToast(e.message || "操作失败", toastColor);
            // 如果是警告，我们可能不想让调用者认为任务彻底失败了，但在目前的 Promise 链中 throw 是必要的
            throw e;
        } finally {
            hideLoader();
        }
    }
};

// ==================== 1. 初始化入口 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 优先初始化基础 UI 交互与快捷键 (不依赖云端数据)
    initThemeMode();
    initSidebar();
    initZenMode();
    initSearch();
    initAuthUI();
    initGlobalEvents();

    // 2. 初始视觉校准 (使用默认配置防止白屏)
    updateStyles();
    
    // 3. 异步获取 Bing 壁纸 (Task 12.1)
    if (!appData.settings?.bgUrl) {
        getBingWallpaper().then(() => updateStyles());
    }

    // 4. 异步获取云端配置与公告
    initSiteConfig();
    init(); // 核心数据加载 (内部会触发 initAnnouncements)
    
    checkSWUpdate();
    
    // Task 6.6: 初始化公告更新监听
    initAnnouncementsWatcher();

    // Task 9.4: 启动自动备份调度检查 (延迟 10 秒执行，避开启动高峰)
    setTimeout(checkAutoSyncSchedule, 10000);
});

// Task 6.6: 公告更新监听引擎
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
            headers: sysToken ? { 'Authorization': sysToken } : {}
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

// Task 4.2: PWA 更新感知
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

// ==================== 2. 辅助工具 ====================
window.sysSiteConfig = null; // 全局系统配置缓存

// Task 6.32: 统一 SQLite/D1 无时区 UTC 时间安全解析网关 (解决北京时区差 8 小时 Bug)
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

// Task 4.1 & 21.2: 全站 SEO 与标题下发 (静默处理鉴权失败)
const initSiteConfig = async () => {
    try {
        // 如果没有 token，大概率会 403，本地环境下我们选择直接跳过或静默处理
        const res = await fetch('/api/admin/site-config', {
            headers: sysToken ? { 'Authorization': sysToken } : {}
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

// Task 4.2: 公告系统
let cachedAnnouncements = []; // 缓存公告列表用于状态同步

const refreshNoticeBadge = () => {
    try {
        if (!Array.isArray(cachedAnnouncements)) return;
        
        let unreadCount = 0;
        if (!sysToken) {
            // 游客状态下小红点一直保留，去不掉 (只要存在发布的公告就一直显示) (Task NT.3)
            unreadCount = cachedAnnouncements.length;
        } else {
            // 登录状态下根据后端 D1 和本地已读情况来取消红点 (Task NT.3)
            unreadCount = cachedAnnouncements.filter(notice => {
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
            headers: sysToken ? { 'Authorization': sysToken } : {}
        });
        if (!res.ok) return;
        const { announcements, lastUpdate } = await res.json();
        
        cachedAnnouncements = announcements || [];
        
        // Task 6.6: 记录本次加载的版本号
        if (lastUpdate) {
            localStorage.setItem('nav_announcements_version', lastUpdate);
        }

        refreshNoticeBadge();

        if (!announcements || announcements.length === 0) return;

        if (!sysToken) {
            // 游客状态：只展示最新的置顶重要公告（如果没有置顶的，则展示最新一条重要公告），且无法去掉 (Task NT.3)
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

// Task 33.3: 封装核心联动函数
const viewNoticeDetail = (id) => {
    const banner = document.querySelector('.important-banner');
    if (banner && sysToken) { // 仅登录状态可移除横幅 (Task NT.3)
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

const showToast = (m, c = "#27ae60") => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = m; t.style.background = c; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
};

const showLoader = (t) => {
    const el = document.getElementById('global-loading-text');
    if (el) el.innerText = t;
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
};

const hideLoader = () => {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'none';
};

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
    
    // 触发防抖同步 (Task 2.5.4)
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncClicksToCloud, 5000); // 停止操作 5 秒后上报
};

// 云端同步点击数据 (Task 2.5.4 - 增强版)
const syncClicksToCloud = async () => {
    if (!sysToken || isAdmin) return; 
    
    const clicks = localStorage.getItem('nav_clicks_history');
    if (!clicks) return;

    const payload = { ...appData, clicks_history: JSON.parse(clicks) };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
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
            syncRetryCount = 0;
        } else {
            throw new Error('Sync failed');
        }
    } catch (e) {
        console.warn('[Sync] Background sync failed:', e.message);
    }
};

// 认证失效统一处理
const handleAuthError = () => {
    console.warn('[Auth] Session expired or invalid');
    localStorage.removeItem('nav_token');
    sysToken = '';
    isAdmin = false;
    showToast("会话已过期，请重新登录", "#e67e22");
    openLoginModal();
    init(true); // 回退到游客视图
};

// Task 7.2: 统一登录弹窗调用逻辑
const openLoginModal = () => {
    lastFocusedElement = document.activeElement; // Task 37.2
    const overlay = document.getElementById('auth-overlay');
    const tabLogin = document.getElementById('tab-login');
    const editModal = document.getElementById('edit-modal');
    
    if (editModal) editModal.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';
    // 强制切换到登录 Tab
    if (tabLogin) tabLogin.click();

    // Task 37.2: 自动聚焦
    setTimeout(() => {
        document.getElementById('auth-username')?.focus();
    }, 100);
};

const updateStyles = () => {
    // 1. 处理密度 (Task 4.2)
    const density = appData.settings?.density || 'standard';
    document.body.classList.remove('density-compact', 'density-standard', 'density-comfortable');
    document.body.classList.add(`density-${density}`);

    // 2. 处理侧边栏风格 - 锁定经典毛玻璃 (Task 9.2)
    document.body.classList.remove('sidebar-style-colorful');
    document.body.classList.add('sidebar-style-classic');

    // 3. 处理视图模态 (Task 24.2: 逻辑解耦与优先级判定)
    const isZen = appData.settings?.zenMode === true && !isPageManagementMode;
    // 优先级判定：禅意模式强制开启隔离 (Primary) > 常规模式的用户设置 (Secondary)
    const isEffectivelyIsolated = isZen || appData.settings?.isolatedView === true; 
    
    document.body.classList.toggle('view-isolated', isEffectivelyIsolated);
    document.body.classList.toggle('zen-active', isZen);

    // 4. 处理卡片宽度 (兼容旧配置)
    const w = appData.settings?.cardWidth || (density === 'compact' ? 70 : (density === 'comfortable' ? 110 : 85));
    document.documentElement.style.setProperty('--card-w', w + 'px');
    document.documentElement.style.setProperty('--card-h', w + 'px');

    // 5. 处理禅意静默态逻辑 (Task 4.6.1) - 存在打开的弹窗时，强制禁用静默态以保留背景和操作面板 (Task NT.4)
    const isModalOpen = (document.getElementById('edit-modal')?.style.display === 'flex') || 
                         (document.getElementById('monaco-modal')?.style.display === 'block') ||
                         (document.getElementById('auth-overlay')?.style.display === 'block');
                         
    if (isZen && !isZenTempExpanded && !isModalOpen) {
        document.body.classList.add('zen-silent');
    } else {
        document.body.classList.remove('zen-silent');
    }

    // Task 6.13: 容错调用公告刷新，确保不阻塞主样式更新
    try {
        if (typeof refreshNoticeBadge === 'function') refreshNoticeBadge();
    } catch (e) { console.warn('[Notice] UI sync failed'); }

    // Task 12.1 & 12.3 & 16.2 & 18.3 & 19.2: 背景阶梯式对齐与类型标记
    const bg = appData.settings?.bgUrl;
    if (bg && bg.trim() !== '') {
        console.log('[Style] Applying user custom background:', bg);
        document.body.dataset.bgType = 'custom';
        if (bg === 'local_upload') {
            // 🚀 读取本地缓存的高清 Base64 格式壁纸 (Task UI.25)
            const localBg = localStorage.getItem('nav_local_bg_image');
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

    // 处理背景遮罩 (Task 12.3)
    document.body.classList.toggle('no-bg-mask', appData.settings?.hideBgMask === true);

    // Task 6.3: 同步响应式侧边栏状态
    if (window.autoAdjustSidebar) window.autoAdjustSidebar();
};

// Task 12.1 & 16.3 & 20.3: Bing 壁纸获取与缓存优化 (先用旧图，异步更同步)
const getBingWallpaper = async () => {
    const cache = localStorage.getItem('nav_bing_cache');
    const now = Date.now();
    let oldUrl = null;
    
    if (cache) {
        try {
            const parsed = JSON.parse(cache);
            // Task 18.2: 增加安全性校验，如果缓存的路径不是绝对路径（http开头），则视为无效缓存
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
            // Task 21.3: 增加随机参数防止浏览器缓存 304 导致的数据不更新
            const res = await fetch(`/api/bing?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            // Task 21.3: 校验响应类型，防止拿到 HTML 错误页
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

// Task 4.2: 视觉实验室控制
const openVisualLab = () => {
    lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6: 互斥显示 (使用静默模式刷新，不触发云端同步)
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    modal.dataset.modalType = 'visual-lab'; // 🚀 标记为个性化设置 (Task UI.25)
    title.innerHTML = `视觉实验室 ${isDataDirty ? '<span style="font-size:10px; background:#e67e22; color:#fff; padding:2px 6px; border-radius:10px; margin-left:10px; vertical-align:middle; font-weight:normal;">本地预览中</span>' : ''}`;
    const isZen = appData.settings?.zenMode === true;
    body.innerHTML = `
        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-keyboard-line"></i> 布局密度</span>
            <div class="visual-btn-group">
                <button class="tab-btn ${appData.settings?.density === 'compact' ? 'active' : ''}" onclick="setVisualSetting('density', 'compact')">紧凑模式</button>
                <button class="tab-btn ${(!appData.settings?.density || appData.settings?.density === 'standard') ? 'active' : ''}" onclick="setVisualSetting('density', 'standard')">标准平衡</button>
                <button class="tab-btn ${appData.settings?.density === 'comfortable' ? 'active' : ''}" onclick="setVisualSetting('density', 'comfortable')">极致透气</button>
            </div>
        </div>
        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-image-line"></i> 自定义背景</span>
            <div style="display:flex; gap:8px; width:100%; align-items:center; margin-bottom: 8px;">
                <input type="text" id="bg-url-input" placeholder="输入网络图片 URL (留空显示 Bing 壁纸)" 
                       value="${appData.settings?.bgUrl === 'local_upload' ? '本地上传图片' : (appData.settings?.bgUrl || '')}" 
                       onchange="setVisualSetting('bgUrl', this.value)"
                       style="flex:1; height:38px; font-size:12px; box-sizing:border-box;"
                       ${appData.settings?.bgUrl === 'local_upload' ? 'disabled' : ''}>
                <button class="icon-btn-action" 
                        onclick="setVisualSetting('hideBgMask', !appData.settings?.hideBgMask)"
                        title="开启/关闭背景模糊" 
                        style="width:38px; height:38px; flex-shrink:0; ${!appData.settings?.hideBgMask ? 'background: var(--primary); border-color: var(--primary); color: #fff;' : ''}">
                    <i class="ri-contrast-drop-2-line"></i>
                </button>
            </div>
            <div style="display:flex; gap:8px; width:100%;">
                <button class="tab-btn" onclick="triggerBgUpload()" style="flex:1; font-size:11px; padding: 6px 12px;"><i class="ri-upload-cloud-2-line"></i> 上传本地壁纸</button>
                ${appData.settings?.bgUrl === 'local_upload' ? `
                    <button class="tab-btn" onclick="clearBgUpload()" style="flex:1; font-size:11px; padding: 6px 12px; background: rgba(231,76,60,0.15); border-color: rgba(231,76,60,0.3); color: #e74c3c;"><i class="ri-delete-bin-line"></i> 清除本地壁纸</button>
                ` : ''}
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 6px; line-height: 1.4;">
                提示: 支持外链网络图片，或直接上传本地壁纸（建议 3MB 内以保障性能。图片纯本地缓存，零服务器开销，强制刷新不丢失）。
            </p>
        </div>
        <div class="visual-option-group">
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <!-- 1. 空间与核心模态 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-focus-3-line"></i> 空间模态</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${!appData.settings?.zenMode ? 'active' : ''}" onclick="toggleZenMode(false)">
                            ${!appData.settings?.zenMode ? '●' : '○'} 常规模式
                        </button>
                        <button class="seg-btn ${appData.settings?.zenMode ? 'active' : ''}" onclick="toggleZenMode(true)">
                            ${appData.settings?.zenMode ? '●' : '○'} 禅意模式
                        </button>
                    </div>
                </div>
                
                <!-- 2. 单视图隔离 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px; ${isZen ? 'opacity: 0.6;' : ''}">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-window-line"></i> 视图展示</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0; ${isZen ? 'pointer-events: none;' : ''}">
                        <button class="seg-btn ${!appData.settings?.isolatedView ? 'active' : ''}" onclick="setVisualSetting('isolatedView', false)">
                            ${!appData.settings?.isolatedView ? '●' : '○'} 长页纵览
                        </button>
                        <button class="seg-btn ${appData.settings?.isolatedView ? 'active' : ''}" onclick="setVisualSetting('isolatedView', true)">
                            ${appData.settings?.isolatedView ? '●' : '○'} 单视图隔离
                        </button>
                    </div>
                </div>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px;">说明: 禅意模式专注内容；单视图隔离则精简分类展示</p>
            ${isZen ? '<p style="font-size: 11px; color: #e67e22; margin-top: 4px;"><i class="ri-information-line"></i> 禅意模式已开启，强制锁定单视图隔离状态</p>' : ''}
        </div>
        <div class="visual-option-group">
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <!-- 3. 跳转机制 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-external-link-line"></i> 跳转机制</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${appData.settings?.link_target === '_self' ? 'active' : ''}" onclick="setVisualSetting('link_target', '_self')">
                            ${appData.settings?.link_target === '_self' ? '●' : '○'} 直接跳转
                        </button>
                        <button class="seg-btn ${(!appData.settings?.link_target || appData.settings?.link_target === '_blank') ? 'active' : ''}" onclick="setVisualSetting('link_target', '_blank')">
                            ${(!appData.settings?.link_target || appData.settings?.link_target === '_blank') ? '●' : '○'} 新窗口打开
                        </button>
                    </div>
                </div>

                <!-- 4. 常去网站 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-star-line"></i> 常去网站</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${appData.settings?.showFrequent === false ? 'active' : ''}" onclick="setVisualSetting('showFrequent', false)">
                            ${appData.settings?.showFrequent === false ? '●' : '○'} 隐藏常去
                        </button>
                        <button class="seg-btn ${appData.settings?.showFrequent !== false ? 'active' : ''}" onclick="setVisualSetting('showFrequent', true)">
                            ${appData.settings?.showFrequent !== false ? '●' : '○'} 显示常去
                        </button>
                    </div>
                </div>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px;">说明: 控制新标签页跳转机制，以及常去网站磁贴显示</p>
        </div>
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = isDataDirty ? "应用并关闭" : "完成设置";
    confirmBtn.onclick = () => {
        closeAllModals();
    };

    // Task 37.2: 自动聚焦第一个选项
    setTimeout(() => {
        modal.querySelector('.seg-btn')?.focus();
    }, 50);
};

window.setVisualSetting = (key, value) => {
    if (!appData.settings) appData.settings = {};

    // Task 24.3: 禅意模式下的交互拦截与引导
    if (appData.settings.zenMode && key === 'isolatedView') {
        showToast("禅意模式已强制开启隔离视图，退出后可修改常规模态", "#e67e22");
        return;
    }

    appData.settings[key] = value;
    isDataDirty = true; // 标记待同步
    
    // 如果修改了影响 DOM 结构的配置，触发重新渲染 (Task 4.17.2)
    if (['isolatedView', 'showFrequent', 'link_target'].includes(key)) {
        renderNav();
    }

    updateStyles();
    openVisualLab(); // 刷新弹窗状态
};

window.triggerBgUpload = () => {
    let input = document.getElementById('temp-bg-upload');
    if (!input) {
        input = document.createElement('input');
        input.id = 'temp-bg-upload';
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 安全限制：localStorage 上限 5MB，限制图片在 3MB 内是绝对安全的 (Task UI.25)
            if (file.size > 3 * 1024 * 1024) {
                return showToast("上传失败：本地图片大小请限制在 3MB 以内，防止存储溢出", "#e74c3c");
            }
            
            showLoader('正在载入并处理图片...');
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const base64Data = event.target.result;
                    localStorage.setItem('nav_local_bg_image', base64Data);
                    setVisualSetting('bgUrl', 'local_upload');
                    showToast("本地壁纸载入成功 (数据纯本地缓存，不占用服务器空间)");
                    openVisualLab(); // 重新刷新弹窗以呈现“清除”按钮
                } catch (err) {
                    showToast("载入失败，请重试", "#e74c3c");
                } finally {
                    hideLoader();
                }
            };
            reader.readAsDataURL(file);
        };
    }
    input.click();
};

window.clearBgUpload = () => {
    localStorage.removeItem('nav_local_bg_image');
    setVisualSetting('bgUrl', '');
    showToast("本地自定壁纸已清除");
    openVisualLab(); // 重新刷新弹窗
};

const toggleZenMode = (force, isFromShortcut = false) => {
    if (!appData.settings) appData.settings = {};
    const newState = typeof force === 'boolean' ? force : !appData.settings.zenMode;
    appData.settings.zenMode = newState;
    isDataDirty = true; // 标记待同步
    
    // 逻辑流转：进入禅意模式时默认静默，退出时默认展开
    if (newState) {
        isZenTempExpanded = false;
        // 禅意模式下强制关闭侧边栏
        toggleSidebar(false);
    } else {
        isZenTempExpanded = true;
        // 回到标准模式时，根据图钉状态决定是否展开侧边栏
        if (isSidebarPinned) toggleSidebar(true);
    }

    if (isFromShortcut) {
        showToast(newState ? "切换到禅意模式" : "切换到常规模式", newState ? "#2c3e50" : "#3498db");
    }
    
    // 强制清理搜索状态
    const sea = document.getElementById('sea-input');
    if (sea) sea.value = '';
    document.body.classList.remove('is-searching');

    renderNav();
    updateStyles();
    
    // 同步视觉实验室 UI
    if (document.getElementById('edit-modal').style.display === 'flex') openVisualLab();
};

const toggleSkeleton = (s) => {
    const sk = document.getElementById('skeleton-screen');
    const mc = document.getElementById('main-content');
    if (sk) sk.style.display = s ? 'block' : 'none';
    if (mc) mc.style.display = s ? 'none' : 'block';
};

// ==================== 3. 认证逻辑 ====================
/**
 * 统一调度认证/用户中心弹窗 (Task 39.2)
 */
const showAuthModal = () => {
    const overlay = document.getElementById('auth-overlay');
    const formView = document.getElementById('auth-form-view');
    const userView = document.getElementById('auth-user-view');
    
    if (!overlay || !formView || !userView) return;

    if (sysToken) {
        // 已登录：展示用户信息视图
        formView.style.display = 'none';
        userView.style.display = 'block';
        
        // Task 5.3: 优先从全局状态同步最新信息
        const info = currentUser || JSON.parse(localStorage.getItem('nav_current_user') || '{}');
        const nameEl = document.getElementById('auth-current-user-name');
        const roleEl = document.getElementById('auth-user-role-label');
        
        if (nameEl) {
            // Task 7.1: 标准化 ID 格式为 id: xxxx
            const uidStr = info.uid ? ` <small style="font-weight: normal; opacity: 0.6; font-family: monospace;">(id: ${info.uid})</small>` : '';
            nameEl.innerHTML = (info.username || appData.username || '未知用户') + uidStr;
        }
        if (roleEl) {
            const roleKey = info.role || appData.role || 'guest';
            const roles = { 
                'admin': '系统总管理员', 
                'super_user': '高级协管员', 
                'user': '注册会员',
                'guest': '访客' 
            };
            roleEl.innerText = roles[roleKey] || '注册会员';
            
            // 权限颜色映射 (Task 5.3)
            if (roleKey === 'admin') {
                roleEl.style.color = '#f1c40f'; // 金色
                roleEl.style.fontWeight = 'bold';
            } else if (roleKey === 'super_user') {
                roleEl.style.color = '#3498db'; // 蓝色
                roleEl.style.fontWeight = 'bold';
            } else {
                roleEl.style.color = '#888'; // 普通灰色
                roleEl.style.fontWeight = 'normal';
            }
        }
        
        overlay.style.display = 'flex';
        // 自动聚焦退出按钮
        setTimeout(() => document.getElementById('btn-logout-fast')?.focus(), 100);
    } else {
        // 未登录：展示登录表单视图
        userView.style.display = 'none';
        formView.style.display = 'block';
        overlay.style.display = 'flex';
        setTimeout(() => document.getElementById('auth-username')?.focus(), 100);
    }
};

const doLogin = async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    if (!u || !p) return showToast("请填写用户名和密码", "#e67e22");

    await SyncUI.perform('LOGIN', async () => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        
        if (res.status === 429) {
            throw new Error(data.error || "尝试次数过多，请稍后再试");
        }

        if (!res.ok || !data.success) {
            throw new Error(data.error || "登录失败");
        }

        sysToken = 'Bearer ' + data.token;
        localStorage.setItem('nav_token', sysToken);
        
        // Task 5.1: 立即持久化完整的用户信息
        currentUser = { 
            id: data.user.id,
            uid: data.user.uid,
            username: data.user.username, 
            role: data.user.role 
        };
        localStorage.setItem('nav_current_user', JSON.stringify(currentUser));

        document.getElementById('auth-overlay').style.display = 'none';
        // 此处不需要 showToast，SyncUI 会自动显示成功提示
        await init(true);
    });
};

const doRegister = async () => {
    const userEl = document.getElementById('auth-username');
    const passEl = document.getElementById('auth-password');
    const inviteEl = document.getElementById('auth-invite-code');
    const u = userEl.value.trim();
    const p = passEl.value.trim();
    const i = inviteEl?.value.trim() || '';

    if (!u || !p) return showToast("请填写完整信息", "#e67e22");

    await SyncUI.perform('REGISTER', async () => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p, inviteCode: i })
        });
        
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || "注册失败");
        }

        setTimeout(() => {
            const loginTab = document.getElementById('tab-login');
            if (loginTab) loginTab.click();
            passEl.value = ''; // 清空密码框
            if (inviteEl) inviteEl.value = '';
        }, 1000);
    });
};

const doLogout = async () => {
    // Task SYNC.3: 退出登录拦截与强制同步
    if (sysToken && isDataDirty && appData.settings?.autoSyncOnLogout !== false) {
        // Task SYNC.GUARD.2: 实质性修改指纹校验
        const currentFingerprint = getCoreDataFingerprint(appData);
        if (currentFingerprint === lastSyncFingerprint) {
            console.log('[SyncGuard] No substantial changes detected, skipping logout sync.');
            isDataDirty = false; // 既然内容一致，直接重置标记
        } else {
            // Task SYNC.GUARD.1: 冷却时间拦截
            const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
            const cooldownMs = 5 * 60 * 1000;
            const isCooling = (Date.now() - lastSync) < cooldownMs;

            if (isCooling) {
                showToast("本地修改已暂存，因同步太频繁，云端备份已跳过", "#e67e22");
            } else {
                try {
                    await manualSyncCloud();
                    isDataDirty = false;
                } catch (e) {
                    if (!confirm(`云端同步失败：${e.message}\n仍要退出登录吗？(未同步的内容将仅保留在此浏览器中)`)) {
                        return;
                    }
                }
            }
        }
    }

    localStorage.removeItem('nav_token');
    localStorage.removeItem('nav_current_user'); // Task 39.4
    sysToken = '';
    currentUser = null;
    isAdmin = false;
    localStorage.removeItem('nav_app_data');
    await init(true);
    showToast("已退出登录");
};

const doResetConfig = async () => {
    if (!confirm("确定要恢复默认配置吗？这将覆盖您当前的自定义导航内容！")) return;
    
    showLoader('正在恢复默认配置...');
    try {
        if (!sysToken) {
            // Task 20.5.3: 游客态重置逻辑
            const res = await fetch('/api/config');
            if (res.ok) {
                appData = await res.json();
                isDataDirty = false;
                localStorage.setItem('nav_app_data', JSON.stringify(appData));
                renderNav();
                renderTools();
                showToast("配置已恢复默认 (本地)", "#27ae60");
                return;
            }
        }

        const res = await fetch('/api/config', {
            method: 'DELETE',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Reset Error:', res.status, errorText);
            showToast(`重置失败 (状态码: ${res.status})`, "#e74c3c");
            return;
        }

        const data = await res.json();
        if (data.success) {
            showToast("已成功恢复默认配置");
            
            // 彻底清洗内存状态
            activeCatId = '';
            isZenTempExpanded = true; 
            
            // 重新初始化数据并强制渲染
            await init(true);
            
            // 强制延迟滚动，确保 DOM 渲染完成
            setTimeout(() => {
                const target = document.getElementById('grid-container');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 150);
        } else {
            showToast(data.error || "重置失败", "#e74c3c");
        }
    } catch (err) {
        console.error('Fetch Exception:', err);
        showToast("无法连接到服务器，请检查浏览器控制台", "#e74c3c");
    } finally {
        hideLoader();
    }
};

const initAuthUI = () => {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const authOverlay = document.getElementById('auth-overlay');
    let mode = 'login';

    if (!tabLogin || !tabRegister || !btnSubmit) return;

    // Task 8.4: 绑定右上角关闭按钮
    if (btnCloseAuth) {
        btnCloseAuth.onclick = () => closeAllModals();
    }

    // 清理可能存在的旧监听器 (如果是热重载)
    tabLogin.onclick = null;
    tabRegister.onclick = null;
    btnSubmit.onclick = null;

    tabLogin.addEventListener('click', () => {
        console.log('Switch to login mode');
        mode = 'login';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        const tip = document.getElementById('auth-switch-tip');
        const inviteEl = document.getElementById('auth-invite-code');
        if (tip) tip.innerText = '还没有账号？点击上方“注册”开始';
        if (inviteEl) inviteEl.style.display = 'none'; // 登录模式隐藏邀请码
        
        // Task 16.4: 切换模式时清空表单，防止状态污染
        ['auth-username', 'auth-password', 'auth-invite-code'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('auth-username')?.focus();
    });

    tabRegister.addEventListener('click', () => {
        console.log('Switch to register mode');
        mode = 'register';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        const tip = document.getElementById('auth-switch-tip');
        const inviteEl = document.getElementById('auth-invite-code');
        if (tip) tip.innerText = '已有账号？点击上方“登录”返回';
        if (inviteEl) inviteEl.style.display = 'block'; // 注册模式显示邀请码
        
        // Task 16.4: 切换模式时清混表单
        ['auth-username', 'auth-password', 'auth-invite-code'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('auth-username')?.focus();
    });

    btnSubmit.addEventListener('click', async () => {
        console.log('Auth submit trigger:', mode);
        // 视觉反馈：禁用按钮防止重复点击
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = mode === 'login' ? '正在登录...' : '正在注册...';

        try {
            if (mode === 'login') await doLogin();
            else await doRegister();
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = originalText;
        }
    });

    // Task 39.3: 用户中心交互逻辑
    const btnLogoutFast = document.getElementById('btn-logout-fast');
    const btnSwitchAuth = document.getElementById('btn-switch-auth');
    const formView = document.getElementById('auth-form-view');
    const userView = document.getElementById('auth-user-view');

    if (btnLogoutFast) {
        btnLogoutFast.onclick = async () => {
            await doLogout();
            authOverlay.style.display = 'none'; // 退出后关闭
        };
    }

    if (btnSwitchAuth) {
        btnSwitchAuth.onclick = async () => {
            await doLogout(); // 先注销当前用户
            // 切换视图回登录表单而不关闭弹窗
            if (userView) userView.style.display = 'none';
            if (formView) formView.style.display = 'block';
            // 默认切回登录 tab
            tabLogin.click();
            setTimeout(() => document.getElementById('auth-username')?.focus(), 100);
        };
    }

    // 点击遮罩关闭 (Task 1.1 优化)
    authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
            closeAllModals();
        }
    });
    // Task O.3 & O++.1: 统一通过 closeAllModals 处理，由其决定是否静默或同步
    document.getElementById('btn-close-edit').onclick = () => closeAllModals();
    document.getElementById('btn-confirm-edit').onclick = saveItem;
};

// ==================== 4. 数据加载 (缓存优先秒开 + 后台静默异步校验架构) ====================
const init = async (forceRender = false) => {
    // 1. 【秒开阶段】尝试从本地 LocalStorage 立即读取缓存并渲染，实现 0 延时渲染
    let hasLoadedCache = false;
    const cached = localStorage.getItem('nav_app_data');
    if (cached) {
        try {
            appData = JSON.parse(cached);
            hasLoadedCache = true;
            toggleSkeleton(false); // 立即关闭骨架屏
            renderNav();
            renderTools();
            updateStyles();
            if (!appData.settings?.bgUrl) {
                getBingWallpaper(); // 异步触发
            }
            console.log('[Init] Stale-First: Loaded from local cache instantly.');
        } catch (e) {
            console.warn('[Init] Local cache parse failed:', e);
        }
    }

    // 游客态且本地已成功拉起并渲染缓存，直接结束，防止刷新被默认模板覆盖 (Task UI.21)
    if (!sysToken && hasLoadedCache) {
        initAnnouncements();
        return;
    }

    // 2. 【异步后台校验阶段】发起非阻塞网络请求，确保云端最新的修改可以被拉取
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 4000));
    
    try {
        console.log('[Init] Background revalidating config from cloud...');
        const fetchPromise = fetch('/api/config', {
            headers: sysToken ? { 'Authorization': sysToken } : {}
        });
        
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Task 19.2: 解析隔离 - 检查响应头是否为 JSON
        const contentType = res.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            const errorText = await res.text();
            console.error('[Init] Server returned non-JSON response:', errorText);
            throw new Error('Server returned invalid data format');
        }

        // Task 18.3: 处理凭证失效 (401)
        if (res.status === 401) {
            console.warn('[Init] Token stale or database reset, cleaning up...');
            handleAuthError(); // 自动清理失效信息
            // 重新获取数据（此时以访客身份获取默认数据）
            if (!hasLoadedCache) {
                const guestRes = await fetch('/api/config');
                if (guestRes.ok) {
                    appData = await guestRes.json();
                    localStorage.setItem('nav_app_data', JSON.stringify(appData));
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
            
            // 3. 【差异指纹比对】仅当云端指纹与本地指纹不一致时，执行后台静默渲染
            const localFingerprint = getCoreDataFingerprint(appData || {});
            const cloudFingerprint = getCoreDataFingerprint(cloudData || {});
            
            if (localFingerprint !== cloudFingerprint || !hasLoadedCache) {
                console.log('[Init] Cloud fingerprint changed, updating locally...');
                
                // Task 19.3: 渲染兜底
                if (!cloudData.categories || !cloudData.items) {
                    appData = { ...MINIMAL_SAFE_DATA, ...cloudData };
                    if (!appData.categories || appData.categories.length === 0) appData.categories = MINIMAL_SAFE_DATA.categories;
                    if (!appData.items) appData.items = [];
                } else {
                    appData = cloudData;
                }
                
                isAdmin = appData.isAdmin;
                localStorage.setItem('nav_app_data', JSON.stringify(appData));
                
                // 执行后台无感重渲染
                renderNav();
                renderTools();
                updateStyles();
                lastSyncFingerprint = cloudFingerprint;
            } else {
                console.log('[Init] Local and Cloud data match. Skipped background re-render.');
                lastSyncFingerprint = localFingerprint;
            }
            
            // 同步最新的用户信息 (包含 UID)
            if (cloudData.username && cloudData.role) {
                currentUser = { 
                    id: cloudData.user || cloudData.id, 
                    uid: cloudData.uid,
                    username: cloudData.username, 
                    role: cloudData.role 
                };
                localStorage.setItem('nav_current_user', JSON.stringify(currentUser));
                
                // Task 5.4: 如果当前弹窗是打开的，强制同步更新弹窗内的信息
                const userView = document.getElementById('auth-user-view');
                if (userView && userView.style.display === 'block') {
                    showAuthModal(); 
                }
            }
            
            // 恢复云端点击数据 (Task 2.5.4)
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
            appData = { ...MINIMAL_SAFE_DATA };
            toggleSkeleton(false);
            renderNav();
            renderTools();
            updateStyles();
            showToast("网络连接超时，已启用预置安全数据", "#e67e22");
        }
    } finally {
        // Task 18.4: 无论发生什么，强制关闭骨架屏并渲染
        toggleSkeleton(false);

        try {
            renderNav();
            renderTools();
            
            // Task 20.2: 强制背景校验闭环
            if (!appData.settings?.bgUrl) {
                getBingWallpaper(); // 异步触发
            }

            updateStyles();

            // Task 38.3: 同步云端搜索引擎设置
            if (appData.settings?.searchEngine) {
                if (typeof window.setSearchEngine === 'function') {
                    window.setSearchEngine(appData.settings.searchEngine, true);
                }
            }

            // Task 6.3: 在工具栏渲染完成后再初始化公告
            initAnnouncements();
        } catch (renderError) {
            console.error('[Init] Render crashed:', renderError);
            showToast("渲染失败，请刷新重试", "#e74c3c");
        }
    }
};

// ==================== 5. 渲染逻辑 ====================
const buildCardHtml = (i) => {
    const target = appData.settings?.link_target || '_blank';
    const rel = target === '_blank' ? 'rel="noopener noreferrer"' : '';
    const icon = i.icon && i.icon.startsWith('http') 
        ? `<img src="${i.icon}" loading="lazy" data-retry-index="0" onerror="utils.handleIconError(this, '${i.url}')">` 
        : `<span class="emoji-icon">${i.icon || '🔗'}</span>`;
    return `<a href="${i.url}" target="${target}" ${rel}><div class="icon-wrapper">${icon}</div><h3>${i.title}</h3></a>`;
};

const renderNav = () => {
    if (isRendering) return;
    isRendering = true;

    try {
        const sidebarNav = document.getElementById('sidebar-nav');
        const container = document.getElementById('grid-container');
        if (!sidebarNav || !container) {
            isRendering = false;
            return;
        }

        // 基础数据防御与空态处理
        if (!appData || !appData.categories || appData.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state-tip" style="text-align:center; padding: 100px 20px; color: var(--text-dim);">
                    <i class="ri-wind-line" style="font-size: 48px; opacity: 0.3;"></i>
                    <p style="margin-top: 15px;">暂无内容，请登录后开始添加</p>
                    ${!sysToken ? '<button class="tab-btn" style="margin-top:20px;" onclick="showAuthModal()">立即登录</button>' : ''}
                </div>
            `;
            isRendering = false;
            return;
        }

        const clickData = getFrequentItemsData();
        const freqIds = Object.keys(clickData).filter(id => clickData[id] >= 10);

        sidebarNav.innerHTML = '';
        container.innerHTML = '';
        
        // 清空并隐藏禅意视界容器 (Task 5.6)
        const zenHorizon = document.getElementById('zen-horizon');
        const zenMenu = document.getElementById('zen-nav-menu');
        const zenFreq = document.getElementById('zen-frequent-sites');
        if (zenMenu) zenMenu.innerHTML = '';
        if (zenFreq) zenFreq.innerHTML = '';

        let cats = isAdmin ? [...appData.categories] : appData.categories.filter(c => !c.hidden);
        if (freqIds.length > 0 && appData.settings?.showFrequent !== false) {
            cats.unshift({ id: 'VIRTUAL_FREQ', name: '常去网站', icon: '⭐' });
        }

        // 导航视界定义：自动校正过期的或无效 of activeCatId (Task 2.1 深度自愈)
        const isValidActiveCat = cats.some(c => c.id === activeCatId);
        if (cats.length > 0 && (!activeCatId || !isValidActiveCat)) {
            activeCatId = cats[0].id;
        }

        // 渲染禅意模式下的横向菜单 (Task 5.7)
        const isZen = appData.settings?.zenMode === true;
        if (isZen && zenMenu) {
            // 如果开启了常去网站，且有数据，在菜单上方渲染一个精简的常去图标栏 (Task 5.6)
            if (appData.settings?.showFrequent !== false && freqIds.length > 0 && zenFreq) {
                const freqItems = appData.items.filter(i => freqIds.includes(i.id)).slice(0, 10);
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
                        const target = appData.settings?.link_target || '_blank';
                        window.open(item.url, target);
                    };
                    freqList.appendChild(icon);
                });
            }

            cats.forEach((cat, idx) => {
                const menuItem = document.createElement('div');
                menuItem.className = `zen-menu-item ${activeCatId === cat.id ? 'active' : ''}`;
                menuItem.tabIndex = 0; // Task 30.2: 启用键盘焦点
                menuItem.style.animationDelay = `${(idx * 0.05) + 0.2}s`; // T8: Stagger
                menuItem.innerHTML = `<span class="menu-icon">${cat.icon}</span><span class="menu-label">${cat.name}</span>`;
                
                // 处理键盘激活
                menuItem.onkeydown = (e) => {
                    if (e.key === 'Enter') menuItem.click();
                };
                menuItem.onclick = () => {
                    if (activeCatId === cat.id) return;
                    activeCatId = cat.id;
                    
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
        }

        cats.forEach(cat => {
            const navItem = document.createElement('div');
            navItem.className = `sidebar-nav-item ${activeCatId === cat.id ? 'active' : ''} ${cat.hidden ? 'is-hidden-cat' : ''}`;
            navItem.dataset.id = cat.id; // Task CAT.1: 增加 ID 绑定
            navItem.tabIndex = 0; // Task 30.2: 启用键盘焦点
            
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                navItem.classList.add('sortable-cat'); // Task CAT.1: 标记可排序
            }

            // 计算书签数量 (Task 4.5.2)
            const itemCount = appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
            const countHtml = (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') 
                ? `<span class="nav-count">${itemCount}</span>` 
                : '';

            // 基础内容 (Task CAT.1: 增加拖拽手柄)
            const dragHandleHtml = (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') 
                ? `<span class="drag-handle" style="margin-right: 6px; cursor: move; opacity: 0.5;"><i class="ri-drag-move-2-line"></i></span>`
                : '';

            let navHtml = `${dragHandleHtml}<span class="nav-icon" title="">${cat.icon}</span><span class="nav-label">${cat.name}${countHtml}</span>`;
            
            // Task 4.3: 增加管理快捷按钮
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                navHtml += `
                    <div class="nav-actions">
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
            
            // Task 33.2: 补全键盘激活逻辑
            navItem.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navItem.click();
                }
            };

            navItem.onclick = () => {
                if (activeCatId === cat.id) return;
                
                activeCatId = cat.id;
                // Task 11.2: 确定是否需要切换隔离视图
                const isIsolated = (appData.settings?.zenMode || appData.settings?.isolatedView) && !isPageManagementMode;
                
                if (isIsolated) { 
                    isZenTempExpanded = true; 
                    document.body.classList.remove('zen-silent'); // 点击切换时必然唤醒
                    
                    // 增加切换时的淡出效果 (Task 5.3)
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
            sidebarNav.appendChild(navItem);

            // 视图隔离核心逻辑 (Task 11.2 深度对齐)
            // 1. 禅意模式开启时：强制执行单一视图原则，无视 isolatedView 设置
            // 2. 常规模式开启时：遵循用户的手动 isolatedView 设置 (默认为 false/长廊)
            // 3. 页面管理模式：强制全分类展示以支持拖拽
            const isIsolatedView = !isPageManagementMode && (appData.settings?.zenMode || appData.settings?.isolatedView);
            
            if (isIsolatedView && cat.id !== activeCatId) return;

            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = 'section-' + cat.id;
            section.innerHTML = `<div class="category-section-title">${cat.icon} ${cat.name}</div>`;

            const grid = document.createElement('div');
            grid.className = 'nav-grid';
            
            // 健壮的过滤逻辑：同时支持 catId 和 cat_id (容错设计)
            const items = (cat.id === 'VIRTUAL_FREQ') 
                ? appData.items.filter(i => freqIds.includes(i.id)) 
                : appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id) && (isPageManagementMode || isAdmin || !i.hidden));
                
            items.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = `card ${item.hidden ? 'hidden-item' : ''}`;
                // 为磁贴增加 Tab 索引与唯一 ID，方便键盘流转 (Task 2.5.3)
                card.setAttribute('tabindex', '0');
                card.setAttribute('data-id', item.id);
                // 注入描述作为 Tooltip (Task 4.9.2)
                if (item.desc) {
                    card.setAttribute('data-tooltip', item.desc);
                    card.setAttribute('title', item.desc); // 浏览器原生兼容
                }
                card.style.animationDelay = `${idx * 0.03}s`;
                
                let html = buildCardHtml(item);
                
                // 编辑入口 (Task 3.2: 页面管理模式下对所有人开放，常规模式下仅限管理员)
                if (isPageManagementMode || isAdmin) {
                    html += `<div class="card-admin-btns">
                        <button class="card-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="编辑"><i class="ri-edit-line"></i></button>
                    </div>`;
                }
                
                card.innerHTML = html;
                
                // 处理点击逻辑 (Task 25.2: 增强点击响应稳定性)
                card.onclick = (e) => {
                    if (isPageManagementMode) {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = card.getAttribute('data-id');
                        if (selectedIds.has(id)) selectedIds.delete(id);
                        else selectedIds.add(id);
                        card.classList.toggle('selected', selectedIds.has(id));
                        updateBatchBar();
                    } else {
                        // 如果点击的是链接或其子元素，由 <a> 标签原生处理跳转
                        // JS 仅负责记录点击频率
                        recordClick(item.id);
                    }
                };
                
                // 键盘激活支持
                card.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        if (isPageManagementMode) {
                            card.click();
                        } else {
                            recordClick(item.id);
                            const target = appData.settings?.link_target || '_blank';
                            window.open(item.url, target);
                        }
                    }
                };
                
                grid.appendChild(card);
            });

            // Task 4.4: 磁贴末尾的新增入口 (仅管理模式)
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                const catItemCount = items.length;
                const quota = appData.quota || { maxCategories: 8, maxItemsPerCategory: 15 };
                const isCatFull = catItemCount >= quota.maxItemsPerCategory;

                addCard.className = `card add-new-card ${isCatFull ? 'disabled' : ''}`;
                addCard.tabIndex = 0; // Task 30.2: 启用键盘焦点
                addCard.innerHTML = `
                    <div class="icon-wrapper"><i class="ri-add-line"></i></div>
                    <h3>${isCatFull ? '已满' : '新增书签'}</h3>
                    <p style="font-size: 10px; opacity: 0.6; margin-top: 4px;">(${catItemCount}/${quota.maxItemsPerCategory})</p>
                `;
                addCard.onclick = () => {
                    if (isCatFull) return showToast(`该分类已达到 ${quota.maxItemsPerCategory} 个书签上限`, "#e74c3c");
                    activeCatId = cat.id;
                    openEditModal('');
                };
                
                // 键盘支持
                addCard.onkeydown = (e) => {
                    if (e.key === 'Enter') addCard.click();
                };
                grid.appendChild(addCard);
            }

            section.appendChild(grid);
            container.appendChild(section);
        });

        // Task 4.4: 侧边栏新增分类入口 (仅管理模式)
        if (isPageManagementMode) {
            const addCatBtn = document.createElement('div');
            const catCount = appData.categories.length;
            const quota = appData.quota || { maxCategories: 8, maxItemsPerCategory: 15 };
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
                    const name = prompt("请输入新分类名称:");
                    if (name) {
                        const newCat = { id: 'cat_' + Date.now(), name, icon: '📂', hidden: false };
                        appData.categories.push(newCat);
                        isDataDirty = true;
                        showToast(`分类 ${name} 已本地创建`, "#3498db");
                        renderNav();
                    }
                };
                sidebarNav.appendChild(addCatBtn);
            }
        }

        // 统一禅意模式状态管理 (Task 4.6.1)
        isActuallyZen = appData.settings?.zenMode && !isZenTempExpanded;
        if (isActuallyZen && !document.body.classList.contains('zen-silent-woken')) {
            document.body.classList.add('zen-silent');
        } else {
            document.body.classList.remove('zen-silent');
        }
        
        const zenBtn = document.getElementById('zen-expand-btn');
        if (zenBtn) zenBtn.style.display = (appData.settings?.zenMode && !isZenTempExpanded) ? 'flex' : 'none';

        // Zen Mode 下强制侧边栏行为 (Task 2.1)
        if (appData.settings?.zenMode) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('open')) {
                document.getElementById('sidebar-overlay')?.classList.remove('visible');
            }
        }

        // Task 1.1: UX Bridge - 游客引导
        if (!sysToken && appData.settings?.zenMode && !isZenTempExpanded) {
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
        isRendering = false;
    }
};

const renderTools = () => {
    const area = document.getElementById('sidebar-admin-area');
    const userArea = document.getElementById('sidebar-user-section');
    const adminBanner = document.getElementById('admin-active-banner');
    if (!area || !userArea) return;

    const themeIconMap = { 'auto': 'ri-computer-line', 'light': 'ri-sun-line', 'dark': 'ri-moon-line' };
    const themeNameMap = { 'auto': '跟随系统', 'light': '明亮模式', 'dark': '暗黑模式' };
    
    // Task 28.2: 渲染移动端快捷入口 (如果尚未存在)
    let mobileFab = document.getElementById('mobile-fab-visual');
    if (!mobileFab) {
        mobileFab = document.createElement('div');
        mobileFab.id = 'mobile-fab-visual';
        mobileFab.className = 'mobile-fab-visual';
        mobileFab.innerHTML = '<i class="ri-settings-4-line"></i>';
        mobileFab.title = '视觉实验室';
        mobileFab.onclick = (e) => {
            e.stopPropagation();
            openVisualLab();
        };
        document.body.appendChild(mobileFab);
    }
    
    // 1. 渲染用户信息区域
    const info = sysToken 
        ? (currentUser || JSON.parse(localStorage.getItem('nav_current_user') || '{}'))
        : { username: '访客模式', role: 'guest', uid: null };

    if (!sysToken) {
        // 游客态显示登录引导
        userArea.innerHTML = `
            <div class="sidebar-user-card guest" onclick="showAuthModal()">
                <div class="sidebar-user-info">
                    <i class="ri-user-received-2-line"></i>
                    <div class="user-meta-box">
                        <span class="user-name">访客模式</span>
                        <span class="user-uid">点击登录同步云端</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        const userDisplayName = info.username || appData.username || '已登录用户';
        const displayUid = info.uid 
            ? `<span class="user-uid" title="完整内部 ID: ${info.id}">id: ${info.uid}</span>` 
            : `<span class="user-uid">id: ${info.id?.substring(0, 8) || '---'}</span>`;
        const roleBadge = isAdmin ? '<span class="admin-badge">ADMIN</span>' : (info.role === 'super_user' ? '<span class="admin-badge" style="background:#3498db">SUP</span>' : '');
        
        userArea.innerHTML = `
            <div class="sidebar-user-card">
                <div class="sidebar-user-info">
                    <i class="ri-user-smile-line"></i>
                    <div class="user-meta-box">
                        <span class="user-name">${userDisplayName} ${roleBadge}</span>
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
    
    // 配额状态感知 (Task 20.4)
    const quota = appData.quota || { maxCategories: 8, maxItemsPerCategory: 15 };
    const isAllFull = appData.categories.length >= quota.maxCategories;

    // 管理员模式视觉高亮切换 (Task 9.2 增强)
    if (isPageManagementMode) {
        if (adminBanner) {
            adminBanner.style.display = 'flex';
            const isGuest = !sysToken;
            
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

    // 角色能力判定 (Task 17.2)
    const role = info.role;
    const isLogged = !!sysToken;
    const canManageUsers = (role === 'admin' || role === 'super_user');
    const canConfigSystem = (role === 'admin');

    // 统一按钮模板
    const toolbarButtons = [
        {
            id: 'btn-page-manage',
            icon: 'ri-layout-masonry-line',
            label: '页面管理',
            tooltip: '页面管理',
            active: isPageManagementMode,
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
            show: isLogged // Task 17.2: 仅登录用户可见
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
            ${isPageManagementMode ? `
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
};

// Task 10.1: 唤起云端备份中心 (风格对齐视觉实验室)
window.openSyncCenter = () => {
    if (!sysToken) return showToast("请先登录再使用云端同步功能", "#e67e22");
    
    lastFocusedElement = document.activeElement; // Task 37.2
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerHTML = `<i class="ri-cloud-line"></i> 云端同步中心`;
    
    // 获取同步状态
    const lastSync = localStorage.getItem('nav_last_cloud_sync');
    const timeStr = lastSync ? formatSystemDate(parseInt(lastSync), true) : '从未备份';
    const isOverdue = lastSync && (Date.now() - parseInt(lastSync) > (appData.settings?.syncInterval || 7) * 24 * 3600 * 1000);

    // 计算冷却时间 (Task節流.3)
    const cooldownMs = 5 * 60 * 1000;
    const remaining = lastSync ? Math.max(0, cooldownMs - (Date.now() - parseInt(lastSync))) : 0;
    const isCooling = remaining > 0;
    const coolMin = Math.ceil(remaining / 60000);

    // Task SYNC.REFACTOR.3: 手动模式下的脏数据提醒
    const showDirtyHint = isDataDirty && appData.settings?.autoSyncOnLogout === false && !isCooling;

    body.innerHTML = `
        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-history-line"></i> 备份状态反馈</span>
            <div style="background: var(--glass-card); padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); position: relative;">
                <p style="font-size: 13px; margin: 0; display:flex; justify-content: space-between; align-items: center;">
                    <span>上次同步时间：</span>
                    <b style="color: ${lastSync ? 'var(--primary-color)' : '#e74c3c'}">${timeStr}</b>
                </p>
                ${isOverdue ? `<p style="font-size: 11px; color: #e67e22; margin-top: 8px;"><i class="ri-error-warning-line"></i> 提示：您的云端备份已超过 ${appData.settings?.syncInterval || 7} 天未更新，建议立即同步。</p>` : ''}
                ${isDataDirty ? `<p style="font-size: 11px; color: var(--primary-color); margin-top: 8px;"><i class="ri-edit-line"></i> 检测到本地有未同步的修改。</p>` : ''}
            </div>
        </div>
        
        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-upload-cloud-2-line"></i> 立即执行同步</span>
            <div class="visual-btn-group">
                <button class="tab-btn ${isCooling ? 'hidden-item' : 'active'} ${showDirtyHint ? 'pulse-primary' : ''}" 
                        style="flex:1; justify-content: center; height:42px; position: relative;" 
                        onclick="${isCooling ? '' : 'manualSyncCloud(true)'}">
                    <i class="ri-cloud-upload-line"></i> ${isCooling ? `冷却中 (${coolMin}min)` : '上传到云端'}
                    ${showDirtyHint ? '<span class="status-dot-active" style="position:absolute; top:8px; right:12px;"></span>' : ''}
                </button>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px;">说明：此操作将使用当前本地配置覆盖云端数据。${isCooling ? '<span style="color:#e67e22;">为保护服务器资源，手动备份有 5 分钟冷却时间。</span>' : ''}</p>
        </div>

        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-timer-flash-line"></i> 云端备份模式</span>
            <div class="segmented-control" style="width: 100%; box-sizing: border-box; display: flex;">
                <button class="seg-btn ${!appData.settings?.syncInterval ? 'active' : ''}" onclick="setSyncMode(0)" style="padding: 6px 4px; font-size: 12px;">
                    ${!appData.settings?.syncInterval ? '●' : '○'} 手动模式
                </button>
                <button class="seg-btn ${appData.settings?.syncInterval === 3 ? 'active' : ''}" onclick="setSyncMode(3)" style="padding: 6px 4px; font-size: 12px;">
                    ${appData.settings?.syncInterval === 3 ? '●' : '○'} 每 3 天
                </button>
                <button class="seg-btn ${appData.settings?.syncInterval === 7 ? 'active' : ''}" onclick="setSyncMode(7)" style="padding: 6px 4px; font-size: 12px;">
                    ${appData.settings?.syncInterval === 7 ? '●' : '○'} 每 7 天
                </button>
                <button class="seg-btn ${appData.settings?.syncInterval === 30 ? 'active' : ''}" onclick="setSyncMode(30)" style="padding: 6px 4px; font-size: 12px;">
                    ${appData.settings?.syncInterval === 30 ? '●' : '○'} 每 30 天
                </button>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px;">
                ${appData.settings?.autoSyncOnLogout !== false 
                    ? '<i class="ri-checkbox-circle-line" style="color:var(--success-color)"></i> 当前已开启退出登录时自动增量备份。' 
                    : '<i class="ri-information-line"></i> 当前为全手动维护，建议定期备份以防数据丢失。'}
            </p>
        </div>
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = "完成并关闭";
    confirmBtn.onclick = () => closeAllModals();
};

// Task 9.3: 手动同步云端逻辑
window.manualSyncCloud = async (refreshUI = false) => {
    if (!sysToken) return showToast("请先登录再进行备份", "#e67e22");

    // Task節流.2: 仅在手动备份 (refreshUI === true) 时启用冷却逻辑 (5 分钟)
    if (refreshUI) {
        const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
        const cooldownMs = 5 * 60 * 1000;
        const remaining = cooldownMs - (Date.now() - lastSync);
        if (remaining > 0) {
            const min = Math.ceil(remaining / 60000);
            return showToast(`操作频繁：手动备份冷却中，请 ${min} 分钟后再试`, "#e67e22");
        }
    }

    // 1. 数据合法性校验 (Data Validation)
    if (!appData || !Array.isArray(appData.categories) || !Array.isArray(appData.items)) {
        return showToast("本地数据结构异常，取消上传以保护云端数据", "#e74c3c");
    }

    if (appData.categories.length === 0 && !confirm("检测到本地没有分类数据，确定要清空云端备份吗？")) {
        return;
    }

    await SyncUI.perform('BACKUP_MANUAL', async () => {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(appData)
        });

        if (res.status === 401) {
            hideLoader();
            return handleAuthError();
        }
        
        const data = await res.json();

        if (res.ok && data.success) {
            // 3. 成功反馈与状态记录
            isDataDirty = false;
            const now = Date.now();
            localStorage.setItem('nav_last_cloud_sync', now.toString());
            localStorage.setItem('nav_app_data', JSON.stringify(appData));
            
            // Task SYNC.GUARD.2 & 3: 更新同步指纹并重置状态
            lastSyncFingerprint = getCoreDataFingerprint(appData);
            
            // 使用同步后回调逻辑，由 SyncUI 自动弹出成功提示
            if (refreshUI && typeof openSyncCenter === 'function') openSyncCenter();
        } else {
            throw new Error(data.error || "服务器拒绝保存");
        }
    });
};

// Task SYNC.REFACTOR.1: 逻辑层整合 - 统一同步模式管理
window.setSyncMode = (days) => {
    if (!appData.settings) appData.settings = {};
    appData.settings.syncInterval = days;
    // 逻辑合并：如果天数 > 0，自动视为开启退出同步；如果为 0（手动模式），则关闭
    appData.settings.autoSyncOnLogout = (days > 0);
    
    localStorage.setItem('nav_app_data', JSON.stringify(appData));
    
    // 刷新 UI
    openSyncCenter();
    
    const msg = days === 0 ? "已切换为手动维护模式" : `已设置为 ${days} 天自动提醒备份`;
    showToast(msg);
};

// Task 12.2 & 13.2 & 14.1: 唤起全站系统参数配置中枢 (Tab 架构重构)
window.openSystemConfigHub = async (defaultTab = 'brand') => {
    if (!isAdmin) return;
    lastFocusedElement = document.activeElement;
    closeAllModals(true);
    showLoader('正在读取全站配置...');

    try {
        const res = await fetch('/api/admin/site-config', {
            headers: { 'Authorization': sysToken }
        });
        const config = await res.json();
        hideLoader();

        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('edit-title');
        const body = document.getElementById('edit-form-body');
        const confirmBtn = document.getElementById('btn-confirm-edit');
        
        if (!modal || !body) return;

        title.innerHTML = `<i class="ri-settings-5-line"></i> 系统配置中心`;
        const sec = config.security || { maxLoginAttempts: 5, loginLockoutMin: 10, maxRegisterPerHour: 3, registerLockoutHours: 24 };

        body.innerHTML = `
            <div class="admin-hub-tabs">
                <button class="hub-tab ${defaultTab === 'brand' ? 'active' : ''}" onclick="switchSysTab('brand')">品牌与 SEO</button>
                <button class="hub-tab ${defaultTab === 'policy' ? 'active' : ''}" onclick="switchSysTab('policy')">注册策略</button>
                <button class="hub-tab ${defaultTab === 'security' ? 'active' : ''}" onclick="switchSysTab('security')">安全与时间</button>
                <button class="hub-tab ${defaultTab === 'roles' ? 'active' : ''}" onclick="switchSysTab('roles')">角色授权</button>
            </div>

            <!-- 区块 1: 品牌与 SEO -->
            <div id="sys-pane-brand" class="hub-pane ${defaultTab === 'brand' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div class="form-group">
                        <label>站点标题</label>
                        <input type="text" id="sys-site-title" value="${config.siteTitle || ''}" placeholder="CloudNav">
                    </div>
                    <div class="form-group">
                        <label>Favicon URL</label>
                        <input type="text" id="sys-favicon-url" value="${config.faviconUrl || ''}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label>SEO 关键词</label>
                        <input type="text" id="sys-seo-keywords" value="${config.seoKeywords || ''}" placeholder="以逗号分隔">
                    </div>
                    <div class="form-group">
                        <label>SEO 描述</label>
                        <textarea id="sys-seo-desc" rows="2" placeholder="站点描述信息...">${config.seoDescription || ''}</textarea>
                    </div>
                </div>
            </div>
            
            <!-- 区块 2: 注册与准入 -->
            <div id="sys-pane-policy" class="hub-pane ${defaultTab === 'policy' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div class="form-group" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <div style="font-size:14px; color:white;">开放注册</div>
                            <div style="font-size:11px; color:#888;">允许新用户直接注册账号</div>
                        </div>
                        <label class="switch-ui">
                            <input type="checkbox" id="sys-allow-reg" ${config.allowOpenRegistration !== false ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-group" style="display:flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size:14px; color:white;">强制要求邀请码</div>
                            <div style="font-size:11px; color:#888;">注册时必须填写有效的邀请码</div>
                        </div>
                        <label class="switch-ui">
                            <input type="checkbox" id="sys-require-invite" ${config.requireInvitation ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label>超级用户邀请码总量配额</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="sys-su-quota" value="${config.superUserInviteQuota || 10}" style="flex:1;">
                            <span style="font-size:11px; color:#888;">(累积生成上限)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 区块 3: 安全与时间 -->
            <div id="sys-pane-security" class="hub-pane ${defaultTab === 'security' ? 'active' : ''}">
                <div class="admin-config-section">
                    <h4 style="font-size:12px; color:#888; text-transform:uppercase; margin: 0 0 10px 0;"><i class="ri-shield-check-line"></i> 安全防护策略</h4>
                    <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group">
                            <label>登录重试上限</label>
                            <input type="number" id="sys-login-max" value="${sec.maxLoginAttempts}">
                        </div>
                        <div class="form-group">
                            <label>登录锁定 (分)</label>
                            <input type="number" id="sys-login-lock" value="${sec.loginLockoutMin}">
                        </div>
                    </div>
                    <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                        <div class="form-group">
                            <label>IP 每小时注册限额</label>
                            <input type="number" id="sys-reg-max" value="${sec.maxRegisterPerHour}">
                        </div>
                        <div class="form-group">
                            <label>注册封禁时长 (时)</label>
                            <input type="number" id="sys-reg-lock" value="${sec.registerLockoutHours}">
                        </div>
                    </div>
                    
                    <h4 style="font-size:12px; color:#888; text-transform:uppercase; margin: 15px 0 10px 0;"><i class="ri-time-line"></i> 系统时区控制</h4>
                    <div class="form-group">
                        <label>系统信息显示时区</label>
                        <select id="sys-timezone" style="width:100%; height:38px; padding:0 10px; background:var(--glass); color:var(--text); border:1px solid var(--glass-border); border-radius:6px; outline:none; box-sizing:border-box;">
                            <option value="Asia/Shanghai" ${config.systemTimezone === 'Asia/Shanghai' || !config.systemTimezone ? 'selected' : ''}>北京时间 (Asia/Shanghai - UTC+8)</option>
                            <option value="UTC" ${config.systemTimezone === 'UTC' ? 'selected' : ''}>格林威治时间 (UTC - UTC+0)</option>
                            <option value="America/New_York" ${config.systemTimezone === 'America/New_York' ? 'selected' : ''}>纽约时间 (America/New_York - UTC-5/UTC-4)</option>
                            <option value="Europe/London" ${config.systemTimezone === 'Europe/London' ? 'selected' : ''}>伦敦时间 (Europe/London - UTC+0/UTC+1)</option>
                            <option value="Asia/Tokyo" ${config.systemTimezone === 'Asia/Tokyo' ? 'selected' : ''}>东京时间 (Asia/Tokyo - UTC+9)</option>
                            <option value="Europe/Paris" ${config.systemTimezone === 'Europe/Paris' ? 'selected' : ''}>巴黎时间 (Europe/Paris - UTC+1/UTC+2)</option>
                        </select>
                        <p style="font-size: 11px; opacity: 0.6; margin-top: 5px;">说明：此参数控制系统所有卡片创建时间、日志和同步状态等时间戳的显示时区。</p>
                    </div>
                </div>
            </div>

            <!-- 区块 4: 角色授权 (Task UM.8.4 & Task AC.3) -->
            <div id="sys-pane-roles" class="hub-pane ${defaultTab === 'roles' ? 'active' : ''}">
                <div class="admin-config-section">
                    <div style="font-size:12px; color:#f1c40f; margin-bottom:12px; background:rgba(241,196,15,0.1); padding:8px; border-radius:6px; line-height:1.4; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ri-error-warning-line"></i> 提示：只有首席管理员 (Root) 可提拔 Admin。</span>
                        <span id="admin-quota-badge" style="background:#f1c40f; color:#000; padding:2px 8px; border-radius:10px; font-weight:bold; font-size:11px;">名额加载中...</span>
                    </div>
                    <div class="form-group">
                        <input type="text" id="sys-role-search-kw" placeholder="输入用户名搜索以调整权限..." oninput="handleSysRoleSearch(this.value)">
                    </div>
                    <div id="sys-role-search-results" style="max-height: 250px; overflow-y: auto;">
                        <div style="text-align:center; padding:20px; color:#666; font-size:13px;">请输入关键字开始搜索...</div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        confirmBtn.style.display = 'block';
        confirmBtn.innerText = "应用全站参数";
        confirmBtn.onclick = () => saveSystemConfig();
    } catch (e) {
        hideLoader();
        showToast("加载系统参数失败", "#e74c3c");
    }
};

// Task 14.1: 系统参数 Tab 切换逻辑
window.switchSysTab = (tab) => {
    document.querySelectorAll('#edit-modal .hub-tab').forEach(el => {
        el.classList.toggle('active', 
            (tab === 'brand' && el.innerText.includes('品牌')) ||
            (tab === 'policy' && el.innerText.includes('策略')) ||
            (tab === 'security' && (el.innerText.includes('安全') || el.innerText.includes('防护'))) ||
            (tab === 'roles' && el.innerText.includes('角色'))
        );
    });
    document.querySelectorAll('#edit-modal .hub-pane').forEach(el => {
        el.classList.remove('active');
    });
    const target = document.getElementById(`sys-pane-${tab}`);
    if (target) target.classList.add('active');
};

// Task UM.8.4: 角色授权搜索逻辑
window.handleSysRoleSearch = debounce(async (kw) => {
    const resultsDiv = document.getElementById('sys-role-search-results');
    if (!kw.trim()) {
        resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#666; font-size:13px;">请输入关键字开始搜索...</div>';
        return;
    }
    
    resultsDiv.innerHTML = '<div style="text-align:center; padding:20px;"><div class="global-spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div></div>';
    
    try {
        const res = await fetch(`/api/admin/users?keyword=${encodeURIComponent(kw)}&pageSize=50`, {
            headers: { 'Authorization': sysToken }
        });
        const data = await res.json();
        
        if (data.users && data.users.length > 0) {
            const isRoot = (currentUser?.id === '1' || currentUser?.uid === 10001);
            const adminCount = data.adminCount || 0;
            const quotaBadge = document.getElementById('admin-quota-badge');
            if (quotaBadge) {
                quotaBadge.innerText = `管理员名额: ${adminCount} / 5`;
                quotaBadge.style.background = adminCount >= 5 ? '#e74c3c' : '#f1c40f';
                quotaBadge.style.color = adminCount >= 5 ? '#fff' : '#000';
            }

            resultsDiv.innerHTML = `
                <table class="admin-table">
                    <tbody>
                        ${data.users.map(u => {
                            const isAdminFull = adminCount >= 5 && u.role !== 'admin';
                            return `
                                <tr>
                                    <td><b>${escapeHTML(u.username)}</b><br><small style="opacity:0.5">${u.uid}</small></td>
                                    <td style="text-align:right">
                                        <select onchange="updateUserRoleConfirm('${u.id}', this.value)" style="width:auto; height:32px; padding:0 10px;">
                                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                            <option value="super_user" ${u.role === 'super_user' ? 'selected' : ''}>Super User</option>
                                            ${(isRoot || u.role === 'admin') ? `
                                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''} 
                                                    ${(!isRoot || isAdminFull) ? 'disabled' : ''}>
                                                    Admin ${isAdminFull ? '(名额已满)' : ''}
                                                </option>` : ''}
                                        </select>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            resultsDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">未找到用户</div>';
        }
    } catch (e) {
        resultsDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#e74c3c;">加载失败: ${e.message}</div>`;
    }
}, 400);

window.updateUserRoleConfirm = async (userId, newRole) => {
    const adminPassword = prompt(`⚠️ 正在将该用户角色变更为 [${newRole.toUpperCase()}]，请输入您的管理员密码确认操作：`);
    if (!adminPassword) return;

    await SyncUI.perform('USER_MANAGE', async () => {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role: newRole, adminPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "授权失败");
        showToast("角色已成功变更", "#2ecc71");
    });
};

const saveSystemConfig = async () => {
    const payload = {
        siteTitle: document.getElementById('sys-site-title').value.trim(),
        faviconUrl: document.getElementById('sys-favicon-url').value.trim(),
        seoKeywords: document.getElementById('sys-seo-keywords').value.trim(),
        seoDescription: document.getElementById('sys-seo-desc').value.trim(),
        allowOpenRegistration: document.getElementById('sys-allow-reg').checked,
        requireInvitation: document.getElementById('sys-require-invite').checked,
        superUserInviteQuota: parseInt(document.getElementById('sys-su-quota').value) || 10,
        systemTimezone: document.getElementById('sys-timezone').value,
        security: {
            maxLoginAttempts: parseInt(document.getElementById('sys-login-max').value),
            loginLockoutMin: parseInt(document.getElementById('sys-login-lock').value),
            maxRegisterPerHour: parseInt(document.getElementById('sys-reg-max').value),
            registerLockoutHours: parseInt(document.getElementById('sys-reg-lock').value)
        }
    };

    await SyncUI.perform('ADMIN_CONFIG', async () => {
        const res = await fetch('/api/admin/site-config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Task 13.4: 立即重新拉取并应用最新的站点配置 (标题、SEO、Favicon 等)
            initSiteConfig(); 
            closeAllModals();
        } else {
            const data = await res.json();
            throw new Error(data.error || "下发失败");
        }
    });
};

// Task 9.4: 周期性自动备份调度器
const checkAutoSyncSchedule = async () => {
    if (!sysToken) return;
    
    const intervalDays = appData.settings?.syncInterval || 0;
    if (intervalDays <= 0) return;

    const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
    const now = Date.now();
    const threshold = intervalDays * 24 * 60 * 60 * 1000;

    if (now - lastSync > threshold) {
        console.log(`[Sync] Auto-sync triggered. Interval: ${intervalDays} days. Last sync: ${formatSystemDate(lastSync, false)}`);
        
        // 自动同步前进行静默检查：如果数据没变（isDataDirty 为 false），则仅更新时间戳而不发请求
        // 或者简单起见，既然是自动备份，直接执行一次上传以确保云端是最新的
        showToast(`自动备份中 (周期: ${intervalDays} 天)...`, "#3498db");
        await manualSyncCloud();
    }
};

// ==================== 6. 其他初始化 ====================
// Task 29.4: 提取稳定的主题更新函数
const applyThemeUpdate = () => {
    const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
    
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = isDark ? '#111111' : '#f0f3f8';
    }
};

// 监听系统主题变化 (全局监听一次即可)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode === 'auto') applyThemeUpdate();
});

window.setThemeMode = (mode) => {
    themeMode = mode;
    localStorage.setItem('nav_theme_mode', mode);
    
    applyThemeUpdate(); // 立即应用
    
    // 同步 UI
    renderTools();
};

window.toggleThemeMode = () => {
    const modes = ['auto', 'light', 'dark'];
    let index = modes.indexOf(themeMode);
    if (index === -1) index = 0;
    const nextMode = modes[(index + 1) % modes.length];
    
    setThemeMode(nextMode);
    
    const modeNames = { 'auto': '跟随系统', 'light': '明亮模式', 'dark': '暗黑模式' };
    showToast(`主题已切换为: ${modeNames[nextMode]}`, "#3498db");
};

const initThemeMode = () => {
    applyThemeUpdate();
};

const toggleSidebar = (force) => {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (!s || !o) return;
    const isOpen = typeof force === 'boolean' ? force : !s.classList.contains('open');
    s.classList.toggle('open', isOpen);
    o.classList.toggle('visible', isOpen);

    // --- Task 15.4: 侧边栏打开时，同步锁定禅意模式为唤醒态 ---
    if (isOpen && appData.settings?.zenMode) {
        isZenTempExpanded = true;
        document.body.classList.remove('zen-silent');
        // 确保不会因为静默态而无法操作侧边栏
        updateStyles();
    }
};

const initSidebar = () => {
    const t = document.getElementById('sidebar-toggle');
    const o = document.getElementById('sidebar-overlay');
    const pinBtn = document.getElementById('btn-sidebar-pin');
    const noticeBtn = document.getElementById('btn-notice-center');

    if (t) t.onclick = () => toggleSidebar();
    if (o) o.onclick = () => toggleSidebar(false);
    if (noticeBtn) noticeBtn.onclick = () => typeof openNoticeCenter === 'function' && openNoticeCenter();

    // --- Task 6.3: JS 状态控制与“图钉”逻辑兼容 ---
    window.autoAdjustSidebar = () => {
        const width = window.innerWidth;
        const isZen = appData.settings?.zenMode === true;
        
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
            document.body.classList.toggle('sidebar-folded', !isSidebarPinned);
        } else {
            // Desktop 端：根据图钉状态决定
            document.body.classList.toggle('sidebar-folded', !isSidebarPinned);
        }
        
        // 更新图钉按钮图标状态
        if (pinBtn) {
            const icon = pinBtn.querySelector('i');
            if (icon) {
                icon.className = isSidebarPinned ? 'ri-pushpin-2-fill' : 'ri-pushpin-2-line';
            }
        }
    };

    // 监听窗口缩放 (Task 6.3)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(window.autoAdjustSidebar, 100);
    });

    // Task 4.6.4: 移动端边缘滑动抽屉 (Swipe Engine)
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

    // 图钉初始化 (Task 4.5.3)
    document.body.classList.toggle('sidebar-pinned', isSidebarPinned);
    window.autoAdjustSidebar();

    if (pinBtn) {
        pinBtn.onclick = () => {
            isSidebarPinned = !isSidebarPinned;
            document.body.classList.toggle('sidebar-pinned', isSidebarPinned);
            localStorage.setItem('nav_sidebar_pinned', isSidebarPinned);
            
            // 重新校准布局
            window.autoAdjustSidebar();
            
            // 如果取消固定且是移动端，自动关闭侧边栏
            if (!isSidebarPinned && window.innerWidth <= 768) toggleSidebar(false);
            
            showToast(isSidebarPinned ? "侧边栏已固定" : "侧边栏已设为自动折叠");
        };
    }
};

const initZenMode = () => {
    const btn = document.getElementById('zen-expand-btn');
    if (btn) btn.onclick = () => wakeUpNavigation();

    // Task 5.4: 智能唤醒引擎
    let moveDistance = 0;
    let moveTimer = null;
    
    window.resetZenSleepTimer = () => {
        if (window.zenSleepTimer) clearTimeout(window.zenSleepTimer);
        if (appData.settings?.zenMode && isZenTempExpanded) {
            window.zenSleepTimer = setTimeout(() => {
                const isModalOpen = (document.getElementById('edit-modal')?.style.display === 'flex') || 
                                     (document.getElementById('monaco-modal')?.style.display === 'block') ||
                                     (document.getElementById('auth-overlay')?.style.display === 'block');
                // 如果搜索框没有焦点，且没有处于管理模式，且没有任何模态弹窗打开，才自动沉睡 (Task NT.4)
                if (document.activeElement?.id !== 'sea-input' && !isPageManagementMode && !isModalOpen) {
                    isZenTempExpanded = false;
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
    
    isZenTempExpanded = true;
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

const initSearch = () => {
    const sea = document.getElementById('sea-input');
    const dropdown = document.getElementById('sea-dropdown');
    const resultsList = document.getElementById('local-results-list');
    const engineTrigger = document.getElementById('current-engine-trigger');
    const engineList = document.getElementById('engine-list');
    if (!sea || !dropdown || !resultsList) return;

    // Task 38.2: 初始化搜索引擎切换逻辑
    const initEngineSwitcher = () => {
        if (!engineTrigger || !engineList) return;

        // 1. 点击触发器显示/隐藏列表
        engineTrigger.onclick = (e) => {
            e.stopPropagation();
            engineList.classList.toggle('show');
            if (engineList.classList.contains('show')) {
                // 展开后自动聚焦第一个活跃引擎
                setTimeout(() => engineList.querySelector('.engine-item.active')?.focus(), 50);
            }
        };

        // 2. 点击项进行切换 (抽取为全局函数供外部调用)
        window.setSearchEngine = (engine, silent = false) => {
            const item = Array.from(document.querySelectorAll('.engine-item')).find(el => el.dataset.engine === engine);
            if (!item) return;

            const action = item.dataset.action;
            const logo = item.querySelector('.engine-logo').innerText;

            currentEnginePrefix = action;
            localStorage.setItem('nav_search_prefix', action);
            localStorage.setItem('nav_search_engine', engine);

            engineTrigger.innerHTML = logo;
            document.querySelectorAll('.engine-item').forEach(el => el.classList.toggle('active', el === item));
            engineList.classList.remove('show');
            
            if (sysToken && appData.settings) {
                appData.settings.searchEngine = engine;
                if (!silent) isDataDirty = true;
            }

            if (!silent) {
                showToast(`已切换至 ${item.innerText.trim()}`, "#3498db");
                sea.focus();
            }
        };

        document.querySelectorAll('.engine-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                window.setSearchEngine(item.dataset.engine);
            };
            // 键盘支持
            item.onkeydown = (e) => {
                if (e.key === 'Enter') item.click();
            };
        });

        // 3. 点击外部关闭
        document.addEventListener('click', () => engineList.classList.remove('show'));

        // 4. 恢复初始状态
        const savedEngine = (sysToken && appData.settings?.searchEngine) || localStorage.getItem('nav_search_engine') || 'bing';
        window.setSearchEngine(savedEngine, true);
    };

    initEngineSwitcher();

    sea.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const val = sea.value.trim();
            if (val) {
                // Task 4.6.2: 搜索历史持久化
                searchHistory = [val, ...searchHistory.filter(h => h !== val)].slice(0, 20);
                localStorage.setItem('search_history', JSON.stringify(searchHistory));
                historyIndex = -1;

                // 如果有选中的搜索项，优先跳转
                const activeItem = resultsList.querySelector('.local-result-item.active');
                if (activeItem) {
                    activeItem.click();
                } else {
                    window.open(currentEnginePrefix + encodeURIComponent(val), '_blank');
                }
            }
        }
        // 键盘上下选择
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
            const items = Array.from(resultsList.querySelectorAll('.local-result-item'));
            
            // Task 4.6.2: 空输入态下的历史回溯
            if (items.length === 0 || !sea.value.trim()) {
                if (searchHistory.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowUp') {
                        historyIndex = Math.min(historyIndex + 1, searchHistory.length - 1);
                    } else {
                        historyIndex = Math.max(historyIndex - 1, -1);
                    }
                    sea.value = historyIndex === -1 ? '' : searchHistory[historyIndex];
                    // 触发 input 事件以处理视觉反馈
                    sea.dispatchEvent(new Event('input'));
                }
                return;
            }

            e.preventDefault();
            let activeIdx = items.findIndex(i => i.classList.contains('active'));
            if (e.key === 'ArrowDown') activeIdx = (activeIdx + 1) % items.length;
            else activeIdx = (activeIdx - 1 + items.length) % items.length;
            
            items.forEach((item, idx) => item.classList.toggle('active', idx === activeIdx));
        }
    };

    // 搜索态视觉隔离逻辑 (Task 2.5.2 增强)
    sea.addEventListener('input', (e) => {
        // 如果不是由脚本触发的（即用户手动输入），则重置历史索引
        if (e.isTrusted) historyIndex = -1;
        
        const val = sea.value.trim().toLowerCase();
        const hasText = val.length > 0;
        document.body.classList.toggle('is-searching', hasText);
        
        if (hasText) {
            // 执行站内模糊搜索
            const matches = appData.items.filter(i => 
                (i.title.toLowerCase().includes(val) || (i.desc && i.desc.toLowerCase().includes(val))) &&
                (isAdmin || !i.hidden)
            ).slice(0, 8); // 最多显示 8 个结果

            if (matches.length > 0) {
                resultsList.innerHTML = matches.map((m, idx) => `
                    <div class="local-result-item ${idx === 0 ? 'active' : ''}" onclick="recordClick('${m.id}'); window.open('${m.url}', '${appData.settings?.link_target || '_blank'}')">
                        <span class="result-icon">${m.icon?.startsWith('http') ? `<img src="${m.icon}" data-retry-index="0" onerror="utils.handleIconError(this, '${m.url}')">` : (m.icon || '🔗')}</span>
                        <div class="result-info">
                            <div class="result-title">${m.title}</div>
                            <div class="result-url">${m.url}</div>
                        </div>
                    </div>
                `).join('');
                dropdown.style.display = 'block';
            } else {
                resultsList.innerHTML = `<div class="search-empty-tip">未找到匹配项，按回车通过云端搜索...</div>`;
                dropdown.style.display = 'block';
            }
        } else {
            dropdown.style.display = 'none';
        }
    });

    // Zen Mode 唤醒逻辑 (Task 2.1 & 2.5.1)
    sea.addEventListener('focus', () => {
        document.body.classList.add('search-active');
        if (appData.settings?.zenMode && !isZenTempExpanded) {
            isZenTempExpanded = true;
            renderNav();
        }
    });

    // Task S.3: 召唤按钮点击逻辑
    const summonBtn = document.getElementById('btn-summon-search');
    if (summonBtn) {
        summonBtn.onclick = () => {
            document.body.classList.add('search-active');
            sea.focus();
        };
    }

    // 点击外部关闭搜索层
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('search-active') && !e.target.closest('.search-wrapper')) {
            closeSearch();
        }
    });
};

// Task S.2: 关闭搜索层并重置状态
const closeSearch = () => {
    const sea = document.getElementById('sea-input');
    const dropdown = document.getElementById('sea-dropdown');
    document.body.classList.remove('search-active', 'is-searching');
    if (sea) {
        sea.value = '';
        sea.blur();
    }
    if (dropdown) dropdown.style.display = 'none';
};

// Task 9.6 & O.3 & O++.1 & 9.1 & 11.3: 全局模态状态清理函数 (支持静默模式)
const closeAllModals = (silent = false) => {
    const editModal = document.getElementById('edit-modal');
    const modalType = editModal?.dataset.modalType;

    // 1. 逻辑分流：仅当是个性化设置(Visual)或页面管理退出时，才执行“暂存引导”
    // 注意：admin-hub 和 system-config 拥有自己的独立即时保存按钮，此处不干预
    const isPersonalSettings = (modalType === 'visual-lab' || !isPageManagementMode);
    const isAdminAction = (modalType === 'admin-hub' || modalType === 'system-config' || modalType === 'sync-center');

    if (!silent && isDataDirty && !isAdminAction) {
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

    // Task 37.2: 焦点还原
    if (!silent && lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }

    // Task UM.4: 关闭所有弹窗时隐藏管理员批量操作栏
    const adminBar = document.getElementById('admin-user-batch-bar');
    if (adminBar) adminBar.classList.remove('visible');
};

// Task EXIT.4: 统一退出暂存逻辑 (针对个人偏好设置)
const handleDataSaveOnExit = async () => {
    if (!isDataDirty) return;
    
    await SyncUI.perform('LAYOUT_SAVE', async () => {
        // 仅保存到本地 localStorage
        localStorage.setItem('nav_app_data', JSON.stringify(appData));
        await new Promise(r => setTimeout(r, 400));
        
        if (!sysToken) {
            isDataDirty = false;
            throw { message: "已保存至本地。登录后可启用云端同步，实现多设备同步。", isWarning: true };
        } else {
            const autoSync = appData.settings?.autoSyncOnLogout !== false;
            if (!autoSync) {
                throw { message: "已暂存本地。请记得手动同步或开启退出自动同步", isWarning: true };
            }
        }
    });
};

// ==================== 9. Task 3.3: 页面管理模式 (Page Management) ====================

const togglePageManagement = (force) => {
    // Task 17.3: 允许所有角色进入页面管理模式，移除 isAdmin 硬拦截
    
    // Task 10.6.2: 交互锁定逻辑 - 如果当前已是管理模式且尝试通过侧边栏点击（force 未定义），则不执行切换（关闭）
    // 强制引导用户通过“保存并退出”按钮或 Esc 退出
    if (isPageManagementMode && typeof force === 'undefined') {
        return showToast("请点击顶部或下方的“保存并退出”按钮完成管理", "#3498db");
    }

    // Task 9.6: 进入管理模式前清理所有弹窗
    closeAllModals();

    isPageManagementMode = typeof force === 'boolean' ? force : !isPageManagementMode;
    document.body.classList.toggle('page-manage-active', isPageManagementMode);
    
    // Task 11.4: 必须先进行视图渲染，确保 DOM 节点存在
    updateStyles(); // 🚀 确保在页面管理切换时，即时解禁/隐退禅意模式并应用标准布局！
    renderTools();
    renderNav();

    if (isPageManagementMode) {
        selectedIds.clear();
        showToast("进入管理模式：拖拽卡片重新排序，或点击分类图标编辑", "#3498db");
        // 渲染后再初始化拖拽插件
        initSortable();
    } else {
        destroySortable();
        // Task 22.3: 统一接入自动保存与引导逻辑 (Task EXIT.4)
        handleDataSaveOnExit();
        
        selectedIds.clear();
        updateBatchBar();
        // Task 4.8.2: 深度状态重置 (关闭可能打开的专家模式编辑器)
        const monacoModal = document.getElementById('monaco-modal');
        if (monacoModal) monacoModal.style.display = 'none';
    }
};

// Task 4.3: 分类管理函数
const openCategoryEditModal = (catId) => {
    lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return;

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = "编辑分类";
    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-font-size"></i> 分类名称</label>
            <div style="display:flex; gap:8px; width:100%; align-items:center;">
                <input type="text" id="edit-cat-name" value="${cat.name}" placeholder="如：社交媒体" style="flex:1;">
                <button id="btn-select-emoji" class="icon-btn-action" title="选择分类图标" onclick="toggleEmojiPicker()">
                    <i class="ri-emotion-line"></i>
                </button>
                <div id="cat-icon-preview" class="preview-container">
                    ${cat.icon || '📂'}
                </div>
            </div>
            <input type="hidden" id="edit-cat-icon" value="${cat.icon || '📂'}">
        </div>
        ${getEmojiPickerHTML()}
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';

    // Task 37.2: 自动聚焦
    setTimeout(() => {
        document.getElementById('edit-cat-name')?.focus();
    }, 50);

    confirmBtn.onclick = async () => {
        const newName = document.getElementById('edit-cat-name').value.trim();
        const newIcon = document.getElementById('edit-cat-icon').value.trim();
        
        if (!newName) return showToast("名称不能为空", "#e67e22");
        
        cat.name = newName;
        cat.icon = newIcon || '📂';
        isDataDirty = true;
        
        modal.style.display = 'none';
        showToast("分类修改已本地暂存", "#3498db");
        renderNav();
    };
};

/**
 * ==========================================
 * Emoji 选择器逻辑
 * ==========================================
 */
const getEmojiPickerHTML = () => `
    <div id="emoji-picker-container" class="emoji-picker-container">
        <div class="emoji-search-wrapper">
            <i class="ri-search-line"></i>
            <input type="text" id="emoji-search-input" placeholder="输入关键词搜索图标..." oninput="searchEmojis(this.value)">
        </div>
        <div class="emoji-picker-tabs" id="emoji-picker-tabs"></div>
        <div class="emoji-grid" id="emoji-grid"></div>
    </div>
`;

window.toggleEmojiPicker = () => {
    const container = document.getElementById('emoji-picker-container');
    if (!container) return;
    
    const isVisible = container.style.display === 'flex';
    container.style.display = isVisible ? 'none' : 'flex';
    
    if (!isVisible) {
        initEmojiPicker();
    }
};

window.initEmojiPicker = (activeCategory = 'officeAndBookmarks', searchQuery = '') => {
    const tabsContainer = document.getElementById('emoji-picker-tabs');
    const gridContainer = document.getElementById('emoji-grid');
    
    if (!tabsContainer || !gridContainer) return;

    // 渲染 Tab (搜索时隐藏 Tab 以腾出空间)
    const categories = {
        officeAndBookmarks: '📂 办公',
        natureAndTravel: '🌍 自然',
        objectsAndSymbols: '💡 物品',
        activitiesAndSports: '⚽ 活动',
        random: '🎲 随机'
    };

    if (searchQuery) {
        tabsContainer.style.display = 'none';
    } else {
        tabsContainer.style.display = 'flex';
        tabsContainer.innerHTML = Object.entries(categories).map(([key, label]) => `
            <button class="emoji-tab-btn ${key === activeCategory ? 'active' : ''}" 
                    onclick="event.stopPropagation(); initEmojiPicker('${key}')">${label}</button>
        `).join('');
    }

    // 渲染网格
    let emojis = [];
    try {
        if (searchQuery) {
            emojis = window.emojiPool.searchEmojisByKeyword(searchQuery);
        } else if (activeCategory === 'random') {
            emojis = window.emojiPool.getRandomEmojis(32);
        } else {
            emojis = window.emojiPool.EMOJI_CATEGORIES[activeCategory] || [];
        }
    } catch (e) {
        console.error('[Emoji] Render error:', e);
        emojis = ['⚠️', '❓'];
    }
    
    if (emojis.length === 0) {
        gridContainer.innerHTML = `<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--text-dim); font-size: 13px;">
            未找到相关图标
        </div>`;
    } else {
        gridContainer.innerHTML = emojis.map(emoji => `
            <div class="emoji-item" title="点击选择" onclick="event.stopPropagation(); selectEmoji('${emoji}')">${emoji}</div>
        `).join('');
    }
};

window.searchEmojis = (query) => {
    // 防抖处理：避免频繁输入导致的性能问题
    clearTimeout(window.emojiSearchTimer);
    window.emojiSearchTimer = setTimeout(() => {
        initEmojiPicker(null, query);
    }, 200);
};

window.selectEmoji = (emoji) => {
    // 兼容分类图标和网址图标编辑框 (Task 3.2: 增加 edit-icon 支持)
    const iconInput = document.getElementById('edit-cat-icon') || document.getElementById('edit-icon');
    if (iconInput) {
        iconInput.value = emoji;
        // Task CR.3: 如果存在预览框，同步更新预览
        const previewBox = document.getElementById('cat-icon-preview');
        if (previewBox) previewBox.innerText = emoji;

        // 针对书签图标编辑框，显式同步更新其预览框结构
        const editIconPreview = document.getElementById('edit-icon-preview');
        if (editIconPreview) {
            editIconPreview.innerHTML = `<span>${emoji}</span>`;
        }

        // 触发一次 input 事件，确保如果有其他联动逻辑可以感知
        iconInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 选中后自动收起面板并显示成功反馈
        const container = document.getElementById('emoji-picker-container');
        if (container) {
            container.style.display = 'none';
            showToast(`已选择图标 ${emoji}`, "#27ae60");
        }
    }
};

const toggleCategoryVisibility = (catId) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return;
    
    cat.hidden = !cat.hidden;
    isDataDirty = true;
    showToast(cat.hidden ? `分类 ${cat.name} 已本地隐藏` : `分类 ${cat.name} 已本地显示`, "#3498db");
    renderNav();
};

const deleteCategory = async (catId) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return;

    const itemCount = appData.items.filter(i => (i.catId === catId || i.cat_id === catId)).length;
    const msg = itemCount > 0 
        ? `该分类下有 ${itemCount} 个书签，删除分类将同时删除这些书签！确定继续吗？` 
        : `确定要删除分类 "${cat.name}" 吗？`;

    if (!confirm(msg)) return;

    appData.categories = appData.categories.filter(c => c.id !== catId);
    appData.items = appData.items.filter(i => (i.catId !== catId && i.cat_id !== catId));

    isDataDirty = true;
    showToast(`分类 ${cat.name} 已本地删除`, "#e67e22");
    renderNav();
};

const initSortable = () => {
    destroySortable(); // 清理旧实例
    
    // 1. 书签网格排序 (支持跨分类)
    const grids = document.querySelectorAll('.nav-grid');
    grids.forEach(grid => {
        const catId = grid.closest('.category-section').id.replace('section-', '');
        if (catId === 'VIRTUAL_FREQ') return;

        const sortable = new Sortable(grid, {
            group: 'shared-bookmarks',
            animation: 180,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            filter: '.add-new-card', // 排除新增按钮参与排序 (Task 11.2)
            preventOnFilter: true,
            // Task 11.6: 动态高亮目标容器
            onDragOver: (evt) => {
                document.querySelectorAll('.nav-grid').forEach(g => g.classList.remove('grid-active'));
                evt.to.classList.add('grid-active');
            },
            onEnd: (evt) => {
                document.querySelectorAll('.nav-grid').forEach(g => g.classList.remove('grid-active'));
                handleSortEnd(evt, 'item');
            }
        });
        sortableInstances.push(sortable);
    });

    // 2. 侧边栏分类排序 (仅管理模式开启)
    const sidebarNav = document.getElementById('sidebar-nav');
    if (sidebarNav) {
        const catSortable = new Sortable(sidebarNav, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.drag-handle', // Task CAT.2: 使用专用手柄触发
            draggable: '.sortable-cat', // Task CAT.2: 仅允许特定项参与排序
            onEnd: (evt) => handleSortEnd(evt, 'category')
        });
        sortableInstances.push(catSortable);
    }
};

const destroySortable = () => {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];
};

const handleSortEnd = (evt, type) => {
    if (type === 'item') {
        const toGrid = evt.to;
        const toCatId = toGrid.closest('.category-section').id.replace('section-', '');
        const itemId = evt.item.getAttribute('data-id');

        console.log(`[Sort] Item ${itemId} dropped into category ${toCatId}`);

        // 1. 获取目标卡片的所有 ID 顺序（按 DOM 实时顺序扫描）
        // 这一步是关键：直接读取 DOM 顺序来校准内存，避免复杂的索引计算错误
        const newItemsOrder = [];
        
        // 扫描所有分类的网格，按视觉顺序重新排列 appData.items
        document.querySelectorAll('.nav-grid').forEach(grid => {
            const gridCatId = grid.closest('.category-section').id.replace('section-', '');
            if (gridCatId === 'VIRTUAL_FREQ') return;

            grid.querySelectorAll('.card:not(.add-new-card)').forEach(card => {
                const id = card.getAttribute('data-id');
                const found = appData.items.find(i => i.id === id);
                if (found) {
                    // 更新 catId 归属 (跨分类核心逻辑)
                    found.catId = gridCatId;
                    found.cat_id = gridCatId;
                    newItemsOrder.push(found);
                }
            });
        });

        // 2. 补全不在 DOM 中的 items (如隐藏项或过滤掉的项)
        appData.items.forEach(i => {
            if (!newItemsOrder.find(ni => ni.id === i.id)) {
                newItemsOrder.push(i);
            }
        });

        appData.items = newItemsOrder;

    } else if (type === 'category') {
        console.log('[Sort] Categories reordered');
        const newCatOrder = [];
        // Task CAT.3: 使用 data-id 精确匹配
        document.querySelectorAll('.sidebar-nav-item.sortable-cat').forEach(nav => {
            const id = nav.getAttribute('data-id');
            const found = appData.categories.find(c => c.id === id);
            if (found) newCatOrder.push(found);
        });
        
        // 补全不在 DOM 中的分类 (如有)
        appData.categories.forEach(c => {
            if (!newCatOrder.find(nc => nc.id === c.id)) {
                newCatOrder.push(c);
            }
        });
        
        appData.categories = newCatOrder;
        renderNav(); // Task CAT.3: 分类排序后立即刷新主视图顺序
    }

    isDataDirty = true;
};

const updateBatchBar = () => {
    const bar = document.getElementById('batch-actions-bar');
    const countEl = document.getElementById('batch-count');
    if (!bar || !countEl) return;

    if (isPageManagementMode && selectedIds.size > 0) {
        countEl.innerText = selectedIds.size;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

const syncConfigToCloud = async () => {
    if (!sysToken) {
        // Task 20.5.3: 游客态分流处理
        console.log('[Sync] Guest mode detected, saving to localStorage...');
        localStorage.setItem('nav_app_data', JSON.stringify(appData));
        isDataDirty = false;
        showToast("设置已暂存至本地 (登录后可同步至云端)", "#3498db");
        return;
    }
    console.log('[Sync] Saving changes to cloud...');
    isDataDirty = false; // 同步开始即视为正在清理标记
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(appData)
        });

        if (res.status === 401) return handleAuthError();
        
        if (res.status === 403) {
            const err = await res.json();
            if (err.code === 'ERR_QUOTA_EXCEEDED') {
                return showToast(err.error || "已达到书签配额上限，请先清理无用书签", "#e74c3c");
            }
        }

        if (res.ok) showToast("更改已成功同步至云端", "#27ae60");
        else throw new Error("Cloud save failed");
    } catch (e) {
        isDataDirty = true; // 失败后恢复脏标记
        showToast("同步失败，请检查网络", "#e74c3c");
    }
};

const doBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个书签吗？`)) return;

    appData.items = appData.items.filter(i => !selectedIds.has(i.id));
    selectedIds.clear();
    isDataDirty = true;
    showToast("批量删除已在本地执行", "#e67e22");
    
    renderNav();
    updateBatchBar();
};

const doBatchToggleHidden = async () => {
    if (selectedIds.size === 0) return;
    
    // 检查第一个选中的项的状态作为切换基准
    const firstId = Array.from(selectedIds)[0];
    const firstItem = appData.items.find(i => i.id === firstId);
    const targetHidden = firstItem ? !firstItem.hidden : true;

    appData.items.forEach(i => {
        if (selectedIds.has(i.id)) {
            i.hidden = targetHidden;
        }
    });

    selectedIds.clear();
    isDataDirty = true;
    showToast(`批量${targetHidden ? '隐藏' : '显示'}已本地执行`, "#3498db");
    
    renderNav();
    updateBatchBar();
};

const openBatchMoveModal = () => {
    if (selectedIds.size === 0) return;
    
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = `批量移动 (${selectedIds.size} 个书签)`;
    body.innerHTML = `
        <div class="form-group">
            <label>选择目标分类</label>
            <select id="batch-move-cat" class="edit-input">
                ${appData.categories.filter(c => c.id !== 'VIRTUAL_FREQ').map(c => `
                    <option value="${c.id}">${c.name}</option>
                `).join('')}
            </select>
        </div>
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = () => {
        const targetCatId = document.getElementById('batch-move-cat').value;
        const targetCat = appData.categories.find(c => c.id === targetCatId);
        
        if (!targetCat) return showToast("无效的目标分类", "#e67e22");

        // Task 4.3: 批量移动配额校验
        const currentItemsInTarget = appData.items.filter(i => (i.catId === targetCatId || i.cat_id === targetCatId) && !selectedIds.has(i.id));
        if (currentItemsInTarget.length + selectedIds.size > 100) {
            return showToast(`目标分类已满，无法容纳新增的 ${selectedIds.size} 个书签`, "#e74c3c");
        }

        appData.items.forEach(i => {
            if (selectedIds.has(i.id)) {
                i.catId = targetCatId;
                i.cat_id = targetCatId;
            }
        });

        modal.style.display = 'none';
        selectedIds.clear();
        isDataDirty = true;
        showToast(`已本地移动至 ${targetCat.name}`, "#3498db");
        
        renderNav();
        updateBatchBar();
    };
};

// ==================== 10. Task 4.1: 管理员后台 (Admin Hub) ====================

const openAdminHub = async (defaultTab = 'users') => {
    lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = "管理员控制中心 (Admin Hub)";
    body.innerHTML = '<div class="admin-hub-loading">正在加载全站数据...</div>';
    modal.style.display = 'flex';
    confirmBtn.style.display = 'none'; // 后台采用即时操作

    // 初始化筛选状态
    adminUserFilters = { page: 1, pageSize: 20, keyword: '', status: '' };
    adminSelectedUserIds.clear();
    adminAnnounceFilters = { page: 1, pageSize: 20, keyword: '', status: '', type: '' };
    adminSelectedAnnounceIds.clear();
    adminInviteFilters = { page: 1, pageSize: 20, keyword: '', status: '' };
    adminSelectedInviteIds.clear();
    adminAuditFilters = { page: 1, pageSize: 20, keyword: '', actionType: '' };
    updateAdminBatchBar();
    updateAnnounceBatchBar();
    updateInviteBatchBar();

    try {
        const [usersRes, inviteRes, announceRes, auditRes] = await Promise.all([
            fetch(`/api/admin/users?page=1&pageSize=20`, { headers: { 'Authorization': sysToken } }),
            fetch(`/api/admin/invitations?page=1&pageSize=20`, { headers: { 'Authorization': sysToken } }),
            fetch(`/api/admin/announcements?page=1&pageSize=20`, { headers: { 'Authorization': sysToken } }),
            fetch(`/api/admin/audit-logs?page=1&pageSize=20`, { headers: { 'Authorization': sysToken } })
        ]);
        
        const userData = await usersRes.json();
        const inviteData = await inviteRes.json();
        const announceData = await announceRes.json();
        const auditData = await auditRes.json();

        // 同步到内存状态 (Task 15.2 & UM.1 & STD.1)
        adminData = { 
            users: userData.users || [], 
            invitations: inviteData.invitations || [], 
            announcements: announceData.announcements || [], 
            logs: auditData.logs || [],
            pagination: userData.pagination || {}
        };

        body.innerHTML = `
            <div class="admin-hub-tabs">
                <button class="hub-tab ${defaultTab === 'users' ? 'active' : ''}" data-tab="users" onclick="switchHubTab('users')">用户管理</button>
                <button class="hub-tab ${defaultTab === 'invites' ? 'active' : ''}" data-tab="invites" onclick="switchHubTab('invites')">邀请管理</button>
                <button class="hub-tab ${defaultTab === 'announcements' ? 'active' : ''}" data-tab="announcements" onclick="switchHubTab('announcements')">公告管理</button>
                <button class="hub-tab ${defaultTab === 'audit' ? 'active' : ''}" data-tab="audit" onclick="switchHubTab('audit')">审计日志</button>
            </div>
            <div id="hub-content-users" class="hub-pane ${defaultTab === 'users' ? 'active' : ''}">
                <!-- Task UM.3: 折叠式搜索/筛选面板 -->
                <div class="admin-search-panel">
                    <div class="admin-search-header" onclick="toggleAdminSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 搜索与筛选面板</span>
                        <i id="admin-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="admin-search-body" class="admin-search-body collapsed">
                        <div class="form-group" style="margin-bottom:0">
                            <label>关键字检索</label>
                            <input type="text" id="admin-user-kw" placeholder="搜索用户名 / UID..." oninput="handleAdminUserSearch(this.value)">
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <label>状态筛选</label>
                            <select id="admin-user-status" onchange="handleAdminUserFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="active">活跃 (Active)</option>
                                <option value="frozen">冻结 (Frozen)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div id="admin-users-table-container">
                    ${renderAdminUserTableHTML(userData.users || [])}
                </div>
            </div>
            <div id="hub-content-invites" class="hub-pane ${defaultTab === 'invites' ? 'active' : ''}">
                <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
                    <div style="display:flex; gap:8px;">
                        <button class="tab-btn active" onclick="generateInvites(1)">+ 1</button>
                        <button class="tab-btn active" onclick="generateInvites(5)">+ 5</button>
                    </div>
                    <button class="tab-btn" onclick="copyUnusedInvites()"><i class="ri-file-copy-line"></i> 复制未使用</button>
                </div>

                <div class="admin-search-panel">
                    <div class="admin-search-header" onclick="toggleInviteSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 邀请码搜索</span>
                        <i id="invite-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="invite-search-body" class="admin-search-body collapsed">
                        <div class="form-row" style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                            <input type="text" id="invite-search-kw" placeholder="搜索邀请码/使用者..." oninput="handleAdminInviteSearch(this.value)">
                            <select id="invite-filter-status" onchange="handleAdminInviteFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="unused">未使用</option>
                                <option value="used">已使用</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div id="admin-invite-table-container" style="margin-top:15px;">
                    ${renderAdminInviteTableHTML(inviteData.invitations || [], inviteData.pagination)}
                </div>

                <!-- 批量操作栏 (Task STD.2) -->
                <div id="admin-invite-batch-bar" class="admin-batch-bar">
                    <span id="invite-batch-count">已选中 0 项</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn danger" onclick="batchInviteAction('delete')">批量下架</button>
                    </div>
                </div>
            </div>
            <div id="hub-content-announcements" class="hub-pane ${defaultTab === 'announcements' ? 'active' : ''}">
                <div class="admin-announce-editor" style="padding:12px; background:rgba(255,255,255,0.03); border:1px dashed var(--glass-border); border-radius:8px;">
                    <div style="font-size:12px; font-weight:bold; margin-bottom:10px; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="ri-edit-line"></i> 发布新公告 / 修改公告</span>
                        <button class="action-link" id="btn-toggle-editor" onclick="toggleAnnounceEditor()">收起编辑器</button>
                    </div>
                    <div id="announce-editor-fields">
                        <div class="form-group">
                            <input type="text" id="announce-title" placeholder="请输入公告标题...">
                        </div>
                        <div class="form-group">
                            <textarea id="announce-content" rows="3" placeholder="请输入公告详细内容..."></textarea>
                        </div>
                        <div class="form-row" style="display:flex; gap:15px; margin-bottom:10px;">
                            <div class="form-group" style="flex:1">
                                <label style="font-size:11px; opacity:0.7">展示层级</label>
                                <select id="announce-type">
                                    <option value="quiet">Quiet (右下角静默铃铛)</option>
                                    <option value="important">Important (全屏顶部条幅)</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1">
                                <label style="font-size:11px; opacity:0.7">过期时间 (可选)</label>
                                <input type="datetime-local" id="announce-expire">
                            </div>
                        </div>
                        <div class="form-group" style="display:flex; align-items:center; gap:15px;">
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px;">
                                <input type="checkbox" id="announce-top"> 置顶公告
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px;">
                                <input type="checkbox" id="announce-is-draft"> 存为草稿
                            </label>
                        </div>
                        <div id="announce-actions" style="display:flex; gap:10px; margin-top:10px;">
                            <button id="btn-save-announce" class="tab-btn active" style="flex:1;" onclick="saveAnnouncement()">发布公告</button>
                            <button id="btn-cancel-announce" class="tab-btn" style="flex:1; display:none;" onclick="cancelEditAnnounce()">取消修改</button>
                        </div>
                    </div>
                </div>

                <div class="admin-search-panel" style="margin-top:15px;">
                    <div class="admin-search-header" onclick="toggleAnnounceSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 公告搜索与筛选</span>
                        <i id="announce-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="announce-search-body" class="admin-search-body collapsed">
                        <div class="form-group" style="margin-bottom:0">
                            <input type="text" id="announce-search-kw" placeholder="标题/内容搜索..." oninput="handleAdminAnnounceSearch(this.value)">
                        </div>
                        <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                            <select id="announce-filter-status" onchange="handleAdminAnnounceFilter('status', this.value)">
                                <option value="">全部状态</option>
                                <option value="published">已发布</option>
                                <option value="draft">草稿</option>
                            </select>
                            <select id="announce-filter-type" onchange="handleAdminAnnounceFilter('type', this.value)">
                                <option value="">全部类型</option>
                                <option value="quiet">静默 (Quiet)</option>
                                <option value="important">重要 (Important)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div id="admin-announce-table-container" style="margin-top:15px;">
                    ${renderAdminAnnounceTableHTML(announceData.announcements || [], announceData.pagination)}
                </div>
                
                <!-- 批量操作栏 (Task AN.3) -->
                <div id="admin-announce-batch-bar" class="admin-batch-bar">
                    <span id="announce-batch-count">已选中 0 项</span>
                    <div style="display:flex; gap:10px;">
                        <button class="batch-btn" onclick="batchAnnounceAction('publish')">一键发布</button>
                        <button class="batch-btn" onclick="batchAnnounceAction('archive')">一键归档</button>
                        <button class="batch-btn danger" onclick="batchAnnounceAction('delete')">批量删除</button>
                    </div>
                </div>
            </div>
            <div id="hub-content-audit" class="hub-pane ${defaultTab === 'audit' ? 'active' : ''}">
                <div class="admin-search-panel" style="margin-bottom:15px;">
                    <div class="admin-search-header" onclick="toggleAuditSearch()">
                        <span style="font-size: 13px; font-weight: bold;"><i class="ri-search-line"></i> 日志高级检索</span>
                        <i id="audit-search-arrow" class="ri-arrow-down-s-line"></i>
                    </div>
                    <div id="audit-search-body" class="admin-search-body collapsed">
                        <div class="form-row" style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                            <input type="text" id="audit-search-kw" placeholder="操作人/IP/详情搜索..." oninput="handleAdminAuditSearch(this.value)">
                            <select id="audit-filter-action" onchange="handleAdminAuditFilter('actionType', this.value)">
                                <option value="">全部动作类型</option>
                                ${Object.keys(AuditActionMap).map(key => `
                                    <option value="${key}">${AuditActionMap[key].label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div id="admin-audit-table-container">
                    ${renderAdminAuditTableHTML(auditData.logs || [], auditData.pagination)}
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="error-text">加载失败: ${e.message}</div>`;
    }
};

// Task UM.3: 搜索与筛选交互函数
window.toggleAdminSearch = () => {
    const body = document.getElementById('admin-search-body');
    const arrow = document.getElementById('admin-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminUserSearch = async () => {
    const container = document.getElementById('admin-users-table-container');
    if (container) container.style.opacity = '0.5';
    
    try {
        const query = new URLSearchParams({
            page: adminUserFilters.page,
            pageSize: adminUserFilters.pageSize,
            keyword: adminUserFilters.keyword,
            status: adminUserFilters.status
        });
        const res = await fetch(`/api/admin/users?${query.toString()}`, {
            headers: { 'Authorization': sysToken }
        });
        const data = await res.json();
        if (data.success) {
            adminData.users = data.users;
            adminData.pagination = data.pagination;
            if (container) {
                container.innerHTML = renderAdminUserTableHTML(data.users);
                container.style.opacity = '1';
            }
        }
    } catch (e) {
        showToast("加载用户失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminUserSearch = debounce((val) => {
    adminUserFilters.keyword = val.trim();
    adminUserFilters.page = 1; // 重置页码
    performAdminUserSearch();
}, 400);

window.handleAdminUserFilter = (type, val) => {
    adminUserFilters[type] = val;
    adminUserFilters.page = 1;
    performAdminUserSearch();
};

// Task AN.3: 公告管理交互逻辑 (复用 UM 模块思路)
window.toggleAnnounceSearch = () => {
    const body = document.getElementById('announce-search-body');
    const arrow = document.getElementById('announce-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

window.toggleAnnounceEditor = () => {
    const fields = document.getElementById('announce-editor-fields');
    const btn = document.getElementById('btn-toggle-editor');
    if (!fields || !btn) return;
    const isHidden = fields.style.display === 'none';
    fields.style.display = isHidden ? 'block' : 'none';
    btn.innerText = isHidden ? '展开编辑器' : '收起编辑器';
};

const performAdminAnnounceSearch = async () => {
    const container = document.getElementById('admin-announce-table-container');
    if (container) container.style.opacity = '0.5';
    
    try {
        const query = new URLSearchParams({
            page: adminAnnounceFilters.page,
            pageSize: adminAnnounceFilters.pageSize,
            keyword: adminAnnounceFilters.keyword,
            status: adminAnnounceFilters.status,
            type: adminAnnounceFilters.type
        });
        const res = await fetch(`/api/admin/announcements?${query.toString()}`, {
            headers: { 'Authorization': sysToken }
        });
        const data = await res.json();
        if (data.success) {
            adminData.announcements = data.announcements;
            adminData.pagination = data.pagination;
            if (container) {
                container.innerHTML = renderAdminAnnounceTableHTML(data.announcements, data.pagination);
                container.style.opacity = '1';
                updateAnnounceBatchBar();
            }
        }
    } catch (e) {
        showToast("加载公告失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminAnnounceSearch = debounce((val) => {
    adminAnnounceFilters.keyword = val.trim();
    adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
}, 400);

window.handleAdminAnnounceFilter = (type, val) => {
    adminAnnounceFilters[type] = val;
    adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
};

window.handleAdminAnnouncePageChange = (page) => {
    adminAnnounceFilters.page = page;
    performAdminAnnounceSearch();
};

window.handleAdminAnnouncePageSizeChange = (size) => {
    adminAnnounceFilters.pageSize = parseInt(size);
    adminAnnounceFilters.page = 1;
    performAdminAnnounceSearch();
};

const renderAdminAnnounceTableHTML = (list, pagination) => {
    const isAllSelected = list.length > 0 && list.every(a => adminSelectedAnnounceIds.has(a.id.toString()));
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminAnnounceSelectAll(this.checked)">
                        </th>
                        <th>标题</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>发布人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:30px; opacity:0.5;">未找到匹配的公告</td></tr>' : 
                      list.map(a => `
                        <tr class="${adminSelectedAnnounceIds.has(a.id.toString()) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${adminSelectedAnnounceIds.has(a.id.toString()) ? 'checked' : ''} onchange="toggleAdminAnnounceSelect('${a.id}', this.checked)">
                            </td>
                            <td>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${a.is_top ? '<i class="ri-pushpin-fill" style="color:#f1c40f"></i> ' : ''}${escapeHTML(a.title)}</span>
                                    <span style="font-size:10px; opacity:0.5; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(a.content)}</span>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge" style="background:${a.type === 'important' ? 'rgba(231,76,60,0.1)' : 'rgba(52,152,219,0.1)'}; color:${a.type === 'important' ? '#e74c3c' : '#3498db'}">
                                    ${a.type === 'important' ? '重要' : '静默'}
                                </span>
                            </td>
                            <td><span class="status-badge ${a.status}">${a.status === 'published' ? '已发布' : (a.status === 'draft' ? '草稿' : '已归档')}</span></td>
                            <td><small style="opacity:0.7">${a.creator_name || 'System'}</small></td>
                            <td>
                                <div style="display:flex; gap:8px;">
                                    <button class="action-link" onclick="editAnnouncement(${JSON.stringify(a).replace(/"/g, '&quot;')})" title="编辑">
                                        <i class="ri-edit-line"></i>
                                    </button>
                                    <button class="action-link danger" onclick="deleteAnnouncement(${a.id})" title="删除">
                                        <i class="ri-delete-bin-line"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="admin-pagination">
            <div class="pagination-info">
                共 <b>${total}</b> 条，每页 
                <select style="width:auto; padding:2px 5px; height:24px; font-size:11px;" onchange="handleAdminAnnouncePageSizeChange(this.value)">
                    <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminAnnouncePageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminAnnouncePageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.toggleAdminAnnounceSelect = (id, checked) => {
    if (checked) adminSelectedAnnounceIds.add(id.toString());
    else adminSelectedAnnounceIds.delete(id.toString());
    
    const container = document.getElementById('admin-announce-table-container');
    if (container) {
        container.innerHTML = renderAdminAnnounceTableHTML(adminData.announcements, adminData.pagination);
    }
    updateAnnounceBatchBar();
};

window.toggleAdminAnnounceSelectAll = (checked) => {
    if (checked) {
        adminData.announcements.forEach(a => adminSelectedAnnounceIds.add(a.id.toString()));
    } else {
        adminSelectedAnnounceIds.clear();
    }
    const container = document.getElementById('admin-announce-table-container');
    if (container) {
        container.innerHTML = renderAdminAnnounceTableHTML(adminData.announcements, adminData.pagination);
    }
    updateAnnounceBatchBar();
};

window.updateAnnounceBatchBar = () => {
    const bar = document.getElementById('admin-announce-batch-bar');
    const countSpan = document.getElementById('announce-batch-count');
    if (!bar || !countSpan) return;

    if (adminSelectedAnnounceIds.size > 0) {
        countSpan.innerHTML = `已选中 <b>${adminSelectedAnnounceIds.size}</b> 条公告`;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

window.batchAnnounceAction = async (action) => {
    if (adminSelectedAnnounceIds.size === 0) return;
    
    const ids = Array.from(adminSelectedAnnounceIds);
    let msg = "";
    if (action === 'delete') msg = `确定要批量删除这 ${ids.length} 条公告吗？此操作不可撤销！`;
    else if (action === 'publish') msg = `确定要批量发布这 ${ids.length} 条公告吗？`;
    else if (action === 'archive') msg = `确定要批量归档这 ${ids.length} 条公告吗？`;
    
    if (msg && !confirm(msg)) return;

    await SyncUI.perform('ADMIN_ANNOUNCE', async () => {
        // 依次处理或批量处理 (目前后端暂未提供批量接口，采用循环或批量更新 API)
        // 为了演示效果，这里先用循环，生产环境建议增加批量 API
        for (const id of ids) {
            if (action === 'delete') {
                await fetch('/api/admin/announcements', {
                    method: 'DELETE',
                    headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
            } else {
                await fetch('/api/admin/announcements', {
                    method: 'PATCH',
                    headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: action === 'publish' ? 'published' : 'archived' })
                });
            }
        }
        showToast("批量操作完成", "#2ecc71");
        adminSelectedAnnounceIds.clear();
        performAdminAnnounceSearch();
    });
};

// Task STD.2: 邀请管理交互逻辑
window.toggleInviteSearch = () => {
    const body = document.getElementById('invite-search-body');
    const arrow = document.getElementById('invite-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminInviteSearch = async () => {
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.style.opacity = '0.5';
    
    try {
        const query = new URLSearchParams({
            page: adminInviteFilters.page,
            pageSize: adminInviteFilters.pageSize,
            keyword: adminInviteFilters.keyword,
            status: adminInviteFilters.status
        });
        const res = await fetch(`/api/admin/invitations?${query.toString()}`, {
            headers: { 'Authorization': sysToken }
        });
        const data = await res.json();
        if (data.success) {
            adminData.invitations = data.invitations;
            if (container) {
                container.innerHTML = renderAdminInviteTableHTML(data.invitations, data.pagination);
                container.style.opacity = '1';
                updateInviteBatchBar();
            }
        }
    } catch (e) {
        showToast("加载邀请码失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminInviteSearch = debounce((val) => {
    adminInviteFilters.keyword = val.trim();
    adminInviteFilters.page = 1;
    performAdminInviteSearch();
}, 400);

window.handleAdminInviteFilter = (type, val) => {
    adminInviteFilters[type] = val;
    adminInviteFilters.page = 1;
    performAdminInviteSearch();
};

window.handleAdminInvitePageChange = (page) => {
    adminInviteFilters.page = page;
    performAdminInviteSearch();
};

const renderAdminInviteTableHTML = (list, pagination) => {
    const isAllSelected = list.length > 0 && list.every(i => adminSelectedInviteIds.has(i.code));
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminInviteSelectAll(this.checked)">
                        </th>
                        <th>邀请码</th>
                        <th>状态</th>
                        <th>使用者</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:30px; opacity:0.5;">暂无邀请码</td></tr>' : 
                      list.map(i => `
                        <tr class="${adminSelectedInviteIds.has(i.code) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${adminSelectedInviteIds.has(i.code) ? 'checked' : ''} onchange="toggleAdminInviteSelect('${i.code}', this.checked)">
                            </td>
                            <td class="code-font" style="font-weight:bold; letter-spacing:1px;">${i.code}</td>
                            <td><span class="status-badge ${i.status}">${i.status === 'unused' ? '未使用' : '已使用'}</span></td>
                            <td>${i.used_by_name ? `<b>${escapeHTML(i.used_by_name)}</b>` : '<span style="opacity:0.3">-</span>'}</td>
                            <td><small style="opacity:0.6">${formatSystemDate(i.created_at, false)}</small></td>
                            <td>
                                <button class="action-link" onclick="copySingleInvite('${i.code}')" title="复制">
                                    <i class="ri-file-copy-line"></i>
                                </button>
                                ${i.status === 'unused' ? `
                                    <button class="action-link danger" onclick="deleteInvite('${i.code}')" title="删除" style="margin-left:8px;">
                                        <i class="ri-delete-bin-line"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="admin-pagination">
            <div class="pagination-info">共 <b>${total}</b> 条</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminInvitePageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminInvitePageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.toggleAdminInviteSelect = (code, checked) => {
    if (checked) adminSelectedInviteIds.add(code);
    else adminSelectedInviteIds.delete(code);
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.innerHTML = renderAdminInviteTableHTML(adminData.invitations, { ...adminData.pagination, page: adminInviteFilters.page });
    updateInviteBatchBar();
};

window.toggleAdminInviteSelectAll = (checked) => {
    if (checked) adminData.invitations.forEach(i => adminSelectedInviteIds.add(i.code));
    else adminSelectedInviteIds.clear();
    const container = document.getElementById('admin-invite-table-container');
    if (container) container.innerHTML = renderAdminInviteTableHTML(adminData.invitations, { ...adminData.pagination, page: adminInviteFilters.page });
    updateInviteBatchBar();
};

window.updateInviteBatchBar = () => {
    const bar = document.getElementById('admin-invite-batch-bar');
    const countSpan = document.getElementById('invite-batch-count');
    if (!bar || !countSpan) return;

    if (adminSelectedInviteIds.size > 0) {
        countSpan.innerHTML = `已选中 <b>${adminSelectedInviteIds.size}</b> 个邀请码`;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

window.batchInviteAction = async (action) => {
    if (adminSelectedInviteIds.size === 0) return;
    const codes = Array.from(adminSelectedInviteIds);
    if (action === 'delete' && !confirm(`确定要批量下架这 ${codes.length} 个未使用邀请码吗？`)) return;

    await SyncUI.perform('INVITE_BATCH', async () => {
        for (const code of codes) {
            await fetch('/api/admin/invitations', {
                method: 'DELETE',
                headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
        }
        showToast("批量下架完成", "#2ecc71");
        adminSelectedInviteIds.clear();
        performAdminInviteSearch();
    });
};

// Task STD.3: 审计日志交互逻辑
window.toggleAuditSearch = () => {
    const body = document.getElementById('audit-search-body');
    const arrow = document.getElementById('audit-search-arrow');
    if (!body || !arrow) return;
    const isCollapsed = body.classList.toggle('collapsed');
    arrow.className = isCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
};

const performAdminAuditSearch = async () => {
    const container = document.getElementById('admin-audit-table-container');
    if (container) container.style.opacity = '0.5';
    
    try {
        const query = new URLSearchParams({
            page: adminAuditFilters.page,
            pageSize: adminAuditFilters.pageSize,
            keyword: adminAuditFilters.keyword,
            actionType: adminAuditFilters.actionType
        });
        const res = await fetch(`/api/admin/audit-logs?${query.toString()}`, {
            headers: { 'Authorization': sysToken }
        });
        const data = await res.json();
        if (data.success) {
            adminData.logs = data.logs;
            if (container) {
                container.innerHTML = renderAdminAuditTableHTML(data.logs, data.pagination);
                container.style.opacity = '1';
            }
        }
    } catch (e) {
        showToast("加载日志失败: " + e.message, "#e74c3c");
    }
};

window.handleAdminAuditSearch = debounce((val) => {
    adminAuditFilters.keyword = val.trim();
    adminAuditFilters.page = 1;
    performAdminAuditSearch();
}, 400);

window.handleAdminAuditFilter = (type, val) => {
    adminAuditFilters[type] = val;
    adminAuditFilters.page = 1;
    performAdminAuditSearch();
};

window.handleAdminAuditPageChange = (page) => {
    adminAuditFilters.page = page;
    performAdminAuditSearch();
};

const renderAdminAuditTableHTML = (logs, pagination) => {
    const { total, page, pageSize } = pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width:100px;">记录时间</th>
                        <th>操作人</th>
                        <th>动作</th>
                        <th>详情</th>
                        <th>来源 IP</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:30px; opacity:0.5;">暂无日志数据</td></tr>' : 
                      logs.map(l => {
                        const dateStr = formatSystemDate(l.created_at, false);
                        const tz = window.sysSiteConfig?.systemTimezone || 'Asia/Shanghai';
                        let timeStr = '';
                        try {
                            const dateObj = window.parseUtcDate(l.created_at);
                            timeStr = dateObj.toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false });
                        } catch (e) {
                            timeStr = new Date(l.created_at).toLocaleTimeString('zh-CN', { hour12: false });
                        }
                        const actionInfo = AuditActionMap[l.action] || { label: l.action, color: '#3498db' };
                        
                        return `
                        <tr>
                            <td style="font-family:monospace; line-height:1.2;">
                                <div style="font-size:10px; opacity:0.5;">${dateStr}</div>
                                <div style="font-size:12px; font-weight:bold; color:var(--text-main);">${timeStr}</div>
                            </td>
                            <td style="font-weight:bold;" title="用户内部 ID: ${l.user_id}">${escapeHTML(l.operator_name || 'System')}</td>
                            <td>
                                <span class="status-badge" style="background:rgba(255,255,255,0.05); color:${actionInfo.color}; border:1px solid ${actionInfo.color}44; white-space:nowrap;" title="原始动作: ${l.action}">
                                    ${actionInfo.label}
                                </span>
                            </td>
                            <td style="font-size:11px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(l.details || '')}">
                                ${escapeHTML(l.details || '-')}
                            </td>
                            <td style="font-size:10px; opacity:0.5; font-family:monospace;">${l.ip}</td>
                        </tr>
                        `;
                      }).join('')}
                </tbody>
            </table>
        </div>
        <div class="admin-pagination">
            <div class="pagination-info">共 <b>${total}</b> 条日志</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminAuditPageChange(${page - 1})"><i class="ri-arrow-left-s-line"></i></button>
                <span style="font-size:12px;">${page} / ${totalPages || 1}</span>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminAuditPageChange(${page + 1})"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        </div>
    `;
};

window.handleAdminPageChange = (page) => {
    adminUserFilters.page = page;
    performAdminUserSearch();
};

window.handleAdminPageSizeChange = (size) => {
    adminUserFilters.pageSize = parseInt(size);
    adminUserFilters.page = 1;
    performAdminUserSearch();
};

const renderAdminUserTableHTML = (users) => {
    const isAllSelected = users.length > 0 && users.every(u => adminSelectedUserIds.has(u.id));
    const { total, page, pageSize } = adminData.pagination || { total: 0, page: 1, pageSize: 20 };
    const totalPages = Math.ceil(total / pageSize);

    return `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="toggleAdminSelectAll(this.checked)">
                        </th>
                        <th>用户名</th>
                        <th>角色</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:30px; opacity:0.5;">未找到匹配的用户</td></tr>' : 
                      users.map(u => `
                        <tr class="${adminSelectedUserIds.has(u.id) ? 'selected' : ''}">
                            <td class="col-checkbox">
                                <input type="checkbox" ${adminSelectedUserIds.has(u.id) ? 'checked' : ''} onchange="toggleAdminUserSelect('${u.id}', this.checked)">
                            </td>
                            <td>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${escapeHTML(u.username)}</span>
                                    <span style="font-size:10px; opacity:0.5; font-family:monospace;" title="完整内部 ID: ${u.id}">${u.uid || u.id?.substring(0, 8) || '---'}</span>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge ${u.role}">${u.role.toUpperCase()}</span>
                            </td>
                            <td><span class="status-badge ${u.status}">${u.status}</span></td>
                            <td>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    ${u.role === 'admin' ? '-' : `
                                        <button class="action-link" onclick="updateUserAdmin('${u.id}', { status: '${u.status === 'active' ? 'frozen' : 'active'}' })" title="${u.status === 'active' ? '冻结账号' : '激活账号'}">
                                            <i class="${u.status === 'active' ? 'ri-user-forbid-line' : 'ri-user-follow-line'}"></i>
                                        </button>
                                        <button class="action-link" onclick="resetUserPasswordAdmin('${u.id}')" title="重置密码">
                                            <i class="ri-key-2-line"></i>
                                        </button>
                                        <button class="action-link danger" onclick="deleteUserAdmin('${u.id}')" title="删除用户">
                                            <i class="ri-delete-bin-line"></i>
                                        </button>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Task UM.5: 分页控制 -->
        <div class="admin-pagination">
            <div class="pagination-info">
                共 <b>${total}</b> 条数据，每页 
                <select style="width:auto; padding:2px 5px; height:24px; font-size:11px;" onchange="handleAdminPageSizeChange(this.value)">
                    <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select> 条
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminPageChange(1)" title="第一页"><i class="ri-arrow-left-double-line"></i></button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="handleAdminPageChange(${page - 1})" title="上一页"><i class="ri-arrow-left-s-line"></i></button>
                
                <span style="font-size:12px; margin:0 10px;">第 <b>${page}</b> / ${totalPages || 1} 页</span>

                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminPageChange(${page + 1})" title="下一页"><i class="ri-arrow-right-s-line"></i></button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="handleAdminPageChange(${totalPages})" title="末页"><i class="ri-arrow-right-double-line"></i></button>
            </div>
        </div>
    `;
};

// Task UM.4: 多选与批量操作逻辑
window.toggleAdminUserSelect = (userId, checked) => {
    if (checked) adminSelectedUserIds.add(userId);
    else adminSelectedUserIds.delete(userId);
    
    // 局部更新表格行样式而不重绘整个表格（优化性能）
    const container = document.getElementById('admin-users-table-container');
    if (container) {
        container.innerHTML = renderAdminUserTableHTML(adminData.users);
    }
    updateAdminBatchBar();
};

window.toggleAdminSelectAll = (checked) => {
    if (checked) {
        adminData.users.forEach(u => adminSelectedUserIds.add(u.id));
    } else {
        adminData.users.forEach(u => adminSelectedUserIds.delete(u.id));
    }
    const container = document.getElementById('admin-users-table-container');
    if (container) {
        container.innerHTML = renderAdminUserTableHTML(adminData.users);
    }
    updateAdminBatchBar();
};

window.updateAdminBatchBar = () => {
    let bar = document.getElementById('admin-user-batch-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'admin-user-batch-bar';
        bar.className = 'user-batch-bar';
        document.body.appendChild(bar);
    }

    if (adminSelectedUserIds.size > 0) {
        bar.innerHTML = `
            <span>已选中 <b>${adminSelectedUserIds.size}</b> 名用户</span>
            <div class="batch-btns">
                <button class="batch-action-btn" onclick="exportUsersCSV()">CSV 导出</button>
                <button class="batch-action-btn" onclick="adminSelectedUserIds.clear(); updateAdminBatchBar(); const container = document.getElementById('admin-users-table-container'); if(container) container.innerHTML = renderAdminUserTableHTML(adminData.users);">取消选择</button>
            </div>
        `;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

// Task UM.6: CSV 批量导出实现
window.exportUsersCSV = () => {
    if (adminSelectedUserIds.size === 0) return showToast("请先选择要导出的用户", "#e67e22");

    const selectedUsers = adminData.users.filter(u => adminSelectedUserIds.has(u.id));
    
    // 1. 构建 CSV 内容
    const headers = ['ID', 'UUID', 'Username', 'Role', 'Status', 'Last Login', 'Created At'];
    const rows = selectedUsers.map(u => [
        u.id,
        u.uid,
        u.username,
        u.role,
        u.status,
        u.last_login || '-',
        u.created_at
    ]);

    let csvContent = "\ufeff"; // 添加 BOM 支持中文 Excel
    csvContent += headers.join(',') + "\n";
    rows.forEach(row => {
        csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + "\n";
    });

    // 2. 触发下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `CloudNav_Users_Export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`成功导出 ${selectedUsers.size} 条记录`, "#2ecc71");
};

window.switchHubTab = (tab) => {
    document.querySelectorAll('.hub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.hub-pane').forEach(p => p.classList.toggle('active', p.id === `hub-content-${tab}`));
    
    if (tab !== 'users' && tab !== 'announcements' && tab !== 'invites') {
        const userBar = document.getElementById('admin-user-batch-bar');
        const announceBar = document.getElementById('admin-announce-batch-bar');
        const inviteBar = document.getElementById('admin-invite-batch-bar');
        if (userBar) userBar.classList.remove('visible');
        if (announceBar) announceBar.classList.remove('visible');
        if (inviteBar) inviteBar.classList.remove('visible');
    } else if (tab === 'users') {
        updateAdminBatchBar();
        const announceBar = document.getElementById('admin-announce-batch-bar');
        const inviteBar = document.getElementById('admin-invite-batch-bar');
        if (announceBar) announceBar.classList.remove('visible');
        if (inviteBar) inviteBar.classList.remove('visible');
    } else if (tab === 'announcements') {
        updateAnnounceBatchBar();
        const userBar = document.getElementById('admin-user-batch-bar');
        const inviteBar = document.getElementById('admin-invite-batch-bar');
        if (userBar) userBar.classList.remove('visible');
        if (inviteBar) inviteBar.classList.remove('visible');
    } else if (tab === 'invites') {
        updateInviteBatchBar();
        const userBar = document.getElementById('admin-user-batch-bar');
        const announceBar = document.getElementById('admin-announce-batch-bar');
        if (userBar) userBar.classList.remove('visible');
        if (announceBar) announceBar.classList.remove('visible');
    }
};

window.generateInvites = async (count) => {
    await SyncUI.perform('INVITE_GEN', async () => {
        const res = await fetch('/api/admin/invitations', {
            method: 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '生成失败');
        }
        openAdminHub('invites');
    });
};

window.deleteInvite = async (code) => {
    if (!confirm("确定要删除此邀请码吗？")) return;
    await SyncUI.perform('INVITE_DEL', async () => {
        const res = await fetch('/api/admin/invitations', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (!res.ok) throw new Error("删除失败");
        openAdminHub('invites');
    });
};

window.updateUserAdmin = async (userId, payload) => {
    // Task UM.8.5: 统一二次验证逻辑
    const adminPassword = prompt("执行管理操作，请输入您的管理员密码进行二次验证:");
    if (adminPassword === null) return;
    if (!adminPassword) return showToast("请输入密码以继续", "#e67e22");

    await SyncUI.perform('USER_MANAGE', async () => {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...payload, adminPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "操作失败");
        performAdminUserSearch(); // 局部刷新
    });
};

window.resetUserPasswordAdmin = async (userId) => {
    const newPassword = prompt("请输入为该用户设置的新密码:");
    if (!newPassword) return;
    
    const adminPassword = prompt("请输入您的管理员密码确认修改:");
    if (!adminPassword) return;

    await SyncUI.perform('USER_MANAGE', async () => {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newPassword, adminPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "重置失败");
        showToast("密码已重置", "#2ecc71");
    });
};

window.deleteUserAdmin = async (userId) => {
    if (!confirm("⚠️ 警告：删除用户将永久清除其所有数据（分类、书签、设置），且不可恢复！确认删除吗？")) return;

    const adminPassword = prompt("【最后确认】请输入您的管理员密码执行删除操作:");
    if (!adminPassword) return;

    await SyncUI.perform('USER_MANAGE', async () => {
        const res = await fetch('/api/admin/users', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, adminPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "删除失败");
        showToast("用户已删除", "#2ecc71");
        performAdminUserSearch();
    });
};

window.saveAnnouncement = async () => {
    const isEdit = currentEditingAnnounceId !== null;
    const isDraft = document.getElementById('announce-is-draft')?.checked;
    const payload = {
        id: isEdit ? Number(currentEditingAnnounceId) : null,
        title: document.getElementById('announce-title').value.trim(),
        content: document.getElementById('announce-content').value.trim(),
        type: document.getElementById('announce-type').value,
        expire_at: document.getElementById('announce-expire').value,
        is_top: document.getElementById('announce-top').checked,
        status: isDraft ? 'draft' : 'published'
    };

    if (!payload.title || !payload.content) return showToast("标题和内容不能为空", "#e67e22");
    if (!sysToken) return showToast("登录已失效，请重新登录", "#e74c3c");

    await SyncUI.perform('ANNOUNCE_SAVE', async () => {
        const res = await fetch('/api/admin/announcements', {
            method: isEdit ? 'PATCH' : 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "发布失败");
        showToast(isEdit ? "公告已更新" : "公告已发布", "#2ecc71");
        cancelEditAnnounce();
        performAdminAnnounceSearch();
        initAnnouncements();
    });
};

window.deleteAnnouncement = async (id) => {
    if (!confirm("确定要删除这条公告吗？")) return;
    await SyncUI.perform('ANNOUNCE_DEL', async () => {
        const res = await fetch('/api/admin/announcements', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error("下架失败");
        showToast("公告已删除", "#2ecc71");
        performAdminAnnounceSearch();
        initAnnouncements();
    });
};

window.editAnnouncement = (a) => {
    currentEditingAnnounceId = a.id;
    document.getElementById('announce-title').value = a.title;
    document.getElementById('announce-content').value = a.content;
    document.getElementById('announce-type').value = a.type;
    document.getElementById('announce-top').checked = a.is_top === 1;
    
    if (a.expire_at) {
        // 将数据库时间格式转换为 datetime-local 接受的格式 (YYYY-MM-DDTHH:MM)
        const date = new Date(a.expire_at);
        const isoStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('announce-expire').value = isoStr;
    } else {
        document.getElementById('announce-expire').value = '';
    }

    // UI 状态切换
    document.getElementById('btn-save-announce').innerText = "确认保存修改";
    document.getElementById('btn-save-announce').classList.add('warning-btn'); // 提示是修改操作
    document.getElementById('btn-cancel-announce').style.display = 'inline-block';
    
    // 平滑滚动到编辑器区域
    const editor = document.querySelector('.admin-announce-editor');
    if (editor) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelEditAnnounce = () => {
    currentEditingAnnounceId = null;
    document.getElementById('announce-title').value = '';
    document.getElementById('announce-content').value = '';
    document.getElementById('announce-type').value = 'quiet';
    document.getElementById('announce-expire').value = '';
    document.getElementById('announce-top').checked = false;

    document.getElementById('btn-save-announce').innerText = "发布公告";
    document.getElementById('btn-save-announce').classList.remove('warning-btn');
    document.getElementById('btn-cancel-announce').style.display = 'none';
};

window.formatMonacoJson = () => {
    if (!monacoEditor) return;
    try {
        const val = monacoEditor.getValue();
        const obj = JSON.parse(val);
        monacoEditor.setValue(JSON.stringify(obj, null, 4));
        showToast("已完成格式化");
    } catch (e) {
        showToast("JSON 格式错误，无法格式化", "#e74c3c");
    }
};

window.copyUnusedInvites = async () => {
    // Task 15.2: 改为从内存数据读取，彻底解耦 DOM
    const allInvites = adminData.invitations || [];
    const unused = allInvites.filter(i => i.status === 'unused').map(i => i.code);
        
    if (allInvites.length === 0) return showToast("当前没有任何邀请码", "#e67e22");
    if (unused.length === 0) return showToast("所有邀请码均已被使用", "#e67e22");
    
    await SyncUI.perform('CLIPBOARD', async () => {
        await navigator.clipboard.writeText(unused.join('\n'));
    });
};

window.copySingleInvite = async (code) => {
    await SyncUI.perform('CLIPBOARD', async () => {
        await navigator.clipboard.writeText(code);
    });
};

window.toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    if (!confirm(`确定要将该用户设为 ${newStatus} 吗？`)) return;

    await SyncUI.perform('USER_MANAGE', async () => {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status: newStatus })
        });
        if (!res.ok) throw new Error("操作失败");
        openAdminHub('users'); // 刷新并停留在用户管理
    });
};

// Task 6.8: 公告中心交互逻辑
window.openNoticeCenter = async (targetId = null) => {
    lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6: 互斥显示
    closeAllModals();

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

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
        const isGuest = !sysToken;

        body.innerHTML = `
            <div class="notice-center-header">
                <div class="notice-header-actions">
                    <label class="toggle-hide-read" ${isGuest ? 'style="opacity:0.5; cursor:not-allowed;" title="登录后可同步阅读状态"' : ''}>
                        <input type="checkbox" ${hideRead ? 'checked' : ''} ${isGuest ? 'disabled' : 'onchange="toggleHideRead(this.checked)"'}> 隐藏已读
                    </label>
                    ${isGuest 
                        ? `<button class="btn-mark-all-read guest-mode" onclick="openLoginModal()">登录同步状态</button>`
                        : (unreadCount > 0 ? `<button class="btn-mark-all-read" onclick="markAllNoticesRead()">全部标记已读</button>` : '')
                    }
                </div>
                ${isGuest ? `<div style="font-size: 11px; color: #f1c40f; margin-bottom: 5px;"><i class="ri-information-line"></i> 您当前以游客身份访问，阅读记录无法持久化</div>` : ''}
                <div style="font-size: 12px; opacity: 0.5;">共 ${announcements.length} 条公告</div>
            </div>
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
            headers: sysToken ? { 'Authorization': `Bearer ${sysToken}` } : {}
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        if (data && Array.isArray(data.announcements)) {
            cachedAnnouncements = data.announcements;
            renderList(cachedAnnouncements);

            // Task 37.2: 自动聚焦第一个项
            setTimeout(() => {
                modal.querySelector('.notice-list-item')?.focus();
            }, 50);
            
            // Task 37.2: 自动聚焦第一个 Tab
            setTimeout(() => {
                modal.querySelector('.hub-tab')?.focus();
            }, 50);
        } else {
            throw new Error('Invalid data format');
        }
    } catch (e) {
        console.error('[Notice Center] Error:', e);
        if (cachedAnnouncements && cachedAnnouncements.length > 0) {
            showToast("使用本地缓存数据...", "#e67e22");
            renderList(cachedAnnouncements);
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

window.toggleNotice = async (el, id) => {
    const isExpanded = el.classList.contains('is-expanded');
    
    // 折叠其他已展开的 (Accordion 模式)
    document.querySelectorAll('.notice-list-item.is-expanded').forEach(item => {
        if (item !== el) item.classList.remove('is-expanded');
    });

    el.classList.toggle('is-expanded');

    // 如果是第一次展开且未读，标记为已读 (Task 7.3: 游客也可在本地标记已读)
    const isUnread = el.classList.contains('is-unread');
    if (!isExpanded && isUnread) {
        el.classList.remove('is-unread');
        el.classList.add('is-read');
        const badge = el.querySelector('.badge-new');
        if (badge) badge.remove();
        
        // 记录到本地，消除红点
        localStorage.setItem(`read_notice_${id}`, 'true');
        const notice = cachedAnnouncements.find(a => a.id == id);
        if (notice) notice.is_read = 1;

        // Task 7.4: 立即刷新全局 Badge
        refreshNoticeBadge();
        
        if (sysToken) {
            try {
                await fetch('/api/announcements/read', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sysToken}`, 'Content-Type': 'application/json' },
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
    
    // Task 6.31: 切换隐藏状态后同步刷新 Badge 状态 (仅针对已读项被过滤的情况)
    refreshNoticeBadge();
};

window.markAllNoticesRead = async () => {
    if (!cachedAnnouncements.length) return;
    
    const unreadIds = cachedAnnouncements.filter(a => !(a.is_read || localStorage.getItem(`read_notice_${a.id}`))).map(a => a.id);
    if (unreadIds.length === 0) return;

    unreadIds.forEach(id => localStorage.setItem(`read_notice_${id}`, 'true'));
    cachedAnnouncements.forEach(a => { if (unreadIds.includes(a.id)) a.is_read = 1; });
    
    showToast("已全部标记为已读");
    refreshNoticeBadge();
    
    if (sysToken) {
        try {
            await fetch('/api/announcements/read', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sysToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
        } catch (e) { console.warn('[Notice] Sync bulk read failed'); }
    }
    
    openNoticeCenter(); // 刷新列表状态
};

// Task 13.3: 移除冗余的 saveSiteConfig (已由 saveSystemConfig 接管)

// ==================== 11. Task 3.5: JSON 专家模式 & 导入导出 ====================

let monacoEditor = null;

const openJsonEditor = () => {
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = "JSON 专家模式 (专家级定制)";
    body.innerHTML = `
        <div style="margin-bottom: 10px; display:flex; gap:10px;">
            <button class="action-link" onclick="formatMonacoJson()"><i class="ri-magic-line"></i> 一键美化</button>
            <span style="color:var(--text-dim); font-size:12px;">提示: 修改后点击下方“应用”保存到云端</span>
        </div>
        <div id="monaco-container" style="height: 400px; border-radius: 8px; overflow: hidden; border: 1px solid var(--glass-border);"></div>
    `;
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = "应用并同步到云端";

    // 异步初始化 Monaco
    if (typeof require !== 'undefined') {
        require.config({ paths: { 'vs': 'https://lib.baomitu.com/monaco-editor/0.45.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            if (monacoEditor) monacoEditor.dispose();
            monacoEditor = monaco.editor.create(document.getElementById('monaco-container'), {
                value: JSON.stringify(appData, null, 4),
                language: 'json',
                theme: themeMode === 'dark' ? 'vs-dark' : 'vs',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13
            });
        });
    } else {
        body.innerHTML = '<div class="error-text">Monaco Editor 脚本加载失败，请检查网络。</div>';
    }

    confirmBtn.onclick = async () => {
        if (!monacoEditor) return;
        try {
            const raw = monacoEditor.getValue();
            const parsed = JSON.parse(raw);
            
            // 简单结构校验
            if (!parsed.categories || !parsed.items) throw new Error("缺少核心字段 (categories/items)");
            
            // Task 4.3: 专家模式配额校验
            const quota = appData.quota || { maxCategories: 8, maxItemsPerCategory: 15 };
            if (parsed.categories.length > quota.maxCategories) throw new Error(`分类数量超出上限 (${quota.maxCategories})`);
            for (const cat of parsed.categories) {
                const count = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
                if (count > quota.maxItemsPerCategory) throw new Error(`分类 [${cat.name}] 下的书签数量 (${count}) 超出上限 (${quota.maxItemsPerCategory})`);
            }

            appData = parsed;
            showLoader('正在同步专家配置...');
            await syncConfigToCloud();
            renderNav();
            modal.style.display = 'none';
        } catch (e) {
            showToast(`JSON 格式错误: ${e.message}`, "#e74c3c");
        } finally {
            hideLoader();
        }
    };
};

let currentImportExportMode = 'import'; // 'import' | 'export'
let currentExportFormat = 'json'; // 'json' | 'html'

const openImportExportModal = () => {
    lastFocusedElement = document.activeElement;
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerHTML = `<i class="ri-database-2-line"></i> 本地导入/导出`;
    
    currentImportExportMode = 'import';
    currentExportFormat = 'json';

    const renderModalBody = () => {
        body.innerHTML = `
            <div class="visual-option-group">
                <span class="visual-option-label"><i class="ri-swap-line"></i> 选择操作类型</span>
                <div class="visual-btn-group">
                    <button class="tab-btn ${currentImportExportMode === 'import' ? 'active' : ''}" onclick="setImportExportMode('import')">导入数据</button>
                    <button class="tab-btn ${currentImportExportMode === 'export' ? 'active' : ''}" onclick="setImportExportMode('export')">导出数据</button>
                </div>
            </div>
            
            <div class="visual-option-group" id="export-format-group" style="${currentImportExportMode === 'export' ? 'display: block;' : 'display: none;'}">
                <span class="visual-option-label"><i class="ri-file-settings-line"></i> 选择数据格式</span>
                <div class="visual-btn-group">
                    <button class="tab-btn ${currentExportFormat === 'json' ? 'active' : ''}" onclick="setExportFormat('json')">JSON 格式</button>
                    <button class="tab-btn ${currentExportFormat === 'html' ? 'active' : ''}" onclick="setExportFormat('html')">Edge浏览器收藏夹格式</button>
                </div>
                <p style="font-size: 11px; opacity: 0.6; margin-top: 8px; line-height: 1.4;">
                    ${currentExportFormat === 'json' 
                        ? '说明: 包含所有配置、分类和网址的完整数据。可再次导入本站100%还原。' 
                        : '说明: 导出为标准 HTML 书签文件，可直接导入到 Edge, Chrome 等浏览器。'}
                </p>
            </div>
            
            <div class="visual-option-group" id="import-tip-group" style="${currentImportExportMode === 'import' ? 'display: block;' : 'display: none;'}">
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; font-size: 12px; color: var(--text-dim); line-height: 1.5;">
                    <i class="ri-information-line" style="color: var(--primary);"></i> 
                    智能导入适配器支持导入标准 HTML 书签、本站导出的 JSON 文件以及 Markdown 列表等。导入后将覆写本地当前所有配置。
                </div>
            </div>
        `;

        if (currentImportExportMode === 'import') {
            confirmBtn.innerHTML = `<i class="ri-upload-2-line"></i> 选择文件并导入`;
            confirmBtn.onclick = () => {
                document.getElementById('import-file').click();
            };
        } else {
            confirmBtn.innerHTML = `<i class="ri-download-2-line"></i> 确认导出本地文件`;
            confirmBtn.onclick = () => {
                if (currentExportFormat === 'json') {
                    doExportJson();
                } else {
                    doExportHtml('clean');
                }
            };
        }
    };

    window.setImportExportMode = (mode) => {
        currentImportExportMode = mode;
        renderModalBody();
    };

    window.setExportFormat = (format) => {
        currentExportFormat = format;
        renderModalBody();
    };

    renderModalBody();
    modal.style.display = 'flex';
};

const exportConfig = () => {
    closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerHTML = '<i class="ri-download-2-line"></i> 本地数据导出向导';
    
    body.innerHTML = `
        <div style="margin-bottom: 15px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; font-size: 13px; color: var(--text-dim); line-height: 1.5;">
            <i class="ri-information-line" style="color: var(--primary);"></i> 
            本地导出可将您自定义的导航数据下载到本地。如需在云端备份，请使用侧边栏的 <strong>云端备份中心</strong>。
        </div>

        <div class="form-row" style="margin-bottom: 15px;">
            <label style="font-weight: bold; margin-bottom: 8px; display: block;"><i class="ri-file-settings-line"></i> 选择导出格式</label>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <label style="display: flex; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--glass-border);">
                    <input type="radio" name="export-format" value="json" checked style="margin-top: 3px;" onchange="toggleExportOptions(this.value)">
                    <div style="margin-left: 8px;">
                        <div style="font-weight: bold; color: #fff;">原生 JSON 备份文件</div>
                        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">包含所有配置、分类和网址的完整数据。可再次通过“本地数据导入”来100%还原。</div>
                    </div>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--glass-border);">
                    <input type="radio" name="export-format" value="html" style="margin-top: 3px;" onchange="toggleExportOptions(this.value)">
                    <div style="margin-left: 8px;">
                        <div style="font-weight: bold; color: #fff;">标准 HTML 书签文件</div>
                        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">导出为 Netscape 格式，可直接导入到 Edge, Chrome, Safari 等浏览器。</div>
                    </div>
                </label>
            </div>
        </div>

        <div id="html-export-suboptions" class="form-row" style="margin-bottom: 15px; display: none; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; border-left: 3px solid var(--primary);">
            <label style="font-weight: bold; margin-bottom: 8px; display: block;"><i class="ri-settings-4-line"></i> HTML 书签配置选项</label>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                    <input type="radio" name="html-mode" value="clean" checked style="margin-top: 2px;">
                    <div style="margin-left: 6px;">
                        <span style="font-weight: bold; color: #fff;">清爽模式 (强烈推荐 ⭐)</span>
                        <div style="color: var(--text-dim); font-size: 11px; margin-top: 2px;">
                            Edge 导入后书签只显示短标题，不会把网址描述拼到标题里。描述将存放在标准 &lt;DD&gt; 标签与 comment 属性中，干净且支持重新导入本站还原。
                        </div>
                    </div>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; margin-top: 4px;">
                    <input type="radio" name="html-mode" value="merge" style="margin-top: 2px;">
                    <div style="margin-left: 6px;">
                        <span style="font-weight: bold; color: #fff;">标题拼接模式</span>
                        <div style="color: var(--text-dim); font-size: 11px; margin-top: 2px;">
                            将描述内容合并写入书签标题中（形如：'标题 - 描述'）。适合不支持显示描述的极简浏览器书签栏，但会导致 Edge 收藏夹里的标题极其冗长。
                        </div>
                    </div>
                </label>
            </div>
        </div>
    `;

    // 挂载全局切换函数供 DOM 触发
    window.toggleExportOptions = (val) => {
        const subOpts = document.getElementById('html-export-suboptions');
        if (subOpts) {
            subOpts.style.display = (val === 'html') ? 'block' : 'none';
        }
    };

    confirmBtn.innerText = "确认导出本地文件";
    confirmBtn.onclick = () => {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'json';
        if (format === 'json') {
            doExportJson();
        } else {
            const htmlMode = document.querySelector('input[name="html-mode"]:checked')?.value || 'clean';
            doExportHtml(htmlMode);
        }
    };

    modal.style.display = 'flex';
};

const doExportJson = () => {
    try {
        const date = new Date();
        const filename = `CloudNav_Config_${date.getMonth() + 1}${date.getDate()}.json`;
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        closeAllModals(true);
        showToast("本地 JSON 配置导出成功");
    } catch (e) {
        console.error(e);
        showToast(`导出失败: ${e.message}`, "#e74c3c");
    }
};

const doExportHtml = (htmlMode) => {
    try {
        const date = new Date();
        const filename = `CloudNav_Bookmarks_${date.getMonth() + 1}${date.getDate()}.html`;
        
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and written.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

        // 遍历分类
        if (appData.categories && appData.categories.length > 0) {
            appData.categories.forEach(cat => {
                // 跳过加载中临时分类
                if (cat.id === 'temp_init') return;
                
                const catName = escapeHTML(cat.name || '默认分类');
                html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}" LAST_MODIFIED="${Math.floor(Date.now()/1000)}">${catName}</H3>\n`;
                html += `    <DL><p>\n`;
                
                // 筛选出属于此分类的书签
                const items = appData.items.filter(item => (item.catId === cat.id || item.cat_id === cat.id));
                items.forEach(item => {
                    const url = escapeHTML(item.url || '');
                    if (!url || !url.startsWith('http')) return;
                    
                    let linkText = escapeHTML(item.title || '未命名书签');
                    let commentAttr = '';
                    let descTag = '';
                    
                    if (item.desc) {
                        const cleanDesc = escapeHTML(item.desc);
                        if (htmlMode === 'clean') {
                            // 清爽模式：不拼接标题。把描述放到 comment 属性和 DD 标签里
                            commentAttr = ` comment="${cleanDesc}"`;
                            descTag = `\n        <DD>${cleanDesc}`;
                        } else {
                            // 拼接模式：拼接到标题中
                            linkText = `${linkText} - ${cleanDesc}`;
                        }
                    }
                    
                    let iconAttr = '';
                    if (item.icon && item.icon.startsWith('http')) {
                        iconAttr = ` ICON="${escapeHTML(item.icon)}"`;
                    }
                    
                    html += `        <DT><A HREF="${url}" ADD_DATE="${Math.floor(Date.now()/1000)}"${iconAttr}${commentAttr}>${linkText}</A>${descTag}\n`;
                });
                
                html += `    </DL><p>\n`;
            });
        } else {
            // 没有分类时，输出所有书签
            if (appData.items && appData.items.length > 0) {
                appData.items.forEach(item => {
                    const url = escapeHTML(item.url || '');
                    if (!url || !url.startsWith('http')) return;
                    
                    let linkText = escapeHTML(item.title || '未命名书签');
                    let commentAttr = '';
                    let descTag = '';
                    
                    if (item.desc) {
                        const cleanDesc = escapeHTML(item.desc);
                        if (htmlMode === 'clean') {
                            commentAttr = ` comment="${cleanDesc}"`;
                            descTag = `\n    <DD>${cleanDesc}`;
                        } else {
                            linkText = `${linkText} - ${cleanDesc}`;
                        }
                    }
                    
                    let iconAttr = '';
                    if (item.icon && item.icon.startsWith('http')) {
                        iconAttr = ` ICON="${escapeHTML(item.icon)}"`;
                    }
                    html += `    <DT><A HREF="${url}" ADD_DATE="${Math.floor(Date.now()/1000)}"${iconAttr}${commentAttr}>${linkText}</A>${descTag}\n`;
                });
            }
        }
        
        html += `</DL><p>\n`;
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        closeAllModals(true);
        showToast("HTML书签本地导出成功");
    } catch (e) {
        console.error(e);
        showToast(`导出失败: ${e.message}`, "#e74c3c");
    }
};

const initGlobalEvents = () => {
    // Task 9.4: 全局快捷键监听 (Esc 退出管理模式) - 移除冗余监听器，统一在下方的 document.keydown 中处理
    /* 
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isPageManagementMode) {
            togglePageManagement(false);
        }
    });
    */

    // 快捷导航按钮逻辑 (Task 4.2)
    const fabToTop = document.getElementById('scroll-to-top');
    const fabToBottom = document.getElementById('scroll-to-bottom');
    const fabGroup = document.getElementById('quick-nav-group');
    let fabTimer = null;

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
        }, { passive: true });
    }

    // 监听全局快捷键 (Task 4.2)
    // 注意：这里仅处理基础全局快捷键，复杂的场景流转在下面的 document.keydown 中处理
    window.addEventListener('keydown', (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();
        const isCtrl = e.ctrlKey || e.metaKey;
        
        // 仅保留最核心的、不依赖场景的快捷键，避免与后续监听冲突
        // Ctrl+B 的逻辑已整合到下方的 document.keydown 中，此处移除冲突监听
    });

    // 智能书签自适应解析网关 (Smart Import Adapter)
    const parseImportedData = (rawText) => {
        let text = rawText.trim();
        if (!text) throw new Error("导入内容不能为空");

        // 辅助提取 HTML 标准书签描述
        const getBookmarkDesc = (link) => {
            let desc = link.getAttribute('comment') || '';
            if (desc) return desc.trim();

            let next = link.nextSibling;
            while (next && next.nodeType === 3) {
                next = next.nextSibling;
            }
            if (next && next.tagName === 'DD') {
                return next.textContent.trim();
            }

            const parentDt = link.closest('dt');
            if (parentDt) {
                let nextSibling = parentDt.nextElementSibling;
                if (nextSibling && nextSibling.tagName === 'DD') {
                    return nextSibling.textContent.trim();
                }
            }
            return '';
        };

        // 1. 尝试检测浏览器 HTML 书签文件
        if (text.includes("NETSCAPE-Bookmark-file-1") || /<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(text)) {
            console.log("[Import] Detected Netscape HTML Bookmark format");
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const categories = [];
            const items = [];
            
            // 查找所有文件夹标题 (H3)
            const h3s = doc.querySelectorAll('h3');
            if (h3s.length > 0) {
                h3s.forEach((h3, catIdx) => {
                    const catName = h3.textContent.trim().slice(0, 10) || `分类 ${catIdx + 1}`;
                    const catId = `imported_cat_${catIdx + 1}_${Date.now()}`;
                    categories.push({ id: catId, name: catName, icon: "🔖", hidden: false });
                    
                    // 查找该 H3 同级紧随其后的 <DL> 或 <UL>
                    let sibling = h3.nextElementSibling;
                    while (sibling && sibling.tagName !== 'DL' && sibling.tagName !== 'UL') {
                        sibling = sibling.nextElementSibling;
                    }
                    
                    if (sibling) {
                        const links = sibling.querySelectorAll('a');
                        links.forEach((link, itemIdx) => {
                            const url = link.getAttribute('href');
                            const title = link.textContent.trim().slice(0, 12) || '未命名书签';
                            const desc = getBookmarkDesc(link).slice(0, 30);
                            if (url && url.startsWith('http')) {
                                items.push({
                                    id: `imported_item_${catIdx}_${itemIdx}_${Math.random().toString(36).substring(2, 7)}`,
                                    catId: catId,
                                    cat_id: catId,
                                    title: title,
                                    url: url,
                                    desc: desc,
                                    icon: `https://favicon.qqsuu.cn/${new URL(url).hostname}`,
                                    hidden: false
                                });
                            }
                        });
                    }
                });
            } else {
                // 没有分类文件夹，将所有 a 标签归入默认分类
                const links = doc.querySelectorAll('a');
                if (links.length > 0) {
                    const catId = `imported_cat_default_${Date.now()}`;
                    categories.push({ id: catId, name: "默认导入", icon: "📥", hidden: false });
                    links.forEach((link, itemIdx) => {
                        const url = link.getAttribute('href');
                        const title = link.textContent.trim().slice(0, 12) || '未命名书签';
                        if (url && url.startsWith('http')) {
                            const desc = getBookmarkDesc(link).slice(0, 30);
                            items.push({
                                id: `imported_item_def_${itemIdx}_${Math.random().toString(36).substring(2, 7)}`,
                                catId: catId,
                                cat_id: catId,
                                title: title,
                                url: url,
                                desc: desc,
                                icon: `https://favicon.qqsuu.cn/${new URL(url).hostname}`,
                                hidden: false
                            });
                        }
                    });
                }
            }
            
            if (categories.length > 0) return { categories, items };
            throw new Error("HTML 文件中未解析到有效的 A 标签链接");
        }

        // 2. 尝试 JSON 解析（标准、扁平或键值对）
        try {
            const parsed = JSON.parse(text);
            
            // 2.1 标准 CloudNav 格式
            if (parsed.categories && parsed.items) {
                console.log("[Import] Detected standard CloudNav format");
                return parsed;
            }

            // 2.2 扁平链接数组 [{title, url, desc}]
            if (Array.isArray(parsed)) {
                console.log("[Import] Detected flat JSON array format");
                const catId = `imported_cat_json_${Date.now()}`;
                const categories = [{ id: catId, name: "外部导入", icon: "🔗", hidden: false }];
                const items = parsed.map((item, idx) => {
                    const url = item.url || item.href || (typeof item === 'string' ? item : '');
                    const title = (item.title || item.name || '未命名网址').slice(0, 12);
                    const desc = (item.desc || item.description || '').slice(0, 30);
                    return {
                        id: `imported_item_json_${idx}_${Math.random().toString(36).substring(2, 7)}`,
                        catId: catId,
                        cat_id: catId,
                        title: title,
                        url: url,
                        desc: desc,
                        icon: url ? `https://favicon.qqsuu.cn/${new URL(url).hostname}` : '',
                        hidden: false
                    };
                }).filter(i => i.url && i.url.startsWith('http'));

                return { categories, items };
            }

            // 2.3 分组键值对格式 {"分类1": [{"title": "...", "url": "..."}, ...]}
            if (typeof parsed === 'object' && parsed !== null) {
                console.log("[Import] Detected nested JSON dictionary format");
                const categories = [];
                const items = [];
                let catIdx = 0;
                
                for (const [catName, list] of Object.entries(parsed)) {
                    if (Array.isArray(list)) {
                        const catId = `imported_cat_dict_${catIdx}_${Date.now()}`;
                        categories.push({ id: catId, name: catName.slice(0, 10), icon: "🔖", hidden: false });
                        list.forEach((item, itemIdx) => {
                            const url = item.url || item.href || (typeof item === 'string' ? item : '');
                            const title = (item.title || item.name || '未命名网址').slice(0, 12);
                            const desc = (item.desc || item.description || '').slice(0, 30);
                            if (url && url.startsWith('http')) {
                                items.push({
                                    id: `imported_item_dict_${catIdx}_${itemIdx}_${Math.random().toString(36).substring(2, 7)}`,
                                    catId: catId,
                                    cat_id: catId,
                                    title: title,
                                    url: url,
                                    desc: desc,
                                    icon: `https://favicon.qqsuu.cn/${new URL(url).hostname}`,
                                    hidden: false
                                });
                            }
                        });
                        catIdx++;
                    }
                }
                if (categories.length > 0) {
                    return { categories, items };
                }
            }
        } catch (e) {
            // JSON 解析失败，落入文本解析
        }

        // 3. 文本行解析 (Markdown 格式 [Title](URL) 或直接每行一个 URL)
        console.log("[Import] Falling back to plain text line-by-line parser");
        const categories = [];
        const items = [];
        const lines = text.split('\n');
        const catId = `imported_cat_txt_${Date.now()}`;
        categories.push({ id: catId, name: "文本导入", icon: "📝", hidden: false });
        
        let itemIdx = 0;
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            // 匹配 Markdown 格式: [微博](https://weibo.com)
            const mdMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
            if (mdMatch) {
                const title = mdMatch[1].slice(0, 12);
                const url = mdMatch[2];
                items.push({
                    id: `imported_item_txt_${itemIdx++}_${Math.random().toString(36).substring(2, 7)}`,
                    catId: catId,
                    cat_id: catId,
                    title: title,
                    url: url,
                    desc: "",
                    icon: `https://favicon.qqsuu.cn/${new URL(url).hostname}`,
                    hidden: false
                });
            } else {
                // 匹配普通网址
                const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                if (urlMatch) {
                    const url = urlMatch[1];
                    let host = '';
                    try { host = new URL(url).hostname; } catch (e) {}
                    items.push({
                        id: `imported_item_txt_${itemIdx++}_${Math.random().toString(36).substring(2, 7)}`,
                        catId: catId,
                        cat_id: catId,
                        title: host || "快捷导航",
                        url: url,
                        desc: "",
                        icon: host ? `https://favicon.qqsuu.cn/${host}` : '',
                        hidden: false
                    });
                }
            }
        });

        if (items.length > 0) {
            return { categories, items };
        }

        throw new Error("无法识别的配置格式 (请使用标准的 HTML 网页书签、特定 JSON 结构或 Markdown 列表文件)");
    };

    // 监听文件导入
    const importInput = document.getElementById('import-file');
    if (importInput) {
        importInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = parseImportedData(event.target.result);
                    
                    // Task 4.3: 导入配额校验 & 自动分装裁剪
                    const quota = appData.quota || { maxCategories: 8, maxItemsPerCategory: 15 };
                    
                    let finalCategories = [];
                    let finalItems = [];
                    let hasAutoSplit = false;
                    let hasTruncated = false;

                    parsed.categories.forEach((cat) => {
                        const catItems = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id));
                        if (catItems.length === 0) return;

                        const maxPerCat = quota.maxItemsPerCategory;
                        const chunkCount = Math.ceil(catItems.length / maxPerCat);

                        for (let c = 0; c < chunkCount; c++) {
                            // 如果已达分类总上限，则丢弃后续分类以保障系统物理稳定
                            if (finalCategories.length >= quota.maxCategories) {
                                hasTruncated = true;
                                break;
                            }

                            const subCatId = c === 0 ? cat.id : `${cat.id}_sub_${c}_${Date.now()}`;
                            const subCatName = c === 0 ? cat.name : `${cat.name} ${c + 1}`;
                            if (c > 0) hasAutoSplit = true;

                            finalCategories.push({
                                id: subCatId,
                                name: subCatName.slice(0, 10),
                                icon: cat.icon || "🔖",
                                hidden: !!cat.hidden
                            });

                            const chunkItems = catItems.slice(c * maxPerCat, (c + 1) * maxPerCat);
                            chunkItems.forEach((item) => {
                                finalItems.push({
                                    ...item,
                                    catId: subCatId,
                                    cat_id: subCatId
                                });
                            });
                        }
                    });

                    parsed.categories = finalCategories;
                    parsed.items = finalItems;

                    if (parsed.categories.length === 0) {
                        throw new Error("导入内容经校验为空或无效");
                    }

                    if (!confirm("导入将覆盖当前所有配置，确定继续吗？")) return;
                    
                    appData = parsed;
                    showLoader('正在导入并同步...');
                    await syncConfigToCloud();
                    renderNav();
                    
                    if (hasTruncated) {
                        showToast("导入成功！部分条目超出容量配额已做安全裁切。", "#e67e22");
                    } else if (hasAutoSplit) {
                        showToast("导入成功！超出上限的书签已自动分箱拆分。", "#27ae60");
                    } else {
                        showToast("导入成功");
                    }
                } catch (err) {
                    showToast(`导入失败: ${err.message}`, "#e74c3c");
                } finally {
                    hideLoader();
                    importInput.value = ''; // 清空以支持重复导入
                }
            };
            reader.readAsText(file);
        };
    }

    // 1. 全场景沉浸唤醒监听 (Task 2.5.1 - 增强版)
    window.addEventListener('wheel', (e) => {
        if (isActuallyZen && e.deltaY > 10) {
            isZenTempExpanded = true;
            renderNav();
        }
    }, { passive: true });

    // 移动端手势唤醒 (Task 5.2: Gesture Engine)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    // 1. 禅意模式大范围位移唤醒 (Task 11.1)
    window.addEventListener('mousemove', (e) => {
        if (appData.settings?.zenMode && !isZenTempExpanded) {
            const dx = Math.abs(e.clientX - (lastMouseX || e.clientX));
            const dy = Math.abs(e.clientY - (lastMouseY || e.clientY));
            
            zenMoveAccumulator += (dx + dy);
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            if (zenMoveAccumulator > 150) { // 阈值 150px
                wakeUpNavigation();
            }
        }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        // 1. Zen Mode 唤醒与视图调度 (T9 & Task 11.3)
        if (appData.settings?.zenMode) {
            // A. 静默态上滑唤醒
            if (document.body.classList.contains('zen-silent')) {
                if (deltaY < -60 && Math.abs(deltaX) < 40 && deltaTime < 300) {
                    wakeUpNavigation();
                    return;
                }
            }
            
            // B. 需求：左向右拉拽式抽屉手势触发“视图调度” (侧边栏)
            if (touchStartX < 50 && deltaX > 100 && Math.abs(deltaY) < 50) {
                if (document.body.classList.contains('zen-silent')) {
                    wakeUpNavigation(); // 静默态先唤醒
                }
                toggleSidebar(true); // 唤起调度面板(侧边栏)
                return;
            }
        } else {
            // C. 标准模式下左向右滑唤起侧边栏
            if (touchStartX < 50 && deltaX > 100 && Math.abs(deltaY) < 50) {
                toggleSidebar(true);
                return;
            }
        }

        // 2. 侧边栏侧滑逻辑 (Mobile Layout Only)
        if (window.innerWidth < 768) {
            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar?.classList.contains('open');

            if (!isOpen && touchStartX < 30 && deltaX > 60) {
                // 从边缘向右滑 -> 唤起
                toggleSidebar(true);
            } else if (isOpen && deltaX < -60) {
                // 开启状态下向左滑 -> 隐藏
                toggleSidebar(false);
            }
        }
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (isActuallyZen) {
            // 排除交互元素，仅背景触发 (Task 2.5.1 优化)
            if (!e.target.closest('.card, .sidebar, .modal, .sidebar-toggle, .search-wrapper')) {
                isZenTempExpanded = true;
                renderNav();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        const focusedCard = document.activeElement.closest('.card');
        const isCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        
        // Task 37.4: 预检测活跃弹窗
        const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');

        // 2. 全键盘全域空间导航 (Task 30.1 - Grid-Agnostic)
        if (!isInput && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            // Task 31.2: 禅意静默态唤醒逻辑
            if (appData.settings?.zenMode && document.body.classList.contains('zen-silent')) {
                wakeUpNavigation();
                // 唤醒后延迟一瞬待 DOM 状态更新（消除 opacity:0 带来的干扰）
                setTimeout(() => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
                }, 50);
                return;
            }

            // Task 37.1: 场景感知的焦点池检测 (重构以支持弹窗内部导航)
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            let pool;

            if (activeModal) {
                // 弹窗模式：仅在弹窗内可见的可交互元素中导航
                pool = Array.from(activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                             .filter(el => {
                                 const rect = el.getBoundingClientRect();
                                 return rect.width > 0 && rect.height > 0;
                             });
            } else {
                // 常规模式：磁贴 + 侧边栏/禅意菜单 + 搜索引擎切换器
                const isZen = appData.settings?.zenMode === true;
                const selectors = isZen 
                    ? '.card:not(.hidden-item), .zen-menu-item, .zen-freq-item, #current-engine-trigger, .engine-item' 
                    : '.card:not(.hidden-item), .sidebar-nav-item:not(.sidebar-nav-label), .zen-menu-item, .zen-freq-item, .notice-center-btn, .sidebar-pin-btn, #current-engine-trigger, .engine-item';
                
                pool = Array.from(document.querySelectorAll(selectors))
                            .filter(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            });
            }
            
            if (pool.length === 0) return;
            e.preventDefault();
            
            const current = document.activeElement;
            const isInsidePool = pool.includes(current);

            // 如果当前没有焦点在池中，默认聚焦第一个可见磁贴或侧边栏项
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

                // Task 37.3: 场景感知的几何权重算法
                // 弹窗内的组件通常更紧凑且对齐要求低，放宽权重限制
                const hWeight = activeModal ? 1.5 : 2.5; // 水平移动时的垂直惩罚
                const vWeight = activeModal ? 1.2 : 2.0; // 垂直移动时的水平惩罚

                // 几何筛选与加权评分
                switch (e.key) {
                    case 'ArrowRight':
                        if (dx > 2) { // 弹窗模式下减小位移判定阈值
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
                // 确保聚焦元素在视界中央 (Task 30.3 优化)
                // block: 'nearest' 能减少不必要的剧烈跳动，让滚动更平滑
                bestMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        // Task 33.3: 处理全局 Enter/Space 激活代理
        if (!isInput && (key === 'enter' || key === ' ')) {
            const active = document.activeElement;
            
            // Task 37.1: 场景感知池检测 (同步支持弹窗激活态)
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            let pool;

            if (activeModal) {
                pool = Array.from(activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            } else {
                const isZen = appData.settings?.zenMode === true;
                const selectors = isZen 
                    ? '.card:not(.hidden-item), .zen-menu-item, .zen-freq-item, #current-engine-trigger, .engine-item' 
                    : '.card:not(.hidden-item), .sidebar-nav-item:not(.sidebar-nav-label), .zen-menu-item, .zen-freq-item, .notice-center-btn, .sidebar-pin-btn, #current-engine-trigger, .engine-item';
                pool = Array.from(document.querySelectorAll(selectors));
            }
            
            if (pool.includes(active)) {
                // 如果是 div 实现的自定义按钮，手动触发点击
                if (active.tagName === 'DIV' || active.tagName === 'SPAN') {
                    e.preventDefault();
                    active.click();
                    
                    // 增加瞬间缩放反馈
                    active.style.transform = 'scale(0.95)';
                    setTimeout(() => active.style.transform = '', 100);
                }
            }
        }

        // 3. Ctrl+B 视图调度 (核心快捷键 - Task 11.3/15.2 对齐)
        if (isCtrl && key === 'b') {
            if (activeModal) return; // Task 37.4: 弹窗时屏蔽
            e.preventDefault();
            
            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar?.classList.contains('open');
            
            // 如果要打开侧边栏，且处于禅意静默态，先唤醒视界
            if (!isOpen && appData.settings?.zenMode && document.body.classList.contains('zen-silent')) {
                wakeUpNavigation();
            }
            
            toggleSidebar(!isOpen);
            return;
        }

        // 3.1 Alt+Z 一键切换禅意模式 (Task 15.3 新增)
        if (e.altKey && key === 'z') {
            if (activeModal) return; // Task 37.4: 弹窗时屏蔽
            e.preventDefault();
            toggleZenMode(undefined, true);
            return;
        }

        // 4. 键入即唤醒 (Task 2.2 / S.2)
        if (!isInput && (e.key.length === 1 || key === '/') && !isCtrl && !e.altKey) {
            if (activeModal) return; // Task 37.4: 弹窗时屏蔽
            const sea = document.getElementById('sea-input');
            if (sea) {
                // 如果是 / 键，不输入到搜索框中
                if (key === '/') e.preventDefault();
                
                document.body.classList.add('search-active');
                sea.focus();
                // 浏览器会自动将当前按下的键填入刚聚焦的 input
            }
        }

        // 5. Ctrl + L 或 Alt + L 唤起登录/用户中心 (Task 39.2)
        if ((isCtrl || e.altKey) && key === 'l') {
            e.preventDefault();
            showAuthModal();
            return;
        }

        // 6. Ctrl+K 快速聚焦
        if (isCtrl && key === 'k') {
            e.preventDefault();
            const sea = document.getElementById('sea-input');
            if (sea) {
                document.body.classList.add('search-active');
                sea.value = '';
                sea.focus();
            }
            return;
        }

        // 7. 页面滚动快捷键 (Task 4.2)
        if (!isInput) {
            if (e.key === 'Home') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            if (e.key === 'End') {
                e.preventDefault();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        }

        // 8. Escape 一键复位
        if (e.key === 'Escape') { 
            // Task 37.4: 弹窗退出作为最高优先级 (Stack Layer 0)
            if (activeModal) {
                e.preventDefault();
                closeAllModals();
                return;
            }

            // 1. 优先关闭搜索层 (Task S.2)
            if (document.body.classList.contains('search-active')) {
                closeSearch();
                return;
            }

            // 2. 其次退出页面管理模式 (Stack Layer 2) - Task 10.6.3
            if (isPageManagementMode) {
                e.preventDefault();
                togglePageManagement(false);
                return;
            }

            // 3. 如果侧边栏打开且不是固定态，则关闭
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open') && !isSidebarPinned) {
                toggleSidebar(false);
                return;
            }

            // 4. 在禅意模式下，如果是唤醒态则回归静默态
            if (appData.settings?.zenMode && isZenTempExpanded) {
                isZenTempExpanded = false;
                document.body.classList.remove('zen-silent-woken');
                renderNav();
                updateStyles();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                sea?.blur(); // 失去焦点以触发自动沉睡逻辑
                return;
            }
        }
    });
};

// ==================== 7. Task 3.2: 魔法棒与编辑逻辑 ====================

const openEditModal = (id) => {
    lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const item = appData.items.find(i => i.id === id) || { id: '', title: '', url: '', icon: '', desc: '', cat_id: activeCatId };
    const modal = document.getElementById('edit-modal');
    const body = document.getElementById('edit-form-body');
    if (!modal || !body) return;

    modal.setAttribute('data-editing-id', id);
    document.getElementById('edit-title').innerText = id ? '编辑书签' : '添加新书签';

    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-link"></i> 网址</label>
            <div style="display:flex; gap:8px; width:100%">
                <input type="text" id="edit-url" value="${item.url}" placeholder="https://...">
                <button id="btn-magic-wand" class="icon-btn-action" title="魔法棒自动抓取" onclick="triggerMagicWand()">
                    <i class="ri-magic-line"></i>
                </button>
            </div>
        </div>
        <div class="form-row">
            <label><i class="ri-font-size"></i> 标题</label>
            <input type="text" id="edit-title-input" value="${item.title}" placeholder="网站名称">
        </div>
        <div class="form-row">
            <label><i class="ri-image-line"></i> 图标</label>
            <div style="display:flex; gap:8px; width:100%; align-items:center;">
                <input type="text" id="edit-icon" value="${item.icon || ''}" placeholder="Emoji 或 图片 URL">
                <button id="btn-select-emoji" class="icon-btn-action" title="选择表情/图标" onclick="toggleEmojiPicker()">
                    <i class="ri-emotion-line"></i>
                </button>
                <div id="edit-icon-preview" class="preview-container">
                    ${item.icon?.startsWith('http') ? `<img src="${item.icon}">` : `<span>${item.icon || '🔗'}</span>`}
                </div>
            </div>
        </div>
        ${getEmojiPickerHTML()}
        <div class="form-row">
            <label><i class="ri-text-snippet"></i> 描述</label>
            <textarea id="edit-desc" rows="2" placeholder="可选描述" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:8px;">${item.desc || ''}</textarea>
        </div>
        <div class="form-row">
            <label><i class="ri-folders-line"></i> 分类</label>
            <select id="edit-cat">
                ${appData.categories.map(c => `<option value="${c.id}" ${c.id === (item.cat_id || item.catId) ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-row">
            <label><i class="ri-eye-off-line"></i> 隐藏</label>
            <input type="checkbox" id="edit-hidden" ${item.hidden ? 'checked' : ''}>
        </div>
    `;

    // 实时图标预览
    document.getElementById('edit-icon').oninput = (e) => {
        const val = e.target.value.trim();
        const preview = document.getElementById('edit-icon-preview');
        preview.innerHTML = val.startsWith('http') ? `<img src="${val}">` : `<span>${val || '🔗'}</span>`;
    };

    modal.style.display = 'flex';

    // 重新复位并绑定确认按钮事件 (防止被其他弹窗覆盖劫持)
    const confirmBtn = document.getElementById('btn-confirm-edit');
    if (confirmBtn) {
        confirmBtn.style.display = 'block';
        confirmBtn.onclick = saveItem;
    }

    // Task 37.2: 自动聚焦
    setTimeout(() => {
        document.getElementById('edit-url')?.focus();
    }, 50);
};

const triggerMagicWand = async () => {
    const url = document.getElementById('edit-url').value.trim();
    if (!url) return showToast("请先输入网址", "#e67e22");
    if (!url.startsWith('http')) return showToast("请输入完整的 http(s) 网址", "#e67e22");

    const btn = document.getElementById('btn-magic-wand');
    const initialIcon = document.getElementById('edit-icon')?.value || '';
    
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetch(`/api/proxy/fetch-metadata?url=${encodeURIComponent(url)}`, {
            headers: { 'Authorization': sysToken }
        });
        const result = await res.json();

        if (result.success) {
            const { title, desc, icon } = result.data;
            const titleInput = document.getElementById('edit-title-input');
            const descInput = document.getElementById('edit-desc');
            const iconInput = document.getElementById('edit-icon');

            // 竞态防御：若此时模态框已被关闭或组件已被销毁，直接安全退出
            if (!titleInput || !descInput || !iconInput) {
                console.log("[MagicWand] Modal has been closed, dropping async response.");
                return;
            }

            if (!titleInput.value) titleInput.value = title;
            if (!descInput.value) descInput.value = desc;
            
            // 竞态防御：只有在用户等待期间没有手动修改过图标时，才予以自动覆盖填充
            if (iconInput.value === initialIcon || !iconInput.value) {
                iconInput.value = icon;
                iconInput.dispatchEvent(new Event('input'));
            } else {
                console.log("[MagicWand] User manually specified emoji, skipping auto icon overwrite.");
            }
            showToast("魔法填充成功！");
        } else {
            showToast(result.error || "抓取失败", "#e74c3c");
        }
    } catch (e) {
        showToast("请求服务失败", "#e74c3c");
    } finally {
        // 同样在按钮还存在时才做状态清除
        const currentBtn = document.getElementById('btn-magic-wand');
        if (currentBtn) {
            currentBtn.classList.remove('loading');
            currentBtn.disabled = false;
        }
    }
};

const saveItem = async () => {
    const modal = document.getElementById('edit-modal');
    const id = modal.getAttribute('data-editing-id');
    const catId = document.getElementById('edit-cat').value;
    
    const payload = {
        id: id || 'item_' + Date.now(),
        url: document.getElementById('edit-url').value.trim(),
        title: document.getElementById('edit-title-input').value.trim(),
        icon: document.getElementById('edit-icon').value.trim(),
        desc: document.getElementById('edit-desc').value.trim(),
        catId: catId,
        cat_id: catId, // 双重保险：兼容后端不同版本的字段名
        hidden: document.getElementById('edit-hidden').checked
    };

    if (!payload.url || !payload.title) return showToast("网址和标题不能为空", "#e67e22");

    // Task 4.3: 前端配额阻断
    const targetCatItems = appData.items.filter(i => (i.catId === payload.catId || i.cat_id === payload.catId) && i.id !== id);
    if (targetCatItems.length >= 100) {
        return showToast("目标分类已满 (上限 100 个书签)", "#e74c3c");
    }

    // 暂存模式：直接更新本地内存并显示提示
    if (id) {
        const idx = appData.items.findIndex(i => i.id === id);
        appData.items[idx] = { ...appData.items[idx], ...payload };
    } else {
        appData.items.push(payload);
    }

    isDataDirty = true;
    modal.style.display = 'none';
    showToast(id ? "修改已本地暂存" : "书签已本地添加", "#3498db");
    renderNav();

    // 登录态即时静默后台同步 (Task BF.3)
    if (sysToken) {
        // 先写入本地 localStorage 以防断电或离线刷新
        localStorage.setItem('nav_app_data', JSON.stringify(appData));
        
        const autoSync = appData.settings?.autoSyncOnLogout !== false;
        if (autoSync) {
            console.log("[Sync] Triggering background auto-sync to cloud...");
            manualSyncCloud(false).then(() => {
                isDataDirty = false;
                console.log("[Sync] Background auto-sync succeeded.");
            }).catch(err => {
                console.warn("[Sync] Background auto-sync failed:", err);
            });
        }
    }
};
