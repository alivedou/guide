/**
 * search-ux.js — 搜索体验增量补丁（不改业务结构）
 *
 * 1. 搜索引擎本地优先持久化（localStorage 为源，云端不覆盖本地选择）
 * 2. 任意可打印键唤醒搜索框时保留首字符
 * 3. 页面可见时 best-effort 聚焦搜索框（浏览器地址栏焦点无法强制抢占）
 */
(function () {
    'use strict';

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
        return typeof isPageManagementMode !== 'undefined' && isPageManagementMode;
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
        if (action && typeof currentEnginePrefix !== 'undefined') {
            // eslint-disable-next-line no-undef
            currentEnginePrefix = action;
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
})();
