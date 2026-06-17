/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

// Task SYNC.GUARD.2: 获取核心数据指纹（仅包含分类和网址内容）
const getCoreDataFingerprint = (data) => {
    if (!data) return '';
    const cleanSettings = { ...data.settings };
    delete cleanSettings.themeMode; // 取消云端指纹计算，保留本地纯偏好
    return JSON.stringify({
        c: data.categories || [],
        i: data.items || [],
        s: cleanSettings
    });
};

// ==================== 全局状态 ====================
const MINIMAL_SAFE_DATA = {
    settings: { zenMode: false, link_target: '_blank' },
    categories: [
        { id: "f-cat-1", name: "常用搜索", icon: "🔍", hidden: false }
    ],
    items: []
};

let appData = { 
    settings: { zenMode: false, isolatedView: false }, 
    categories: [
        { id: 'temp_init', name: '加载中...', icon: '⌛' }
    ], 
    items: [] 
};
let activeCatId = 'temp_init';
let sysToken = localStorage.getItem('nav_token') || '';
let currentUser = JSON.parse(localStorage.getItem('nav_current_user') || 'null'); // Task 39.4
let isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_user'); // Task NT-V2.17: 根据持久化凭证智能对齐管理员权限状态
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
// themeMode state is now managed globally by theme-mode.js
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
let adminSelectedAuditIds = new Set(); // Task NT-V2.10: 选中的审计日志
let adminAuditFilters = { page: 1, pageSize: 20, keyword: '', actionType: '' }; // Task STD.3: 审计日志筛选
let adminData = { users: [], invitations: [], announcements: [], logs: [], pagination: {} }; // 管理员全站数据缓存
let navLocalBgImage = null; // 本地缓存的高清 Base64 壁纸全局缓存，支持 10MB (Task UI.25)

// 全局状态和变量对齐网关，安全贯通各子模块
Object.defineProperty(window, 'appData', {
    get() { return appData; },
    set(v) { appData = v; },
    configurable: true
});
Object.defineProperty(window, 'isDataDirty', {
    get() { return isDataDirty; },
    set(v) { isDataDirty = v; },
    configurable: true
});
Object.defineProperty(window, 'lastFocusedElement', {
    get() { return lastFocusedElement; },
    set(v) { lastFocusedElement = v; },
    configurable: true
});
Object.defineProperty(window, 'navLocalBgImage', {
    get() { return navLocalBgImage; },
    set(v) { navLocalBgImage = v; },
    configurable: true
});
Object.defineProperty(window, 'isSidebarPinned', {
    get() { return isSidebarPinned; },
    set(v) { isSidebarPinned = v; },
    configurable: true
});
Object.defineProperty(window, 'isZenTempExpanded', {
    get() { return isZenTempExpanded; },
    set(v) { isZenTempExpanded = v; },
    configurable: true
});
Object.defineProperty(window, 'sysToken', {
    get() { return sysToken; },
    set(v) { sysToken = v; },
    configurable: true
});
Object.defineProperty(window, 'lastSyncFingerprint', {
    get() { return lastSyncFingerprint; },
    set(v) { lastSyncFingerprint = v; },
    configurable: true
});
Object.defineProperty(window, 'isPageManagementMode', {
    get() { return isPageManagementMode; },
    set(v) { isPageManagementMode = v; },
    configurable: true
});
Object.defineProperty(window, 'selectedIds', {
    get() { return selectedIds; },
    set(v) { selectedIds = v; },
    configurable: true
});
Object.defineProperty(window, 'sortableInstances', {
    get() { return sortableInstances; },
    set(v) { sortableInstances = v; },
    configurable: true
});

Object.defineProperty(window, 'currentUser', {
    get() { return currentUser; },
    set(v) { currentUser = v; },
    configurable: true
});
Object.defineProperty(window, 'isAdmin', {
    get() { return isAdmin; },
    set(v) { isAdmin = v; },
    configurable: true
});

Object.defineProperty(window, 'adminUserFilters', {
    get() { return adminUserFilters; },
    set(v) { adminUserFilters = v; },
    configurable: true
});
Object.defineProperty(window, 'adminSelectedUserIds', {
    get() { return adminSelectedUserIds; },
    set(v) { adminSelectedUserIds = v; },
    configurable: true
});
Object.defineProperty(window, 'adminAnnounceFilters', {
    get() { return adminAnnounceFilters; },
    set(v) { adminAnnounceFilters = v; },
    configurable: true
});
Object.defineProperty(window, 'adminSelectedAnnounceIds', {
    get() { return adminSelectedAnnounceIds; },
    set(v) { adminSelectedAnnounceIds = v; },
    configurable: true
});
Object.defineProperty(window, 'adminInviteFilters', {
    get() { return adminInviteFilters; },
    set(v) { adminInviteFilters = v; },
    configurable: true
});
Object.defineProperty(window, 'adminSelectedInviteIds', {
    get() { return adminSelectedInviteIds; },
    set(v) { adminSelectedInviteIds = v; },
    configurable: true
});
Object.defineProperty(window, 'adminSelectedAuditIds', {
    get() { return adminSelectedAuditIds; },
    set(v) { adminSelectedAuditIds = v; },
    configurable: true
});
Object.defineProperty(window, 'adminAuditFilters', {
    get() { return adminAuditFilters; },
    set(v) { adminAuditFilters = v; },
    configurable: true
});
Object.defineProperty(window, 'adminData', {
    get() { return adminData; },
    set(v) { adminData = v; },
    configurable: true
});
Object.defineProperty(window, 'currentEditingAnnounceId', {
    get() { return currentEditingAnnounceId; },
    set(v) { currentEditingAnnounceId = v; },
    configurable: true
});

Object.defineProperty(window, 'activeCatId', {
    get() { return activeCatId; },
    set(v) { activeCatId = v; },
    configurable: true
});
Object.defineProperty(window, 'isActuallyZen', {
    get() { return isActuallyZen; },
    set(v) { isActuallyZen = v; },
    configurable: true
});
Object.defineProperty(window, 'isRendering', {
    get() { return isRendering; },
    set(v) { isRendering = v; },
    configurable: true
});
Object.defineProperty(window, 'zenMoveAccumulator', {
    get() { return zenMoveAccumulator; },
    set(v) { zenMoveAccumulator = v; },
    configurable: true
});
Object.defineProperty(window, 'lastMouseX', {
    get() { return lastMouseX; },
    set(v) { lastMouseX = v; },
    configurable: true
});
Object.defineProperty(window, 'lastMouseY', {
    get() { return lastMouseY; },
    set(v) { lastMouseY = v; },
    configurable: true
});
Object.defineProperty(window, 'syncTimer', {
    get() { return syncTimer; },
    set(v) { syncTimer = v; },
    configurable: true
});
Object.defineProperty(window, 'syncRetryCount', {
    get() { return syncRetryCount; },
    set(v) { syncRetryCount = v; },
    configurable: true
});
Object.defineProperty(window, 'touchStartY', {
    get() { return touchStartY; },
    set(v) { touchStartY = v; },
    configurable: true
});
Object.defineProperty(window, 'currentSearchIndex', {
    get() { return currentSearchIndex; },
    set(v) { currentSearchIndex = v; },
    configurable: true
});
Object.defineProperty(window, 'historyIndex', {
    get() { return historyIndex; },
    set(v) { historyIndex = v; },
    configurable: true
});
Object.defineProperty(window, 'searchHistory', {
    get() { return searchHistory; },
    set(v) { searchHistory = v; },
    configurable: true
});
Object.defineProperty(window, 'simpleMode', {
    get() { return simpleMode; },
    set(v) { simpleMode = v; },
    configurable: true
});
Object.defineProperty(window, 'currentEnginePrefix', {
    get() { return currentEnginePrefix; },
    set(v) { currentEnginePrefix = v; },
    configurable: true
});
Object.defineProperty(window, 'lastSyncActionTime', {
    get() { return lastSyncActionTime; },
    set(v) { lastSyncActionTime = v; },
    configurable: true
});
window.getCoreDataFingerprint = getCoreDataFingerprint;
window.MINIMAL_SAFE_DATA = MINIMAL_SAFE_DATA;

