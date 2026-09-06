/**
 * @fileoverview Feature module: search
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

const initSearch = () => {
    const sea = document.getElementById('sea-input');
    const dropdown = document.getElementById('sea-dropdown');
    const resultsList = document.getElementById('local-results-list');
    const engineTrigger = document.getElementById('current-engine-trigger');
    const engineList = document.getElementById('engine-list');
    if (!sea || !dropdown || !resultsList) return;

    // 初始化搜索引擎切换逻辑
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

            window.currentEnginePrefix = action;
            localStorage.setItem('nav_search_prefix', action);
            localStorage.setItem('nav_search_engine', engine);

            engineTrigger.innerHTML = logo;
            document.querySelectorAll('.engine-item').forEach(el => el.classList.toggle('active', el === item));
            engineList.classList.remove('show');

            if (window.sysToken && window.appData.settings) {
                window.appData.settings.searchEngine = engine;
                if (!silent) window.isDataDirty = true;
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

        // 4. 恢复初始状态（本地 localStorage 优先于云端，保证本机切换可持久）
        const savedEngine = localStorage.getItem('nav_search_engine')
            || (window.sysToken && window.appData.settings?.searchEngine)
            || 'bing';
        window.setSearchEngine(savedEngine, true);
    };

    initEngineSwitcher();

    sea.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const val = sea.value.trim();
            if (val) {
                // 搜索历史持久化
                window.searchHistory = [val, ...window.searchHistory.filter(h => h !== val)].slice(0, 20);
                localStorage.setItem('search_history', JSON.stringify(window.searchHistory));
                window.historyIndex = -1;

                // 如果有选中的搜索项，优先跳转
                const activeItem = resultsList.querySelector('.local-result-item.active');
                if (activeItem) {
                    activeItem.click();
                } else {
                    window.open(window.currentEnginePrefix + encodeURIComponent(val), '_blank');
                }
            }
        }
        // 键盘上下选择
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
            const items = Array.from(resultsList.querySelectorAll('.local-result-item'));

            // 空输入态下的历史回溯
            if (items.length === 0 || !sea.value.trim()) {
                if (window.searchHistory.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowUp') {
                        window.historyIndex = Math.min(window.historyIndex + 1, window.searchHistory.length - 1);
                    } else {
                        window.historyIndex = Math.max(window.historyIndex - 1, -1);
                    }
                    sea.value = window.historyIndex === -1 ? '' : window.searchHistory[window.historyIndex];
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

    // 搜索态视觉隔离逻辑 增强)
    sea.addEventListener('input', (e) => {
        // 如果不是由脚本触发的（即用户手动输入），则重置历史索引
        if (e.isTrusted) window.historyIndex = -1;

        const val = sea.value.trim().toLowerCase();
        const hasText = val.length > 0;
        document.body.classList.toggle('is-searching', hasText);

        if (hasText) {
            // 执行站内模糊搜索 (升级为支持 Title, Desc 之外并列匹配 URL 协议和域名)
            const matches = window.appData.items.filter(i =>
                (i.title.toLowerCase().includes(val) ||
                 (i.desc && i.desc.toLowerCase().includes(val)) ||
                 (i.url && i.url.toLowerCase().includes(val))) &&
                (window.isAdmin || !i.hidden)
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
                        <div class="local-result-item ${idx === 0 ? 'active' : ''}" onclick="recordClick('${m.id}'); window.open('${m.url}', '${window.appData.settings?.link_target || '_blank'}')">
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

    // Zen Mode 唤醒逻辑
    sea.addEventListener('focus', () => {
        document.body.classList.add('search-active');
        if (window.appData.settings?.zenMode && !window.isZenTempExpanded) {
            window.isZenTempExpanded = true;
            renderNav();
        }
    });

    // 召唤按钮点击逻辑
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

// 关闭搜索层并重置状态
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


export function initSearchUx() {

    var ENGINE_KEY = 'nav_search_engine';
    var PREFIX_KEY = 'nav_search_prefix';

    function getSea() {
        return document.getElementById('sea-input');
    }

    function isEditableTarget(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        return false;
    }

    function hasOpenModal() {
        return Array.from(document.querySelectorAll('.modal')).some(function (m) {
            return getComputedStyle(m).display !== 'none';
        });
    }

    function isPageManage() {
        return window.isPageManagementMode;
    }

    /** 本地已选引擎（仅 key） */
    function getLocalEngine() {
        try {
            return localStorage.getItem(ENGINE_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * 应用本地引擎；若 setSearchEngine 可用则走官方路径，否则只修 UI/prefix
     */
    function applyLocalEngine(silent) {
        var engine = getLocalEngine();
        if (!engine) return;

        if (typeof window.setSearchEngine === 'function') {
            window.setSearchEngine(engine, silent !== false);
            return;
        }

        // setSearchEngine 尚未就绪时的兜底
        var item = document.querySelector('.engine-item[data-engine="' + engine + '"]');
        if (!item) return;
        var action = item.getAttribute('data-action');
        var logoEl = item.querySelector('.engine-logo');
        var trigger = document.getElementById('current-engine-trigger');
        if (action && typeof window.currentEnginePrefix !== 'undefined') {
            // eslint-disable-next-line no-undef
            window.currentEnginePrefix = action;
        }
        try {
            if (action) localStorage.setItem(PREFIX_KEY, action);
            localStorage.setItem(ENGINE_KEY, engine);
        } catch (e) { /* ignore */ }
        if (trigger && logoEl) trigger.innerHTML = logoEl.innerText;
        document.querySelectorAll('.engine-item').forEach(function (el) {
            el.classList.toggle('active', el === item);
        });
    }

    /**
     * 包装 setSearchEngine：切换时强制写 localStorage；
     * 云端 silent 恢复时若本地已有选择，以本地为准。
     */
    function wrapSetSearchEngine() {
        if (typeof window.setSearchEngine !== 'function') return false;
        if (window.setSearchEngine.__searchUxWrapped) return true;

        var original = window.setSearchEngine;
        window.setSearchEngine = function (engine, silent) {
            var local = getLocalEngine();
            // 静默恢复（云端/初始化）时：本地有选择则坚持本地
            if (silent && local && local !== engine) {
                engine = local;
            }
            original.call(this, engine, silent);
            // 再写一遍，防止上游路径漏写
            try {
                if (engine) localStorage.setItem(ENGINE_KEY, engine);
                var item = document.querySelector('.engine-item[data-engine="' + engine + '"]');
                if (item && item.dataset.action) {
                    localStorage.setItem(PREFIX_KEY, item.dataset.action);
                }
            } catch (e) { /* ignore */ }
        };
        window.setSearchEngine.__searchUxWrapped = true;
        return true;
    }

    function tryWrapAndApply() {
        if (wrapSetSearchEngine()) {
            applyLocalEngine(true);
            return true;
        }
        return false;
    }

    /** 将首字符写入搜索框并激活搜索态 */
    function activateSearchWithChar(ch) {
        var sea = getSea();
        if (!sea) return;

        document.body.classList.add('search-active');

        if (ch && ch !== '/') {
            // 若当前已有焦点且已有内容，不覆盖（仅全局唤醒场景会调用）
            var start = sea.selectionStart != null ? sea.selectionStart : sea.value.length;
            var end = sea.selectionEnd != null ? sea.selectionEnd : sea.value.length;
            var v = sea.value;
            sea.value = v.slice(0, start) + ch + v.slice(end);
        }

        sea.focus();
        try {
            var pos = sea.value.length;
            sea.setSelectionRange(pos, pos);
        } catch (e) { /* ignore */ }

        sea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Capture 阶段：可打印键唤醒搜索并保留首字符
     * 先于 app.js 冒泡处理，避免 focus 后字符已丢失
     */
    function onKeydownCapture(e) {
        if (!e.key) return;
        if (e.isComposing || e.keyCode === 229) return; // IME 组字中不截获
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        var active = document.activeElement;
        if (isEditableTarget(active)) return;
        if (hasOpenModal() || isPageManage()) return;

        var key = e.key;
        var isSlash = key === '/';
        var isPrintable = key.length === 1;

        if (!isPrintable && !isSlash) return;

        // 已在搜索框则交给原生
        if (active && active.id === 'sea-input') return;

        e.preventDefault();
        // 标记已处理，避免 app.js 冒泡阶段再追加一次首字符
        e.searchUxHandled = true;
        // 不 stopImmediatePropagation，保留 app.js 其它快捷键逻辑
        activateSearchWithChar(isSlash ? '' : key);
    }

    /** 页面获得焦点且无其它输入时，尝试聚焦搜索框 */
    function tryFocusSearch(force) {
        if (hasOpenModal() || isPageManage()) return;
        var active = document.activeElement;
        if (!force && isEditableTarget(active) && active.id !== 'sea-input') return;

        var sea = getSea();
        if (!sea) return;

        // 用户正在选中文字时不强抢
        try {
            var sel = window.getSelection && window.getSelection();
            if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
        } catch (e) { /* ignore */ }

        sea.focus({ preventScroll: true });
    }

    function init() {
        // 包装引擎切换（app.js initSearch 之后）
        if (!tryWrapAndApply()) {
            var n = 0;
            var timer = setInterval(function () {
                n += 1;
                if (tryWrapAndApply() || n > 40) clearInterval(timer);
            }, 100);
        }

        // 云端数据渲染后可能再次覆盖引擎，延迟再应用本地
        setTimeout(function () { applyLocalEngine(true); }, 800);
        setTimeout(function () { applyLocalEngine(true); }, 2000);

        document.addEventListener('keydown', onKeydownCapture, true);

        // 首屏 / 从 bfcache 回来时 best-effort 聚焦
        setTimeout(function () { tryFocusSearch(true); }, 0);
        setTimeout(function () { tryFocusSearch(true); }, 300);

        window.addEventListener('pageshow', function () {
            setTimeout(function () { tryFocusSearch(true); }, 50);
        });

        // 标签页重新可见且无输入焦点时，拉回搜索框（不抢地址栏，仅页面内）
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                setTimeout(function () { tryFocusSearch(false); }, 80);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // app.js 也在 DOMContentLoaded 里 initSearch，延后一拍确保 setSearchEngine 已挂上
            setTimeout(init, 0);
        });
    } else {
        setTimeout(init, 0);
    }

    // 导出便于调试
    window.SearchUX = {
        applyLocalEngine: applyLocalEngine,
        getLocalEngine: getLocalEngine,
        tryFocusSearch: tryFocusSearch
    };
}
// Window bridge for cross-module and inline onclick callers
window.initSearch = initSearch;
window.closeSearch = closeSearch;
