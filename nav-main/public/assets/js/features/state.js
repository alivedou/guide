/**
 * Shared mutable UI state. Feature modules read/write through window getters.
 */
/**
 * @fileoverview
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

// 获取核心数据指纹（仅包含分类和网址内容）
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
let currentUser = JSON.parse(localStorage.getItem('nav_current_user') || 'null'); 
let isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_user'); // 根据持久化凭证智能对齐管理员权限状态
let isZenTempExpanded = true;
let isActuallyZen = false;
let isRendering = false; // 渲染防抖锁
let lastSyncFingerprint = ''; // 数据指纹，用于过滤无效同步
let isPageManagementMode = false; // 页面管理模式开关
let zenMoveAccumulator = 0; // 禅意模式位移累加器
let lastMouseX = 0;
let lastMouseY = 0;
let isSidebarPinned = localStorage.getItem('nav_sidebar_pinned') !== 'false'; // 默认开启图钉
let selectedIds = new Set(); // 已选中的 ID 集合
let sortableInstances = []; // Sortable 实例存储
let syncTimer = null; // 同步防抖计时器
let syncRetryCount = 0; // 重试计数
let touchStartY = 0; // 触摸起点
let currentSearchIndex = -1;
let historyIndex = -1;
let searchHistory = JSON.parse(localStorage.getItem('search_history') || '[]');
// themeMode state is now managed globally by theme-mode.js
let simpleMode = localStorage.getItem('nav_simple_mode') === 'true';
let currentEnginePrefix = localStorage.getItem('nav_search_prefix') || 'https://cn.bing.com/search?q=';
let isDataDirty = false; // 全局数据变更标记
let lastSyncActionTime = 0; // 云端同步冷却计时器
let currentEditingAnnounceId = null; // 正在编辑的公告 ID
let lastFocusedElement = null; // 记录弹窗前的焦点元素
let adminUserFilters = { page: 1, pageSize: 20, keyword: '', status: '' }; // 管理员用户筛选
let adminSelectedUserIds = new Set(); // 选中的用户 ID
let adminAnnounceFilters = { page: 1, pageSize: 20, keyword: '', status: '', type: '' }; // 公告筛选
let adminSelectedAnnounceIds = new Set(); // 选中的公告 ID
let adminInviteFilters = { page: 1, pageSize: 20, keyword: '', status: '' }; // 邀请码筛选
let adminSelectedInviteIds = new Set(); // 选中的邀请码
let adminSelectedAuditIds = new Set(); // 选中的审计日志
let adminAuditFilters = { page: 1, pageSize: 20, keyword: '', actionType: '' }; // 审计日志筛选
let adminData = { users: [], invitations: [], announcements: [], logs: [], pagination: {} }; // 管理员全站数据缓存
let navLocalBgImage = null; // 本地缓存的高清 Base64 壁纸全局缓存，支持 10MB

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


let cachedAnnouncements = [];
Object.defineProperty(window, 'cachedAnnouncements', {
    get() { return cachedAnnouncements; },
    set(v) { cachedAnnouncements = v; },
    configurable: true
});