// IndexedDB 辅助函数
const dbName = "nav_local_db";
const storeName = "bg_store";

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const getBgFromDB = async () => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get("nav_local_bg_image");
            request.onsuccess = (e) => {
                resolve(e.target.result ? e.target.result.value : null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error("IndexedDB getBg error:", err);
        return null;
    }
};

const saveBgToDB = async (value) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put({ id: "nav_local_bg_image", value });
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error("IndexedDB saveBg error:", err);
        return false;
    }
};
window.saveBgToDB = saveBgToDB;

const deleteBgFromDB = async () => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete("nav_local_bg_image");
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.error("IndexedDB deleteBg error:", err);
        return false;
    }
};
window.deleteBgFromDB = deleteBgFromDB;

const initLocalBgImage = async () => {
    try {
        const dbBg = await getBgFromDB();
        if (dbBg) {
            navLocalBgImage = dbBg;
        } else {
            // 兜底与老用户 localStorage 迁移
            const oldBg = localStorage.getItem('nav_local_bg_image');
            if (oldBg) {
                navLocalBgImage = oldBg;
                await saveBgToDB(oldBg);
                localStorage.removeItem('nav_local_bg_image');
                console.log('[Style] Migrated local bg image from localStorage to IndexedDB.');
            }
        }
    } catch (e) {
        console.error('[Style] Failed to initialize local bg image from IndexedDB:', e);
    }
};

// Task AL.1: 审计日志动作语义化映射
const AuditActionMap = {
    'LOGIN': { label: '安全登录', color: '#2ecc71' },
    'CREATE_USER': { label: '创建用户', color: '#3498db' },
    'DELETE_USER': { label: '危险：物理删除', color: '#e74c3c' },
    'CHANGE_USER_STATUS': { label: '状态切换', color: '#f39c12' },
    'CHANGE_USER_ROLE': { label: '权限变更', color: '#9b59b6' },
    'RESET_PASSWORD': { label: '重置密码', color: '#e67e22' },
    'RESET_TEMP_PASSWORD': { label: '临时密码', color: '#f39c12' },
    'UPDATE_SITE_CONFIG': { label: '配置修改', color: '#e74c3c' },
    'CREATE_ANNOUNCEMENT': { label: '发布公告', color: '#3498db' },
    'UPDATE_ANNOUNCEMENT': { label: '编辑公告', color: '#f39c12' },
    'DELETE_ANNOUNCEMENT': { label: '下架公告', color: '#95a5a6' },
    'BATCH_GENERATE_INVITATIONS': { label: '批量生成邀请码', color: '#1abc9c' },
    'DELETE_INVITATION': { label: '作废邀请码', color: '#95a5a6' }
};

