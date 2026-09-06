/**
 * @fileoverview Feature module: misc
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
const requireAdminAuth = (...args) => window.requireAdminAuth(...args);
const requireSystemConfirm = (...args) => window.requireSystemConfirm(...args);
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

// ==================== 9. 页面管理模式 与 分类编辑 (已迁移至 page-manage.js) ====================


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
    // 兼容分类图标和网址图标编辑框 (增加 edit-icon 支持)
    const iconInput = document.getElementById('edit-cat-icon') || document.getElementById('edit-icon');
    if (iconInput) {
        iconInput.value = emoji;
        // 如果存在预览框，同步更新预览
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
    // 切换弹窗启用静默模式
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
                value: JSON.stringify(window.appData, null, 4),
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

            // 智能清洗脏配置
            if (parsed.settings) {
                delete parsed.settings.cardWidth;
            }

            // 专家模式配额校验
            const quota = window.appData.quota || { maxCategories: 12, maxItemsPerCategory: 25 };
            if (parsed.categories.length > quota.maxCategories) throw new Error(`分类数量超出上限 (${quota.maxCategories})`);
            for (const cat of parsed.categories) {
                const count = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
                if (count > quota.maxItemsPerCategory) throw new Error(`分类 [${cat.name}] 下的书签数量 (${count}) 超出上限 (${quota.maxItemsPerCategory})`);
            }

            window.appData = parsed;
            showLoader('正在应用专家配置...');
            window.isDataDirty = true;
            localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
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
window.openJsonEditor = openJsonEditor;
// Window bridge for cross-module and inline onclick callers
window.getEmojiPickerHTML = getEmojiPickerHTML;