// ==================== Task 22.1: 全局语义化同步反馈引擎 ====================
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
            const isGuest = !sysToken;
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

    // Task 2: PWA 离线感知与状态自愈
    window.updateNetworkStatus = (event) => {
        const dot = document.getElementById('network-status');
        if (!dot) return;
        if (navigator.onLine) {
            dot.className = 'network-status-dot online';
            dot.title = '网络状态：云端在线同步中';
            
            const isOnlineEvent = event && event.type === 'online';
            const intervalDays = window.appData?.settings?.syncInterval || 0;
            if (sysToken && isDataDirty && !isPageManagementMode && isOnlineEvent && intervalDays > 0) {
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

    // Task 3: 键盘快捷键帮助指南
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

    // 2. 初始视觉校准 & 本地大壁纸预载 (IndexedDB 异步) (Task UI.25)
    initLocalBgImage().then(() => {
        updateStyles();
        
        // 3. 异步获取 Bing 壁纸 (Task 12.1)
        if (!appData.settings?.bgUrl) {
            getBingWallpaper().then(() => updateStyles());
        }
    });

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
    window.initSiteConfig = initSiteConfig;
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
    localStorage.removeItem('nav_current_user');
    localStorage.removeItem('nav_app_data');
    localStorage.removeItem('nav_last_cloud_sync');
    sysToken = '';
    currentUser = null;
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

    // 4. 处理卡片宽度 (彻底与 CSS 密度规范一致)
    // 移动端/手机端下由于屏幕极窄，强行忽略用户自定义偏好，完美向未登录游客态看齐（无条件复用 CSS 默认 70px/75px 黄金标准）
    const w = appData.settings?.cardWidth;
    const isMobile = window.innerWidth <= 768;
    if (!w || isMobile) {
        document.documentElement.style.removeProperty('--card-w');
        document.documentElement.style.removeProperty('--card-h');
    } else {
        document.documentElement.style.setProperty('--card-w', w + 'px');
        document.documentElement.style.setProperty('--card-h', w + 'px');
    }

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
    let bg = appData.settings?.bgUrl;
    
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
            // 🚀 读取本地缓存的高清 Base64 格式壁纸 (Task UI.25)
            const localBg = navLocalBgImage || localStorage.getItem('nav_local_bg_image');
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
        const isGuest = !sysToken;

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
            headers: sysToken ? { 'Authorization': sysToken } : {}
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
                await fetch('/api/announcements', {
                    method: 'POST',
                    headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
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
            await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sysToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
        } catch (e) { console.warn('[Notice] Sync bulk read failed'); }
    }
    
    openNoticeCenter(); // 刷新列表状态
};

window.updateStyles = updateStyles;

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

// Task 4.2: 视觉实验室控制已抽离至独立的 personalization.js 子模块中

const openProfileCenter = async () => {
    if (!sysToken) return showAuthModal();
    lastFocusedElement = document.activeElement;
    closeAllModals(true);
    showLoader('正在读取个人资料...');

    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': sysToken }
        });
        const info = await res.json();
        hideLoader();

        if (!info.success) throw new Error(info.error || "读取资料失败");

        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('edit-title');
        const body = document.getElementById('edit-form-body');
        const confirmBtn = document.getElementById('btn-confirm-edit');
        
        if (!modal || !body) return;

        modal.dataset.modalType = 'user-profile';
        title.innerHTML = `<i class="ri-user-settings-line"></i> 个人资料中心`;
        
        const DEFAULT_AVATARS = [
            'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
            'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
            'https://api.dicebear.com/7.x/pixel-art/svg?seed=John',
            'https://api.dicebear.com/7.x/miniavs/svg?seed=Lily',
            'https://api.dicebear.com/7.x/identicon/svg?seed=Jack',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=Garfield'
        ];
        
        const storedUser = JSON.parse(localStorage.getItem('nav_current_user') || '{}');
        const userId = storedUser.id || '';
        const currentAvatar = appData.settings?.avatarUrl || localStorage.getItem('nav_user_avatar_' + userId) || DEFAULT_AVATARS[0];

        let avatarSelectorHtml = '';
        DEFAULT_AVATARS.forEach(url => {
            const isSel = currentAvatar === url;
            avatarSelectorHtml += `
                <div class="avatar-option-item ${isSel ? 'selected' : ''}" 
                     data-url="${url}"
                     onclick="window.selectProfileAvatar(this, '${url}')"
                     style="width: 42px; height: 42px; border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid ${isSel ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; background: rgba(255,255,255,0.05); padding: 2px; transition: 0.2s;">
                    <img src="${url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                </div>
            `;
        });

        body.innerHTML = `
            <div class="form-row" style="margin-bottom: 20px;">
                <label><i class="ri-emotion-happy-line"></i> 个人默认头像 (点击切换)</label>
                <div id="avatar-selector-box" style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">
                    ${avatarSelectorHtml}
                </div>
                <input type="hidden" id="prof-avatar-val" value="${currentAvatar}">
            </div>
            <div class="form-row">
                <label><i class="ri-user-line"></i> 用户名</label>
                <input type="text" id="prof-username" value="${info.username || ''}" placeholder="用户名" required>
            </div>
            <div class="form-row">
                <label><i class="ri-mail-line"></i> 绑定邮箱</label>
                <input type="email" id="prof-email" value="${info.email || ''}" placeholder="可选，用于接收安全告警或日报邮件">
            </div>
            <div class="form-row">
                <label><i class="ri-telegram-line"></i> TG ID</label>
                <input type="text" id="prof-tg" value="${info.telegramChatId || ''}" placeholder="可选，您的个人 Telegram Chat ID">
            </div>
            
            <hr style="border-color: var(--glass-border); margin: 15px 0;">
            
            <!-- 💡 分享主页设置（与个人中心其它元素样式完美一致） -->
            <div class="form-row">
                <label><i class="ri-share-line"></i> 分享主页</label>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--glass-border);">
                    <span style="font-size: 13px; color: var(--text-dim);">启用公开分享主页 (访客免登录只读)</span>
                    <input type="checkbox" id="prof-is-shared" ${info.isShared ? 'checked' : ''} onchange="window.toggleShareSlugInput(this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                </div>
            </div>
            
            <div id="share-slug-container" style="display: ${info.isShared ? 'block' : 'none'}; margin-top: 15px;">
                <!-- 第一行：别名输入与提示说明 -->
                <div class="form-row" style="margin-bottom: 12px;">
                    <label><i class="ri-link"></i> 个性主页别名</label>
                    <input type="text" id="prof-share-slug" value="${info.shareSlug || ''}" placeholder="例如: adou" style="width: 100%; height: 36px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 6px; padding: 0 10px; color: var(--text); font-size: 13px;" oninput="window.updateProfileShareLinkPreview(this.value)">
                    <small style="display: block; margin-top: 6px; font-size: 11px; color: #f1c40f; line-height: 1.4;"><i class="ri-error-warning-line"></i> 💡 提示：点击保存个人资料后生效</small>
                </div>
                <!-- 第二行：链接预览与精简图标复制按钮 -->
                <div class="form-row" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--glass-border);">
                    <span id="share-link-preview-text" style="font-size: 12px; color: var(--text-dim); word-break: break-all; margin-right: 10px;">链接: ${window.location.origin}/?p=${info.shareSlug || 'your-slug'}</span>
                    <button type="button" class="action-link" id="btn-copy-share-link" style="width: 28px; height: 28px; padding: 0; min-width: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text);" onclick="window.copyProfileShareLink()" title="复制分享链接">
                        <i class="ri-file-copy-line" style="font-size: 14px;"></i>
                    </button>
                </div>
            </div>

            <hr style="border-color: var(--glass-border); margin: 15px 0;">
            <div class="form-row">
                <label><i class="ri-lock-password-line"></i> 原密码 (仅修改密码时必填)</label>
                <input type="password" id="prof-old-pass" placeholder="输入当前原密码">
            </div>
            <div class="form-row">
                <label><i class="ri-lock-line"></i> 新密码 (留空则不修改)</label>
                <input type="password" id="prof-new-pass" placeholder="输入新密码">
            </div>
        `;

        modal.style.display = 'flex';
        confirmBtn.style.display = 'block';
        confirmBtn.innerText = "保存个人资料";

        // 注册全局头像和分享辅助函数
        window.toggleShareSlugInput = (checked) => {
            document.getElementById('share-slug-container').style.display = checked ? 'block' : 'none';
        };
        window.updateProfileShareLinkPreview = (val) => {
            const slug = val.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
            document.getElementById('share-link-preview-text').innerText = `链接: ${window.location.origin}/?p=${slug || 'your-slug'}`;
        };
        window.copyProfileShareLink = () => {
            const val = document.getElementById('prof-share-slug').value.trim();
            const slug = val.toLowerCase().replace(/[^a-z0-9\-]/g, '');
            if (!slug) return showToast("请先设置有效的个性别名", "#e74c3c");
            const link = `${window.location.origin}/?p=${slug}`;
            if (window.utils && typeof window.utils.copyText === 'function') {
                window.utils.copyText(link).then(() => {
                    showToast("分享链接已复制至剪贴板！", "#2ecc71");
                }).catch(() => {
                    showToast("复制失败，请手动复制预览链接", "#e74c3c");
                });
            } else {
                navigator.clipboard.writeText(link).then(() => {
                    showToast("分享链接已复制至剪贴板！", "#2ecc71");
                }).catch(() => {
                    showToast("复制失败，请手动复制预览链接", "#e74c3c");
                });
            }
        };

        window.selectProfileAvatar = (el, url) => {
            document.querySelectorAll('.avatar-option-item').forEach(item => {
                item.style.borderColor = 'rgba(255,255,255,0.1)';
                item.classList.remove('selected');
            });
            el.style.borderColor = 'var(--primary)';
            el.classList.add('selected');
            document.getElementById('prof-avatar-val').value = url;
        };

        confirmBtn.onclick = async () => {
            const username = document.getElementById('prof-username').value.trim();
            const email = document.getElementById('prof-email').value.trim();
            const telegramChatId = document.getElementById('prof-tg').value.trim();
            const password = document.getElementById('prof-old-pass').value;
            const newPassword = document.getElementById('prof-new-pass').value;
            const isShared = document.getElementById('prof-is-shared').checked;
            const shareSlug = document.getElementById('prof-share-slug').value.trim();

            if (!username) {
                return showToast("用户名不能为空", "#e74c3c");
            }

            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return showToast("邮箱格式不正确", "#e74c3c");
                }
            }

            if (newPassword && !password) {
                return showToast("修改密码需要输入原密码", "#e74c3c");
            }

            showLoader('正在保存个人资料...');
            try {
                const saveRes = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': sysToken
                    },
                    body: JSON.stringify({ username, email, telegramChatId, password, newPassword, isShared, shareSlug })
                });
                const saveResult = await saveRes.json();
                hideLoader();

                if (saveResult.success) {
                    showToast("个人资料修改成功！", "#27ae60");
                    
                    // 保存头像
                    const selectedAvatar = document.getElementById('prof-avatar-val').value;
                    const storedUser = JSON.parse(localStorage.getItem('nav_current_user') || '{}');
                    localStorage.setItem('nav_user_avatar_' + storedUser.id, selectedAvatar);
                    
                    // 💡 把头像同步保存进 appData.settings，使其能够进行云端备份，实现手机端/跨设备同步！
                    if (!appData.settings) appData.settings = {};
                    appData.settings.avatarUrl = selectedAvatar;
                    isDataDirty = true;
                    
                    // 局部更新本地用户信息
                    storedUser.username = username;
                    localStorage.setItem('nav_current_user', JSON.stringify(storedUser));
                    currentUser = storedUser;
                    appData.username = username;

                    modal.style.display = 'none';
                    renderNav();
                    renderTools();
                } else {
                    showToast(saveResult.error || "修改失败，请重试", "#e74c3c");
                }
            } catch (e) {
                hideLoader();
                showToast("连接服务器失败，请检查网络", "#e74c3c");
            }
        };

    } catch (e) {
        hideLoader();
        showToast(e.message || "加载资料失败，请重试", "#e74c3c");
    }
};
window.openProfileCenter = openProfileCenter;

// 临时密码登录后强制弹窗提醒修改密码（不可忽略，必须点击按钮才能关闭）
const showTempPasswordChangeAlert = () => {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    const closeBtn = document.getElementById('btn-close-edit');

    if (!modal || !body) return;

    // 暂存原来的 title 内容（此处 title 在 openProfileCenter 会重新设置）
    title.innerHTML = `<i class="ri-error-warning-line" style="color:#f39c12;"></i> ⚠️ 安全提醒`;

    body.innerHTML = `
        <div style="text-align:center; padding:20px 10px;">
            <div style="font-size:48px; color:#f39c12; margin-bottom:16px;">
                <i class="ri-alert-fill"></i>
            </div>
            <h4 style="color:#e67e22; margin-bottom:12px; font-size:15px;">
                您正在使用临时密码登录
            </h4>
            <p style="font-size:13px; color:var(--text-dim); line-height:1.8; margin-bottom:8px;">
                临时密码有效期为 <b style="color:#e74c3c;">30分钟</b>，过期后将无法使用。
            </p>
            <p style="font-size:13px; color:var(--text-dim); line-height:1.8; margin-bottom:16px;">
                为了您的账号安全，请<b style="color:#2ecc71;">立即前往个人资料中心</b>修改正式密码。
            </p>
            <div style="background:rgba(231,76,60,0.08); border:1px solid rgba(231,76,60,0.2); border-radius:6px; padding:8px 12px; font-size:11px; color:#e74c3c;">
                <i class="ri-information-line"></i> 修改密码完成后，临时密码将被自动销毁。
            </div>
        </div>
    `;

    confirmBtn.style.display = 'block';
    confirmBtn.innerText = '前往个人资料中心修改密码';
    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        // 恢复原始关闭按钮行为
        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        openProfileCenter();
    };

    // 阻止关闭按钮直接关闭弹窗，强制引导用户去修改密码
    if (closeBtn) {
        closeBtn.onclick = () => {
            showToast("⚠️ 请务必立即修改密码，临时密码将在30分钟后失效", "#e67e22");
        };
    }

    modal.style.display = 'flex';
};

// Individual visual & zen helper functions are now managed in personalization.js

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
window.showAuthModal = showAuthModal;

const doLogin = async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    if (!u || !p) return showToast("请填写用户名和密码", "#e67e22");

    await SyncUI.perform('LOGIN', async () => {
        // 检查是否需要邮箱输入（临时密码验证）
        if (window.tempPasswordRequiresEmail) {
            const tempEmailInput = document.getElementById('auth-email-temp');
            if (!tempEmailInput || !tempEmailInput.value.trim()) {
                return showToast("使用临时密码登录需要验证邮箱", "#e67e22");
            }
        }

        const existingEmailInput = document.getElementById('auth-email-temp');
        const email = existingEmailInput?.value.trim();

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p, email })
        });
        const data = await res.json();

        if (res.status === 429) {
            throw new Error(data.error || "尝试次数过多，请稍后再试");
        }

        if (!res.ok || !data.success) {
            // 处理临时密码需要邮箱的情况
            if (data.requiresEmail) {
                window.tempPasswordRequiresEmail = true;
                // 显示邮箱输入框
                const loginForm = document.getElementById('auth-form');
                if (!document.getElementById('auth-email-temp')) {
                    const newEmailInput = document.createElement('input');
                    newEmailInput.id = 'auth-email-temp';
                    newEmailInput.type = 'email';
                    newEmailInput.placeholder = data.hint || '请输入您的邮箱地址';
                    newEmailInput.style.cssText = 'width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px;';

                    const passInput = document.getElementById('auth-password');
                    passInput.parentNode.insertBefore(newEmailInput, passInput.nextSibling);
                }
                return showToast(data.error, "#e67e22");
            }
            throw new Error(data.error || "登录失败");
        }

        // 清理临时邮箱输入框
        window.tempPasswordRequiresEmail = false;
        const cleanupEmailInput = document.getElementById('auth-email-temp');
        if (cleanupEmailInput) cleanupEmailInput.remove();

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

        // 临时密码登录后弹窗强制提醒修改密码（不可忽略的交互弹窗）
        if (data.isTempPasswordLogin || data.requiresPasswordChange) {
            showTempPasswordChangeAlert();
        } else {
            // 登录成功时高亮消息提示，引导用户前往云端备份进行手动同步
            showToast("登录成功！检测到您在云端可能有配置备份，如果需要，请前往「云端备份」手动拉取以覆盖本地数据。", "#3498db");
        }
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
    localStorage.removeItem('nav_token');
    localStorage.removeItem('nav_current_user'); // Task 39.4
    sysToken = '';
    currentUser = null;
    isAdmin = false;
    localStorage.removeItem('nav_app_data');
    localStorage.removeItem('nav_last_cloud_sync');
    await init(true);
    showToast("已退出登录");
};

const doResetConfig = async () => {
    const ok = await window.requireSystemConfirm("恢复出厂配置", "确定要恢复默认配置吗？这将全量覆盖、清空您当前所有的自定义分类、网址和偏好设置！该操作不可逆，确定恢复吗？", true);
    if (!ok) return;
    
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
            // 💡 彻底清洗本地缓存，阻断 Stale-First 拦截，迫使 init() 强制拉取并装载云端重置后的初始配置
            localStorage.removeItem('nav_app_data');
            
            // Task 10: 清除 SW 图标缓存
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ action: 'clearIconCache' });
            }
            
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
            appData = JSON.parse(cached);
            // Task NT-V2.17: 缓存秒开加载时重新对齐 isAdmin 状态，确保本地缓存权限逻辑无缝连接
            isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_user');
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
            
                // 3. 【冷启动与多端同步判定】
                const localFingerprint = getCoreDataFingerprint(appData || {});
                const cloudFingerprint = getCoreDataFingerprint(cloudData || {});
                
                // 判定：当前是否切换了账号（手机端新登录），或者本地缓存其实是未登录的访客默认数据，或者本地依然处于最初加载的占位状态
                const isUserChanged = currentUser && cloudData.user && (cloudData.user !== appData.user);
                const isLocalDefault = !appData.user || appData.user === 'guest' || (appData.categories && appData.categories.length === 1 && appData.categories[0].id === 'temp_init');

                if (!hasLoadedCache || isUserChanged || isLocalDefault) {
                    console.log('[Init] Force overwriting local cache with cloud data due to user change or cold start.');
                    
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
                    console.log('[Init] Local cache exists. Prevented cloud data from auto-overwriting local changes.');
                    lastSyncFingerprint = localFingerprint;
                    
                    // 即使不覆盖书签内容，但必须即时将云端最新权威的用户配额与系统身份无感合入本地
                    if (cloudData.quota) {
                        appData.quota = cloudData.quota;
                    }
                    if (typeof cloudData.isAdmin !== 'undefined') {
                        appData.isAdmin = cloudData.isAdmin;
                        isAdmin = cloudData.isAdmin;
                    }
                    localStorage.setItem('nav_app_data', JSON.stringify(appData));
                }

                // 安全对齐云端最近备份时间到本地，防止多终端“从未备份”的视觉误导和自动备份时序错乱
                if (cloudData.lastUpdated) {
                    const parseTime = Date.parse(cloudData.lastUpdated.trim().replace(/-/g, '/'));
                    if (!isNaN(parseTime)) {
                        localStorage.setItem('nav_last_cloud_sync', parseTime.toString());
                    } else {
                        localStorage.removeItem('nav_last_cloud_sync');
                    }
                } else if (sysToken) {
                    localStorage.removeItem('nav_last_cloud_sync');
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
    // 智能防追踪过滤与 404 红字清零优化：如果卡片图标是指向容易爆 404 的源，自动动态升级为 DDG 的 200-OK 极速不报错源 (Task NT-V2.24)
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
    lastFocusedElement = document.activeElement;
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
    if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
};
window.closeVideoModal = closeVideoModal;

const renderNav = () => {
    window.renderNav = renderNav;
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
                const catIconHtml = cat.icon?.startsWith('http') 
                    ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">` 
                    : `<span style="font-size: 16px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;
                menuItem.innerHTML = `<span class="menu-icon" style="width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; vertical-align: middle; margin-right: 6px;">${catIconHtml}</span><span class="menu-label">${cat.name}</span>`;
                
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

        const sidebarFragment = document.createDocumentFragment();
        const containerFragment = document.createDocumentFragment();

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

            const catIconHtml = cat.icon?.startsWith('http') 
                ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">` 
                : `<span style="font-size: 15px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;
            let navHtml = `${dragHandleHtml}<span class="nav-icon" title="" style="width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; vertical-align: middle; margin-right: 8px;">${catIconHtml}</span><span class="nav-label">${cat.name}${countHtml}</span>`;
            
            // Task 4.3: 增加管理快捷按钮
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
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
            sidebarFragment.appendChild(navItem);

            // 视图隔离核心逻辑 (Task 11.2 深度对齐)
            // 1. 禅意模式开启时：强制执行单一视图原则，无视 isolatedView 设置
            // 2. 常规模式开启时：遵循用户的手动 isolatedView 设置 (默认为 false/长廊)
            // 3. 页面管理模式：强制全分类展示以支持拖拽
            const isIsolatedView = !isPageManagementMode && (appData.settings?.zenMode || appData.settings?.isolatedView);
            
            if (isIsolatedView && cat.id !== activeCatId) return;

            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = 'section-' + cat.id;
            const sectionIconHtml = cat.icon?.startsWith('http') 
                ? `<img src="${cat.icon}" class="cat-icon-img" style="width: 100%; height: 100%; object-fit: contain;">` 
                : `<span style="font-size: 20px; line-height: 1; display: block;">${cat.icon || '📂'}</span>`;
            
            // 🔒 限制当前分类名展示：最多 1 个图标加 5 个字，溢出自动截断
            const truncatedCatName = cat.name.length > 5 ? cat.name.substring(0, 5) + '...' : cat.name;
            const canEditCat = isPageManagementMode && cat.id !== 'VIRTUAL_FREQ';
            
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
                ? appData.items.filter(i => freqIds.includes(i.id) && (isPageManagementMode || isAdmin || !i.hidden)) 
                : appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id) && (isPageManagementMode || isAdmin || !i.hidden));
                
            items.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = cat._isVideo 
                    ? `video-card ${item.hidden ? 'hidden-item' : ''}` 
                    : `card ${item.hidden ? 'hidden-item' : ''}`;
                // 为磁贴增加 Tab 索引与唯一 ID，方便键盘流转 (Task 2.5.3)
                card.setAttribute('tabindex', '0');
                card.setAttribute('data-id', item.id);
                // 注入描述作为 Tooltip (Task 4.9.2)
                if (item.desc) {
                    card.setAttribute('data-tooltip', item.desc);
                }
                card.style.animationDelay = `${idx * 0.03}s`;
                
                let html = cat._isVideo ? buildVideoCardHtml(item) : buildCardHtml(item);
                
                // 编辑入口 (Task 3.2: 页面管理模式下对所有人开放，常规模式下仅限管理员)
                if (isPageManagementMode || isAdmin) {
                    html += `<div class="card-admin-btns">
                        ${isPageManagementMode ? `<button class="card-hide-toggle-btn" onclick="event.stopPropagation(); toggleItemHidden('${item.id}')" title="${item.hidden ? '设为公开显示' : '设为对外隐藏'}"><i class="${item.hidden ? 'ri-eye-off-line' : 'ri-eye-line'}"></i></button>` : ''}
                        <button class="card-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="编辑"><i class="ri-edit-line"></i></button>
                        ${isPageManagementMode ? `<button class="card-delete-btn" onclick="event.stopPropagation(); deleteItem('${item.id}')" title="删除"><i class="ri-delete-bin-line"></i></button>` : ''}
                    </div>`;
                }

                // 🚀 新增对外隐藏状态标识（在普通浏览态下且非管理模式，管理员/登录用户能清晰知道哪些书签是对外隐藏的）
                if (item.hidden && isAdmin && !isPageManagementMode) {
                    html += `<div class="card-hidden-badge" title="该网址已对外隐藏"><i class="ri-eye-off-line"></i></div>`;
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
                        if (isPageManagementMode) {
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
                                const target = appData.settings?.link_target || '_blank';
                                window.open(item.url, target);
                            }
                        }
                    }
                };
                
                grid.appendChild(card);
            });

            // Task 4.4: 磁贴末尾的新增入口 (仅管理模式)
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                const catItemCount = items.length;
                const quota = appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
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
            containerFragment.appendChild(section);
        });
        sidebarNav.appendChild(sidebarFragment);
        container.appendChild(containerFragment);

        // Task 4.4: 侧边栏新增分类入口 (仅管理模式)
        if (isPageManagementMode) {
            const addCatBtn = document.createElement('div');
            const catCount = appData.categories.length;
            const quota = appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
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
                    <span>${(appData.shareOwner || 'S')[0].toUpperCase()}</span>
                </div>
                <div class="user-meta-box">
                    <span class="user-name" style="margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px;">
                        @${escapeHTML(appData.shareOwner || '未知用户')}
                    </span>
                    <span class="user-uid" style="background: rgba(255, 255, 255, 0.08); color: var(--text-dim); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block;">只读分享主页</span>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid var(--glass-border); font-size: 11px; line-height: 1.5; color: var(--text-dim);">
                <i class="ri-information-line" style="color: var(--primary);"></i> 您当前正在浏览 <strong>@${escapeHTML(appData.shareOwner)}</strong> 的公开网址库。已启用隐私脱敏安全沙箱。
            </div>
        `;
        if (adminBanner) adminBanner.style.display = 'none';
        document.body.classList.remove('admin-mode');
        return;
    }

    const themeIconMap = { 'auto': 'ri-computer-line', 'light': 'ri-sun-line', 'dark': 'ri-moon-line' };
    const themeNameMap = { 'auto': '跟随系统', 'light': '明亮模式', 'dark': '暗黑模式' };
    
    // 1. 渲染用户信息区域
    const info = sysToken 
        ? (currentUser || JSON.parse(localStorage.getItem('nav_current_user') || '{}'))
        : { username: '访客模式', role: 'guest', uid: null };

    const DEFAULT_AVATARS = [
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
        'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
        'https://api.dicebear.com/7.x/pixel-art/svg?seed=John',
        'https://api.dicebear.com/7.x/miniavs/svg?seed=Lily',
        'https://api.dicebear.com/7.x/identicon/svg?seed=Jack',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Garfield'
    ];

    if (!sysToken) {
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
        const userDisplayName = info.username || appData.username || '已登录用户';
        
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

        const userAvatar = appData.settings?.avatarUrl || localStorage.getItem('nav_user_avatar_' + info.id) || DEFAULT_AVATARS[0];
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
    
    // 配额状态感知 (Task 20.4)
    const quota = appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
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

    // 即时根据真实网络状态校准指示灯
    if (typeof window.updateNetworkStatus === 'function') {
        window.updateNetworkStatus();
    }
};

// Task 10.1: 唤起云端备份中心 (风格对齐视觉实验室)
// Cloud sync methods (openSyncCenter, pullBackupFromCloud, executePullBackupFromCloud, manualSyncCloud, setSyncMode) are now managed in cloud-sync.js

// Task 12.2 & 13.2 & 14.1: 唤起全站系统参数配置中枢 (Tab 架构重构)
// Task 12.2 & 13.2 & 14.1: 全站网站与品牌系统参数配置已抽离至 sys-config.js 子模块中


// Task 9.4: 周期性自动备份调度器
const checkAutoSyncSchedule = async () => {
    if (!sysToken) return;
    
    const intervalDays = appData.settings?.syncInterval || 0;
    if (intervalDays <= 0) return;

    // 安全防御：如果本地数据根本没有未同步的更改 (isDataDirty 为 false)，则绝对不触发向云端自动备份，
    // 从而 100% 避免新终端登录时，本地默认旧数据在不知情的情况下覆盖了云端的珍贵自定义数据！
    if (!isDataDirty) {
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

// ==================== 6. 其他初始化 ====================
// Task 29.4: 主题更新与模式控制已抽离至独立的 theme-mode.js 子模块中，并已安全挂载至 window

const toggleSidebar = (force) => {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (!s || !o) return;
    const isOpen = typeof force === 'boolean' ? force : !s.classList.contains('open');
    s.classList.toggle('open', isOpen);
    o.classList.toggle('visible', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);

    // --- Task 15.4: 侧边栏打开时，同步锁定禅意模式为唤醒态 ---
    if (isOpen && appData.settings?.zenMode) {
        isZenTempExpanded = true;
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
            // 执行站内模糊搜索 (升级为支持 Title, Desc 之外并列匹配 URL 协议和域名)
            const matches = appData.items.filter(i => 
                (i.title.toLowerCase().includes(val) || 
                 (i.desc && i.desc.toLowerCase().includes(val)) || 
                 (i.url && i.url.toLowerCase().includes(val))) &&
                (isAdmin || !i.hidden)
            ).slice(0, 8); // 最多显示 8 个结果

            if (matches.length > 0) {
                resultsList.innerHTML = matches.map((m, idx) => {
                    let iconUrl = m.icon;
                    // 如果没有配置图标，基于原站域名动态计算出最优初始网络 Favicon 路径
                    if (!iconUrl && m.url && m.url.startsWith('http')) {
                        try {
                            const domain = new URL(m.url).hostname;
                            if (domain) {
                                iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
                            }
                        } catch(e) {}
                    }
                    if (iconUrl && iconUrl.startsWith('http') && !iconUrl.includes('images.unsplash.com') && !iconUrl.includes('api.iconify.design')) {
                        try {
                            let domain = '';
                            if (m.url && m.url.startsWith('http')) {
                                domain = new URL(m.url).hostname;
                            } else {
                                domain = new URL(iconUrl).hostname;
                            }
                            if (domain && (iconUrl.includes('/favicon.ico') || iconUrl.includes('api.iowen.cn'))) {
                                iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
                            }
                        } catch(e) {}
                    }
                    const iconTag = iconUrl?.startsWith('http') 
                        ? `<img src="${iconUrl}" data-retry-index="0" data-title="${escapeHTML(m.title)}" onload="utils.handleIconLoad(this, '${m.url}')" onerror="utils.handleIconError(this, '${m.url}')">` 
                        : (m.icon || '🔗');

                    return `
                        <div class="local-result-item ${idx === 0 ? 'active' : ''}" onclick="recordClick('${m.id}'); window.open('${m.url}', '${appData.settings?.link_target || '_blank'}')">
                            <span class="result-icon">${iconTag}</span>
                            <div class="result-info">
                                <div class="result-title">${m.title}</div>
                                <div class="result-url">${m.url}</div>
                            </div>
                        </div>
                    `;
                }).join('');
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

    // Task S.3: 召唤按钮点击逻辑 (Task NT-V2.21)
    const summonBtn = document.getElementById('btn-summon-search');
    if (summonBtn) {
        const handleSummon = (e) => {
            e.stopPropagation(); // 🚀 阻止冒泡，防止被下方的全局 document.click 误当作外部点击瞬间秒关！
            document.body.classList.add('search-active');
            
            // 移动端/多端双重聚焦与唤起键盘优化
            sea.focus();
            setTimeout(() => {
                sea.focus();
                // 确保光标移到最末尾
                const val = sea.value;
                sea.value = '';
                sea.value = val;
            }, 50);
        };
        
        summonBtn.onclick = handleSummon;
        summonBtn.ontouchend = (e) => {
            e.preventDefault(); // 阻止默认点击，避免穿透与重复触发
            handleSummon(e);
        };
    }

    // 初始化清空搜索按钮
    const clearBtn = document.getElementById('sea-clear-btn');
    if (clearBtn) {
        clearBtn.onclick = (e) => {
            e.stopPropagation();
            sea.value = '';
            sea.dispatchEvent(new Event('input'));
            sea.focus();
        };
    }

    // 🚀 核心增加：将关闭事件精准绑定在 search-section 背景上，并强力消费 touch 触控，防止点击穿透。
    const searchSection = document.getElementById('search-section');
    if (searchSection) {
        const handleOverlayClose = (e) => {
            if (e.target === searchSection) {
                e.preventDefault();
                e.stopPropagation();
                closeSearch();
            }
        };
        searchSection.onclick = handleOverlayClose;
        searchSection.ontouchend = handleOverlayClose;

        // 🚀 核心增加（针对 iOS/Android 独享防滚动穿透）：
        searchSection.addEventListener('touchmove', (e) => {
            // 只要手指滑动的不是联想结果下拉列表（search-dropdown），就强制禁止页面背景层发生任何弹性滑移
            if (!e.target.closest('#sea-dropdown')) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    // 点击外部关闭搜索层（兜底保留，但点击穿透已被上方的 search-section.onclick/ontouchend 在捕获和消费流中 100% 阻断）
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
    const isAdminAction = (modalType === 'admin-hub' || modalType === 'system-config' || modalType === 'sync-center' || modalType === 'notice-center' || modalType === 'user-profile');

    if (!silent && isDataDirty && !isAdminAction && !isPageManagementMode) {
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

    // 4. 关闭视频预览弹窗并清除源 (Task V.4)
    const videoModal = document.getElementById('video-modal');
    if (videoModal && getComputedStyle(videoModal).display !== 'none') {
        const iframe = document.getElementById('video-iframe');
        if (iframe) iframe.src = ''; // 彻底阻断后台残留音频
        videoModal.style.display = 'none';
    }

    // 关闭键盘快捷键指南弹窗
    const keyboardHelpModal = document.getElementById('keyboard-help-modal');
    if (keyboardHelpModal) keyboardHelpModal.style.display = 'none';

    // Task 37.2: 焦点还原
    if (!silent && lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }

    // Task UM.4: 关闭所有弹窗时隐藏管理员批量操作栏
    const adminBar = document.getElementById('admin-user-batch-bar');
    if (adminBar) adminBar.classList.remove('visible');
};
window.closeAllModals = closeAllModals;

// Task EXIT.4: 统一退出暂存逻辑 (针对个人偏好设置与页面管理退出)
const handleDataSaveOnExit = async () => {
    if (!isDataDirty) return;
    
    // 默认退出页面管理先保存本地
    localStorage.setItem('nav_app_data', JSON.stringify(appData));
    await new Promise(r => setTimeout(r, 200));
    
    if (!sysToken) {
        isDataDirty = false;
        showToast("访客模式：修改已在本地生效（更换浏览器或清空缓存会导致数据丢失）", "#e67e22");
        return;
    }

    const intervalDays = appData.settings?.syncInterval || 0;
    if (intervalDays <= 0) {
        // 选择的是手动备份，仅进行本地保存提示
        await SyncUI.perform('LAYOUT_SAVE', async () => {
            isDataDirty = true; // 虽然已存在本地，在云端数据库来说依然是DIRTY，等待后续云端手动同步
        });
    } else {
        // 选择的是自动备份，根据实际自动备份时间策略判定是否需要即刻上传
        const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
        const now = Date.now();
        const threshold = intervalDays * 24 * 60 * 60 * 1000;
        
        if (now - lastSync > threshold) {
            // 到了备份的周期，在保存本地后，执行自动云端备份
            await SyncUI.perform('BACKUP_AUTO', async () => {
                try {
                    const uploadData = JSON.parse(JSON.stringify(appData));
                    if (uploadData.settings) {
                        delete uploadData.settings.themeMode;
                    }

                    const res = await fetch('/api/config', {
                        method: 'POST',
                        headers: { 
                            'Authorization': sysToken,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify(uploadData)
                    });

                    if (res.status === 401) {
                        throw new Error("登录态失效，自动同步失败");
                    }
                    
                    const data = await res.json();
                    if (res.ok && data.success) {
                        isDataDirty = false;
                        const now = Date.now();
                        localStorage.setItem('nav_last_cloud_sync', now.toString());
                        localStorage.setItem('nav_app_data', JSON.stringify(appData));
                        window.lastSyncFingerprint = getCoreDataFingerprint(appData);
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
            await SyncUI.perform('LAYOUT_SAVE', async () => {
                isDataDirty = true; // 虽然已存在本地，在云端数据库来说依然是DIRTY，等待下一次周期自动同步
            });
        }
    }
};
window.handleDataSaveOnExit = handleDataSaveOnExit;

// ==================== 9. Task 3.3: 页面管理模式 与 分类编辑 (已迁移至 page-manage.js) ====================


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
    let faviconUrl = null;
    let faviconDomain = '';

    if (searchQuery) {
        const cleanQuery = searchQuery.trim();
        const hasDot = cleanQuery.includes('.');
        const isUrlLike = cleanQuery.startsWith('http') || hasDot;
        
        let domain = cleanQuery;
        if (cleanQuery.startsWith('http')) {
            try {
                domain = new URL(cleanQuery).hostname;
            } catch(e) {}
        }
        
        if (isUrlLike && domain.length > 3) {
            faviconDomain = domain;
            faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        }
    }

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
    
    let htmlContent = '';
    if (faviconUrl) {
         htmlContent += `
             <div class="emoji-item favicon-suggest" 
                  style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; font-weight: bold; background: rgba(57, 157, 255, 0.15); border: 1px dashed var(--primary); padding: 8px; border-radius: 8px; margin-bottom: 10px; cursor: pointer; color: var(--text);" 
                  onclick="event.stopPropagation(); selectEmoji('${faviconUrl}')"
                  title="点击将此网络图标作为您的自定义书签图标">
                 <img src="${faviconUrl}" style="width: 16px; height: 16px; border-radius: 4px;" onerror="this.src='https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64'">
                 <span>使用智能网络图标: ${faviconDomain}</span>
             </div>
         `;
     }

    if (emojis.length === 0 && !faviconUrl) {
        gridContainer.innerHTML = `<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--text-dim); font-size: 13px;">
            未找到相关图标
        </div>`;
    } else {
        htmlContent += emojis.map(emoji => `
            <div class="emoji-item" title="点击选择" onclick="event.stopPropagation(); selectEmoji('${emoji}')">${emoji}</div>
        `).join('');
        gridContainer.innerHTML = htmlContent;
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

        // 针对书签图标编辑框，显式同步更新其预览框结构 (支持 Emoji 和网络 Favicon)
        const editIconPreview = document.getElementById('edit-icon-preview');
        if (editIconPreview) {
            if (emoji.startsWith('http')) {
                editIconPreview.innerHTML = `<img src="${emoji}" style="width:100%; height:100%; border-radius:4px;" onload="utils.handleIconLoad(this, '${emoji}')" onerror="utils.handleIconError(this, '${emoji}')">`;
            } else {
                editIconPreview.innerHTML = `<span>${emoji}</span>`;
            }
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

window.requireAdminAuth = (message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('admin-auth-modal');
        const msgEl = document.getElementById('auth-modal-message');
        const passInput = document.getElementById('auth-modal-password');
        const confirmBtn = document.getElementById('btn-auth-confirm');
        const cancelBtn = document.getElementById('btn-auth-cancel');
        
        if (!modal || !msgEl || !passInput) return resolve(null);
        
        msgEl.innerText = message || "此操作属于敏感安全授权变更，请输入管理员密码进行核验。";
        passInput.value = '';
        modal.style.display = 'flex';
        
        setTimeout(() => passInput.focus(), 150);

        const cleanup = (val) => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            passInput.onkeydown = null;
            resolve(val);
        };

        confirmBtn.onclick = () => {
            const val = passInput.value.trim();
            if (!val) {
                showToast("请输入密码以继续", "#e67e22");
                return;
            }
            cleanup(val);
        };

        cancelBtn.onclick = () => cleanup(null);

        passInput.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            else if (e.key === 'Escape') cancelBtn.click();
        };
    });
};

window.requireSystemConfirm = (title, message, isDanger = false) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('sys-confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        const iconEl = document.getElementById('confirm-modal-icon');
        const okBtn = document.getElementById('btn-confirm-ok');
        const cancelBtn = document.getElementById('btn-confirm-cancel');
        
        if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) return resolve(false);
        
        titleEl.innerText = title || "安全确认";
        msgEl.innerText = message || "确定要执行此操作吗？";
        
        // 危险操作高亮警示
        if (isDanger) {
            if (iconEl) {
                iconEl.style.color = '#e74c3c';
                iconEl.innerHTML = '<i class="ri-alert-line"></i>';
            }
            okBtn.style.background = '#e74c3c';
            okBtn.style.borderColor = '#e74c3c';
            okBtn.style.color = '#fff';
            okBtn.innerText = "确认执行";
        } else {
            if (iconEl) {
                iconEl.style.color = '#f39c12';
                iconEl.innerHTML = '<i class="ri-error-warning-line"></i>';
            }
            okBtn.style.background = 'var(--primary)';
            okBtn.style.borderColor = 'var(--primary)';
            okBtn.style.color = '#fff';
            okBtn.innerText = "确认";
        }
        
        modal.style.display = 'flex';
        
        const cleanup = (val) => {
            modal.style.display = 'none';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(val);
        };
        
        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
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
            <span style="color:var(--text-dim); font-size:12px;">提示: 修改后点击下方“应用”保存本地</span>
        </div>
        <div id="monaco-container" style="height: 400px; border-radius: 8px; overflow: hidden; border: 1px solid var(--glass-border);"></div>
    `;
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = "应用并暂存本地";

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
            
            // 智能清洗脏配置 (Task NT-V2.12)
            if (parsed.settings) {
                delete parsed.settings.cardWidth;
            }
            
            // Task 4.3: 专家模式配额校验
            const quota = appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
            if (parsed.categories.length > quota.maxCategories) throw new Error(`分类数量超出上限 (${quota.maxCategories})`);
            for (const cat of parsed.categories) {
                const count = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
                if (count > quota.maxItemsPerCategory) throw new Error(`分类 [${cat.name}] 下的书签数量 (${count}) 超出上限 (${quota.maxItemsPerCategory})`);
            }

            appData = parsed;
            showLoader('正在应用专家配置...');
            window.isDataDirty = true;
            localStorage.setItem('nav_app_data', JSON.stringify(appData));
            renderNav();
            modal.style.display = 'none';
            if (window.sysToken) {
                showToast("配置已应用至本地，退出页面管理时将自动同步至云端", "#27ae60");
            } else {
                showToast("访客模式：配置已应用至本地", "#e67e22");
            }
        } catch (e) {
            showToast(`JSON 格式错误: ${e.message}`, "#e74c3c");
        } finally {
            hideLoader();
        }
    };
};
window.openJsonEditor = openJsonEditor;

const initGlobalEvents = () => {
    // 快捷导航按钮逻辑 (Task 4.2)
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
        if (activeModal || isPageManagementMode) return;

        const sea = document.getElementById('sea-input');
        if (sea) {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData) {
                e.preventDefault();
                document.body.classList.add('search-active');
                sea.value = pasteData;
                sea.focus();
                
                // 唤起禅意模式下展开逻辑
                if (appData.settings?.zenMode && !isZenTempExpanded) {
                    isZenTempExpanded = true;
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
            if (isPageManagementMode) {
                e.preventDefault();
                togglePageManagement(false);
                return;
            }
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open') && !isSidebarPinned) {
                toggleSidebar(false);
                return;
            }
            if (appData.settings?.zenMode && isZenTempExpanded) {
                isZenTempExpanded = false;
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
                const isZen = appData.settings?.zenMode === true;
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
                const isZen = appData.settings?.zenMode === true;
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
            if (activeModal || isPageManagementMode) return;
            e.preventDefault();
            
            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar?.classList.contains('open');
            
            if (!isOpen && appData.settings?.zenMode && document.body.classList.contains('zen-silent')) {
                wakeUpNavigation();
            }
            
            toggleSidebar(!isOpen);
            return;
        }

        // 5. Alt+Z / Ctrl+Z 禅意模式一键切换
        if ((e.altKey || isCtrl) && key === 'z') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || isPageManagementMode) return;
            if (e.altKey) {
                e.preventDefault();
                window.toggleZenMode(undefined, true);
            }
            return;
        }

        // 6. 快捷输入一键唤醒搜索
        if (!isInput && (e.key.length === 1 || key === '/') && !isCtrl && !e.altKey) {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || isPageManagementMode) return;
            const sea = document.getElementById('sea-input');
            if (sea) {
                if (key === '/') e.preventDefault();
                document.body.classList.add('search-active');
                sea.focus();
            }
        }

        // 7. Ctrl + L 唤起个人/登录面板
        if ((isCtrl || e.altKey) && key === 'l') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || isPageManagementMode) return;
            e.preventDefault();
            showAuthModal();
            return;
        }

        // 8. Ctrl+K 快捷聚焦并清空搜索
        if (isCtrl && key === 'k') {
            const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => getComputedStyle(m).display !== 'none');
            if (activeModal || isPageManagementMode) return;
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
            if (activeModal || isPageManagementMode) return;
            const sea = document.getElementById('sea-input');
            if (sea) {
                document.body.classList.add('search-active');
                sea.focus();
                
                // 唤起禅意模式下展开逻辑
                if (appData.settings?.zenMode && !isZenTempExpanded) {
                    isZenTempExpanded = true;
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
        appData = data;
        isAdmin = false; // 分享主页对访客绝对禁止管理员权限
        currentUser = null; // 访客无当前用户
        sysToken = null; // 无 token
        
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

window.handleAuthError = handleAuthError;
window.AuditActionMap = AuditActionMap;
window.refreshNoticeBadge = refreshNoticeBadge;
window.initAnnouncements = initAnnouncements;
