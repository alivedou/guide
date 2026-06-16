/**
 * page-manage.js
 * 页面管理模块 (Page Management Module)
 * 负责前台卡片编辑、分类的新增与删除、卡片显示隐藏切换与排序。
 */

// ==================== 1. 页面管理模式切换 ====================
const togglePageManagement = (force) => {
    // Task 17.3: 允许所有角色进入页面管理模式，移除 isAdmin 硬拦截
    
    // Task 10.6.2: 交互锁定逻辑 - 如果当前已是管理模式且尝试通过侧边栏点击（force 未定义），则不执行切换（关闭）
    // 强制引导用户通过“保存并退出”按钮或 Esc 退出
    if (window.isPageManagementMode && typeof force === 'undefined') {
        return showToast("请点击顶部或下方的“保存并退出”按钮完成管理", "#3498db");
    }

    // Task 9.6: 进入管理模式前清理所有弹窗
    closeAllModals();

    window.isPageManagementMode = typeof force === 'boolean' ? force : !window.isPageManagementMode;
    document.body.classList.toggle('page-manage-active', window.isPageManagementMode);
    
    // Task 11.4: 必须先进行视图渲染，确保 DOM 节点存在
    updateStyles(); // 🚀 确保在页面管理切换时，即时解禁/隐退禅意模式并应用标准布局！
    renderTools();
    renderNav();

    if (window.isPageManagementMode) {
        window.selectedIds.clear();
        showToast("进入管理模式：拖拽卡片重新排序，或点击分类图标编辑", "#3498db");
        // 渲染后再初始化拖拽插件
        initSortable();
    } else {
        destroySortable();
        // Task 22.3: 统一接入自动保存与引导逻辑 (Task EXIT.4)
        if (typeof window.handleDataSaveOnExit === 'function') {
            window.handleDataSaveOnExit();
        }
        
        window.selectedIds.clear();
        updateBatchBar();
        // Task 4.8.2: 深度状态重置 (关闭可能打开的专家模式编辑器)
        const monacoModal = document.getElementById('monaco-modal');
        if (monacoModal) monacoModal.style.display = 'none';
    }
};

// ==================== 2. 分类可视化设置与编辑 ====================
const openCategoryEditModal = (catId) => {
    window.lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const isEdit = !!catId;
    const cat = isEdit 
        ? window.appData.categories.find(c => c.id === catId)
        : { name: '', icon: '📂' };

    if (isEdit && !cat) return;

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = isEdit ? "编辑分类" : "添加新分类";

    const safeTitle = utils.escapeHTML(cat.name || '');
    const safeIcon = utils.escapeHTML(cat.icon || '📂');

    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-font-size"></i> 分类名称</label>
            <input type="text" id="edit-cat-name" value="${safeTitle}" placeholder="如：社交媒体" style="width:100%;">
        </div>
        <div class="form-row">
            <label><i class="ri-image-line"></i> 分类图标</label>
            <div style="display:flex; gap:8px; width:100%; align-items:center;">
                <input type="text" id="edit-icon" value="${safeIcon}" placeholder="Emoji 或 图片 URL">
                <div id="edit-icon-preview" class="preview-container">
                    ${cat.icon?.startsWith('http') ? `<img src="${cat.icon}">` : `<span>${cat.icon || '📂'}</span>`}
                </div>
            </div>
        </div>

        <!-- ==================== 2. 智能图标联合搜索 (Iconify + Emoji) ==================== -->
        <div class="form-row" style="background:rgba(255,255,255,0.02); border-radius:12px; padding:10px; margin-bottom:15px; border: 1px solid var(--glass-border);">
            <label style="font-size:12px; font-weight:bold; color:var(--text); margin-bottom:6px;"><i class="ri-search-eye-line"></i> 智能图标搜索与推荐</label>
            <div style="display:flex; flex-direction:column; width:100%; gap:6px;">
                <div style="display:flex; gap:8px;">
                    <input id="emoji-recommend-title" value="${safeTitle}" placeholder="输入英文/拼音/中文关键词, 如 github" style="flex:1; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; height:36px; padding:0 10px; color:var(--text);">
                    <button type="button" class="icon-btn-action" id="btn-emoji-recommend" style="border: 1px solid var(--primary); color: white; background: var(--primary); width:60px; height:36px; border-radius:8px; font-size:13px; cursor:pointer;">搜索</button>
                    <button type="button" class="icon-btn-action" id="btn-emoji-refresh" title="换一组 Emoji" style="padding:0 12px; height:36px; border-radius:8px; cursor:pointer; background:var(--glass-bg); border:1px solid var(--glass-border); color:var(--text);"><i class="ri-refresh-line"></i></button>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                    <div style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px;"><i class="ri-magic-line"></i> 智能 Emoji 推荐:</div>
                    <div id="emoji-results" style="display:flex; flex-wrap:wrap; gap:6px; max-height:60px; overflow-y:auto; padding:2px 0;">
                        ${cat.icon && !cat.icon.startsWith('http') ? `<span class="emoji-suggestion selected" data-emoji="${cat.icon}">${cat.icon}</span>` : ''}
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                    <div style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px;"><i class="ri-search-eye-line"></i> Iconify 矢量图标:</div>
                    <div id="iconify-results" style="display:flex; flex-wrap:wrap; gap:6px; max-height:80px; overflow-y:auto; padding:2px 0;"></div>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';

    // 实时图标预览
    document.getElementById('edit-icon').oninput = (e) => {
        const val = e.target.value.trim();
        const preview = document.getElementById('edit-icon-preview');
        preview.innerHTML = val.startsWith('http') ? `<img src="${val}">` : `<span>${val || '📂'}</span>`;
    };

    // 绑定智能 Emoji 推荐与 Iconify 联合搜索
    document.getElementById('btn-emoji-recommend').addEventListener('click', () => recommendEmojisAndSearchIconify(false));
    document.getElementById('btn-emoji-refresh').addEventListener('click', () => recommendEmojisAndSearchIconify(true));
    document.getElementById('emoji-recommend-title').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') recommendEmojisAndSearchIconify(false);
    });

    // 自动触发初始联合搜索
    if (cat.name) {
        recommendEmojisAndSearchIconify(false);
    }

    // 监听分类名称输入，同步到联合搜索标题
    document.getElementById('edit-cat-name').addEventListener('input', (e) => {
        const recTitleInput = document.getElementById('emoji-recommend-title');
        if (recTitleInput) {
            recTitleInput.value = e.target.value.trim();
        }
    });

    // Task 37.2: 自动聚焦
    setTimeout(() => {
        document.getElementById('edit-cat-name')?.focus();
    }, 50);

    confirmBtn.onclick = async () => {
        const newName = document.getElementById('edit-cat-name').value.trim();
        const newIcon = document.getElementById('edit-icon').value.trim();
        
        if (!newName) return showToast("名称不能为空", "#e67e22");
        
        if (isEdit) {
            cat.name = newName;
            cat.icon = newIcon || '📂';
            if (window.sysToken) {
                showToast("分类修改已本地保存，将根据云端策略自动备份", "#3498db");
            } else {
                showToast("访客模式：分类修改已本地生效（更换浏览器会丢失）", "#e67e22");
            }
        } else {
            const newCat = {
                id: 'cat_' + Date.now(),
                name: newName,
                icon: newIcon || '📂',
                hidden: false
            };
            window.appData.categories.push(newCat);
            if (window.sysToken) {
                showToast("新分类已本地添加，将根据云端策略自动备份", "#27ae60");
            } else {
                showToast("访客模式：新分类已本地添加（更换浏览器会丢失）", "#e67e22");
            }
        }
        window.isDataDirty = true;
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        
        modal.style.display = 'none';
        renderNav();
    };
};

const deleteCategory = async (catId) => {
    const ok = await window.requireSystemConfirm("删除分类确认", "您确定要删除此分类吗？删除后，此分类下的所有书签都将被永久移除！此操作不可逆！", true);
    if (!ok) return;

    const catIndex = window.appData.categories.findIndex(c => c.id === catId);
    if (catIndex > -1) {
        window.appData.categories.splice(catIndex, 1);
    }
    // 级联删除该分类下的所有卡片
    window.appData.items = window.appData.items.filter(item => item.catId !== catId && item.cat_id !== catId);

    window.isDataDirty = true;
    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
    showToast("分类已删除并本地保存", "#27ae60");
    renderNav();
};

const toggleCategoryVisibility = (catId) => {
    const cat = window.appData.categories.find(c => c.id === catId);
    if (cat) {
        cat.hidden = !cat.hidden;
        window.isDataDirty = true;
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        showToast(cat.hidden ? "分类已设置为仅管理员可见并本地保存" : "分类已设置为公开显示并本地保存", "#3498db");
        renderNav();
    }
};

const toggleCategoryVideoMode = (catId) => {
    const cat = window.appData.categories.find(c => c.id === catId);
    if (cat) {
        cat._isVideo = !cat._isVideo;
        window.isDataDirty = true;
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        showToast(cat._isVideo ? "已将当前分类切换为「宽屏视频流」模式并本地保存" : "已将当前分类还原为「普通网址导航」模式并本地保存", "#3498db");
        renderNav();
    }
};

// ==================== 3. 书签卡片设置与编辑 ====================
const openEditModal = (id) => {
    window.lastFocusedElement = document.activeElement; // Task 37.2
    // Task 9.6 & O++.1: 切换弹窗启用静默模式
    closeAllModals(true);

    const item = window.appData.items.find(i => i.id === id) || { id: '', title: '', url: '', icon: '', desc: '', cat_id: window.activeCatId };
    const modal = document.getElementById('edit-modal');
    const body = document.getElementById('edit-form-body');
    if (!modal || !body) return;

    modal.setAttribute('data-editing-id', id);
    document.getElementById('edit-title').innerText = id ? '编辑书签' : '添加新书签';

    const safeTitle = utils.escapeHTML(item.title);
    const safeIcon = utils.escapeHTML(item.icon);

    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-link"></i> 网址</label>
            <div style="display:flex; gap:8px; width:100%">
                <input type="text" id="edit-url" value="${item.url}" placeholder="https://...">
                <button id="btn-magic-wand" class="icon-btn-action" title="一键抓取并修复图标" onclick="triggerMagicWand()">
                    <i class="ri-magic-line"></i>
                </button>
            </div>
        </div>
        <div class="form-row">
            <label><i class="ri-font-size"></i> 标题</label>
            <input type="text" id="edit-title-input" value="${safeTitle}" placeholder="网站名称">
        </div>
        <div class="form-row">
            <label><i class="ri-image-line"></i> 图标</label>
            <div style="display:flex; gap:8px; width:100%; align-items:center;">
                <input type="text" id="edit-icon" value="${safeIcon || ''}" placeholder="Emoji 或 图片 URL">
                <div id="edit-icon-preview" class="preview-container">
                    ${item.icon?.startsWith('http') ? `<img src="${item.icon}">` : `<span>${item.icon || '🔗'}</span>`}
                </div>
            </div>
        </div>

        <!-- ==================== 1. 多源图标备份 (自动抓取测速) ==================== -->
        <div style="display: none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; color:#aaa;"><i class="ri-refresh-line"></i> 多源图标备份 (自动抓取)</span>
            </div>
            <div class="form-row" style="margin-bottom:8px; display:flex; align-items:center;"><label style="font-size:11px; font-weight:normal; color:#999; width:110px; margin-bottom:0;">原生图标 (Origin)</label>
                <div style="display:flex; align-items:center; flex:1;">
                    <input type="radio" name="icon_sel" id="opt-fav0" style="width:18px; height:18px; flex-shrink:0; margin:0 8px 0 0; cursor:pointer;" disabled>
                    <input id="txt-fav0" readonly placeholder="站点根目录 favicon.ico" style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3); height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); padding:0 8px;">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3); width:32px; height:32px; margin-left:8px; border-radius:6px;"><img id="img-fav0" src="" loading="lazy" style="width:18px; height:18px; display:none;"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:8px; display:flex; align-items:center;"><label style="font-size:11px; font-weight:normal; color:#999; width:110px; margin-bottom:0;">Iowen API (首选)</label>
                <div style="display:flex; align-items:center; flex:1;">
                    <input type="radio" name="icon_sel" id="opt-fav1" style="width:18px; height:18px; flex-shrink:0; margin:0 8px 0 0; cursor:pointer;" disabled>
                    <input id="txt-fav1" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3); height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); padding:0 8px;">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3); width:32px; height:32px; margin-left:8px; border-radius:6px;"><img id="img-fav1" src="" loading="lazy" style="width:18px; height:18px; display:none;"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:8px; display:flex; align-items:center;"><label style="font-size:11px; font-weight:normal; color:#999; width:110px; margin-bottom:0;">DuckDuckGo API</label>
                <div style="display:flex; align-items:center; flex:1;">
                    <input type="radio" name="icon_sel" id="opt-fav2" style="width:18px; height:18px; flex-shrink:0; margin:0 8px 0 0; cursor:pointer;" disabled>
                    <input id="txt-fav2" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3); height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); padding:0 8px;">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3); width:32px; height:32px; margin-left:8px; border-radius:6px;"><img id="img-fav2" src="" loading="lazy" style="width:18px; height:18px; display:none;"></div>
                </div>
            </div>
            <div class="form-row" style="margin-bottom:0; display:flex; align-items:center;"><label style="font-size:11px; font-weight:normal; color:#999; width:110px; margin-bottom:0;">Google API</label>
                <div style="display:flex; align-items:center; flex:1;">
                    <input type="radio" name="icon_sel" id="opt-fav3" style="width:18px; height:18px; flex-shrink:0; margin:0 8px 0 0; cursor:pointer;" disabled>
                    <input id="txt-fav3" readonly placeholder="..." style="flex:1; min-width:0; color:#aaa; font-size:11px; cursor:pointer; background:rgba(0,0,0,0.3); height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); padding:0 8px;">
                    <div class="preview-container" style="background:rgba(0,0,0,0.3); width:32px; height:32px; margin-left:8px; border-radius:6px;"><img id="img-fav3" src="" loading="lazy" style="width:18px; height:18px; display:none;"></div>
                </div>
            </div>
        </div>

        <!-- ==================== 2. 智能图标联合搜索 (Iconify + Emoji) ==================== -->
        <div class="form-row" style="background:rgba(255,255,255,0.02); border-radius:12px; padding:10px; margin-bottom:15px; border: 1px solid var(--glass-border);">
            <label style="font-size:12px; font-weight:bold; color:var(--text); margin-bottom:6px;"><i class="ri-search-eye-line"></i> 智能图标搜索与推荐</label>
            <div style="display:flex; flex-direction:column; width:100%; gap:6px;">
                <div style="display:flex; gap:8px;">
                    <input id="emoji-recommend-title" value="${safeTitle}" placeholder="输入英文/拼音/中文关键词, 如 github" style="flex:1; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; height:36px; padding:0 10px; color:var(--text);">
                    <button type="button" class="icon-btn-action" id="btn-emoji-recommend" style="border: 1px solid var(--primary); color: white; background: var(--primary); width:60px; height:36px; border-radius:8px; font-size:13px; cursor:pointer;">搜索</button>
                    <button type="button" class="icon-btn-action" id="btn-emoji-refresh" title="换一组 Emoji" style="padding:0 12px; height:36px; border-radius:8px; cursor:pointer; background:var(--glass-bg); border:1px solid var(--glass-border); color:var(--text);"><i class="ri-refresh-line"></i></button>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                    <div style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px;"><i class="ri-magic-line"></i> 智能 Emoji 推荐:</div>
                    <div id="emoji-results" style="display:flex; flex-wrap:wrap; gap:6px; max-height:60px; overflow-y:auto; padding:2px 0;">
                        ${safeIcon && !safeIcon.startsWith('http') ? `<span class="emoji-suggestion selected" data-emoji="${safeIcon}">${safeIcon}</span>` : ''}
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                    <div style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px;"><i class="ri-search-eye-line"></i> Iconify 矢量图标:</div>
                    <div id="iconify-results" style="display:flex; flex-wrap:wrap; gap:6px; max-height:80px; overflow-y:auto; padding:2px 0;"></div>
                </div>
            </div>
        </div>

        <div class="form-row">
            <label><i class="ri-text-snippet"></i> 描述</label>
            <textarea id="edit-desc" rows="2" placeholder="可选描述" style="width:100%; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; color:var(--text); padding:8px;">${item.desc || ''}</textarea>
        </div>
        <div class="form-row">
            <label><i class="ri-folders-line"></i> 分类</label>
            <select id="edit-cat">
                ${window.appData.categories.map(c => `<option value="${c.id}" ${c.id === (item.cat_id || item.catId) ? 'selected' : ''}>${c.name}</option>`).join('')}
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

    // 监听 URL 输入启动多源测速与备份加载
    document.getElementById('edit-url').addEventListener('input', (e) => {
        if (typeof window.debouncedHandleUrlInput === 'function') {
            window.debouncedHandleUrlInput(e.target.value.trim());
        }
    });
    
    // 绑定多源单选框的选择与联动
    ['0', '1', '2', '3'].forEach(num => {
        const opt = document.getElementById('opt-fav' + num);
        const txt = document.getElementById('txt-fav' + num);
        if (!opt || !txt) return;
        opt.addEventListener('change', () => {
            if (typeof window.selectIcon === 'function') {
                window.selectIcon(txt.value);
            }
        });
        txt.addEventListener('click', () => {
            if (txt.value && !opt.disabled) {
                opt.checked = true;
                if (typeof window.selectIcon === 'function') {
                    window.selectIcon(txt.value);
                }
            }
        });
    });

    // 绑定智能 Emoji 推荐与 Iconify 联合搜索
    document.getElementById('btn-emoji-recommend').addEventListener('click', () => {
        if (typeof window.recommendEmojisAndSearchIconify === 'function') {
            window.recommendEmojisAndSearchIconify(false);
        }
    });
    document.getElementById('btn-emoji-refresh').addEventListener('click', () => {
        if (typeof window.recommendEmojisAndSearchIconify === 'function') {
            window.recommendEmojisAndSearchIconify(true);
        }
    });
    document.getElementById('emoji-recommend-title').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (typeof window.recommendEmojisAndSearchIconify === 'function') {
                window.recommendEmojisAndSearchIconify(false);
            }
        }
    });

    // 自动触发初始 Emoji 推荐和 URL 图标加载
    if (item.title) {
        if (typeof window.renderEmojiSuggestions === 'function' && typeof window.getRecommendedEmojis === 'function') {
            window.renderEmojiSuggestions(window.getRecommendedEmojis(item.title));
        }
    }
    if (item.url) {
        if (typeof window.handleUrlInput === 'function') {
            window.handleUrlInput(item.url, false);
        }
    }

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
    const urlInput = document.getElementById('edit-url');
    if (!urlInput) return;
    const url = urlInput.value.trim();
    if (!url) {
        if (typeof showToast === 'function') {
            showToast("请先在网址框输入有效的 URL", "#e74c3c");
        } else {
            alert("请先在网址框输入有效的 URL");
        }
        return;
    }

    // 清空当前图标输入框，以便 handleUrlInput 能够自动覆盖首选方案
    const iconInput = document.getElementById('edit-icon');
    if (iconInput) {
        iconInput.value = '';
    }

    if (typeof showToast === 'function') {
        showToast("🪄 正在多端深度抓取并解析最优标题与图标...");
    }

    // 1. 发起后端元数据抓取 (获取正确的真实 Title & Desc & Icon)
    try {
        const res = await fetch(`/api/proxy/fetch-metadata?url=${encodeURIComponent(url)}`);
        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data) {
                const { title, desc, icon } = result.data;
                const titleInput = document.getElementById('edit-title-input');
                const descInput = document.getElementById('edit-desc');
                
                // 自动填入抓取出来的网站标题
                if (titleInput && title) {
                    titleInput.value = title;
                    titleInput.dispatchEvent(new Event('input'));
                }
                
                // 自动填充描述内容
                if (descInput && desc) {
                    descInput.value = desc;
                    descInput.dispatchEvent(new Event('input'));
                }

                // 如果后端提取到精确的站点图标，可以优先设置到页面备选中或者直接设置
                if (icon && iconInput) {
                    iconInput.value = icon;
                    iconInput.dispatchEvent(new Event('input'));
                }
            }
        }
    } catch (err) {
        console.warn('[MagicWand] Backend metadata fetch failed:', err);
    }

    // 2. 依然执行原先的 handleUrlInput 来保证多端加载器和图标解析的高可用备选可用性
    if (typeof window.handleUrlInput === 'function') {
        window.handleUrlInput(url, true);
    } else {
        if (typeof showToast === 'function') {
            showToast("抓取引擎初始化中，请稍候...", "#e67e22");
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
    const targetCatItems = window.appData.items.filter(i => (i.catId === payload.catId || i.cat_id === payload.catId) && i.id !== id);
    if (targetCatItems.length >= 100) {
        return showToast("目标分类已满 (上限 100 个书签)", "#e74c3c");
    }

    // 暂存模式：直接更新本地内存并显示提示
    if (id) {
        const idx = window.appData.items.findIndex(i => i.id === id);
        window.appData.items[idx] = { ...window.appData.items[idx], ...payload };
    } else {
        window.appData.items.push(payload);
    }

    window.isDataDirty = true;
    modal.style.display = 'none';
    
    if (window.sysToken) {
        const autoSync = (window.appData.settings?.syncInterval || 0) > 0;
        if (autoSync) {
            // 🚀 修改：如果在页面管理模式下，修改只本地暂存，根据云端自动备份时间策略判定是否需要上云
            if (window.isPageManagementMode) {
                showToast(id ? "修改已保存至本地，将根据云端策略自动备份" : "书签已添加，已保存至本地，将根据云端策略自动备份", "#27ae60");
            } else {
                showToast(id ? "修改已保存并自动同步到云端" : "书签已添加并自动同步到云端", "#27ae60");
            }
        } else {
            showToast(id ? "修改已本地保存，请记得手动同步上云" : "书签已添加，请记得手动同步上云", "#3498db");
        }
    } else {
        showToast(id ? "访客模式：对外修改已在本地生效" : "访客模式：书签已添加（清空缓存会丢失）", "#e67e22");
    }
    renderNav();

    // 登录态即时静默后台同步 (Task BF.3)
    if (window.sysToken) {
        // 先写入本地 localStorage 以防断电或离线刷新
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        
        // 🚀 修改：在页面管理模式下，单次保存不要立刻进行云端同步，退出的时再统一一并同步，避免网络不佳时频繁阻塞。
        if (!window.isPageManagementMode) {
            const autoSync = (window.appData.settings?.syncInterval || 0) > 0;
            if (autoSync) {
                console.log("[Sync] Triggering background auto-sync to cloud...");
                if (typeof window.manualSyncCloud === 'function') {
                    window.manualSyncCloud(false, true).then(() => {
                        window.isDataDirty = false;
                        console.log("[Sync] Background auto-sync succeeded.");
                    }).catch(err => {
                        console.warn("[Sync] Background auto-sync failed:", err);
                    });
                }
            }
        }
    }
};

const deleteItem = async (itemId) => {
    const ok = await window.requireSystemConfirm("安全删除书签", "您确定要永久删除此书签卡片吗？该操作不可撤销！", true);
    if (!ok) return;

    const itemIdx = window.appData.items.findIndex(item => item.id === itemId);
    if (itemIdx > -1) {
        window.appData.items.splice(itemIdx, 1);
    }

    window.isDataDirty = true;
    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
    showToast("卡片已物理删除并本地保存", "#27ae60");
    renderNav();
};

const toggleItemHidden = (itemId) => {
    const item = window.appData.items.find(i => i.id === itemId);
    if (item) {
        item.hidden = !item.hidden;
        window.isDataDirty = true;
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        showToast(item.hidden ? "已隐藏此卡片并保存到本地" : "已公开此对应卡片并保存到本地", "#3498db");
        renderNav();
    }
};

// ==================== 4. 批量管理栏与操作流 ====================
const updateBatchBar = () => {
    const bar = document.getElementById('batch-actions-bar');
    const countEl = document.getElementById('batch-count');
    if (!bar) return;
    
    if (window.isPageManagementMode && window.selectedIds.size > 0) {
        bar.classList.add('visible');
        if (countEl) {
            countEl.innerText = window.selectedIds.size;
        }
    } else {
        bar.classList.remove('visible');
    }
};

const doBatchDelete = async () => {
    if (window.selectedIds.size === 0) return;
    
    const count = window.selectedIds.size;
    const ok = await window.requireSystemConfirm("批量删除确认", `您确定要批量物理删除选中的 ${count} 个书签吗？数据将被永久删除，且不可恢复！`, true);
    if (!ok) return;

    window.appData.items = window.appData.items.filter(item => !window.selectedIds.has(item.id));
    
    window.selectedIds.clear();
    window.isDataDirty = true;
    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
    
    showToast(`批量删除 ${count} 个书签成功并保存至本地`, "#27ae60");
    updateBatchBar();
    renderNav();
};

const doBatchToggleHidden = () => {
    if (window.selectedIds.size === 0) return;

    const targetItems = window.appData.items.filter(i => window.selectedIds.has(i.id));
    const hasVisible = targetItems.some(i => !i.hidden);

    targetItems.forEach(i => {
        i.hidden = hasVisible;
    });

    window.isDataDirty = true;
    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
    showToast(hasVisible ? "选中的卡片已批量隐藏并保存本地" : "选中的卡片一并设为公开并保存本地", "#3498db");
    
    window.selectedIds.clear();
    updateBatchBar();
    renderNav();
};

const openBatchMoveModal = () => {
    if (window.selectedIds.size === 0) return showToast("当前未选中任何书签", "#e67e22");

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    if (!modal || !body || !confirmBtn) return;

    window.lastFocusedElement = document.activeElement; // Task 37.2
    closeAllModals(true);

    title.innerText = `批量移动至目标分类（已选 ${window.selectedIds.size} 项）`;
    
    const validCats = window.appData.categories.filter(c => c.id !== 'VIRTUAL_FREQ');
    
    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-folders-line"></i> 选择目标分类</label>
            <select id="batch-move-cat-select" style="width:100%; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; color:var(--text); padding:8px; height: 40px; outline:none;">
                ${validCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>
    `;

    confirmBtn.style.display = 'block';
    confirmBtn.onclick = () => {
        const targetCatId = document.getElementById('batch-move-cat-select').value;
        if (!targetCatId) return;

        window.appData.items.forEach(item => {
            if (window.selectedIds.has(item.id)) {
                item.catId = targetCatId;
                item.cat_id = targetCatId;
            }
        });

        window.isDataDirty = true;
        localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
        showToast(`成功将 ${window.selectedIds.size} 个网址卡片移动并保存至本地`, "#27ae60");
        window.selectedIds.clear();
        modal.style.display = 'none';
        
        updateBatchBar();
        renderNav();
    };

    modal.style.display = 'flex';
};

// ==================== 5. Sortable.js 拖拽排序逻辑 ====================
const initSortable = () => {
    destroySortable();
    
    const sidebarNav = document.getElementById('sidebar-nav');
    if (sidebarNav && typeof Sortable !== 'undefined') {
        const catSortable = Sortable.create(sidebarNav, {
            animation: 150,
            handle: '.drag-handle', // 绑定在手柄图标上，不影响正常的分类点击动作
            draggable: '.sortable-cat',
            onEnd: () => {
                // 根据实时 DOM 的排列顺序完全复写分类数据 appData.categories
                const children = Array.from(sidebarNav.children);
                const newCategories = [];
                
                children.forEach(child => {
                    const catId = child.dataset.id;
                    if (catId === 'VIRTUAL_FREQ') return;
                    const cat = window.appData.categories.find(c => c.id === catId);
                    if (cat) {
                        newCategories.push(cat);
                    }
                });
                
                window.appData.categories = newCategories;
                window.isDataDirty = true;
                localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                showToast("分类顺序已在本地变更", "#27ae60");
            }
        });
        window.sortableInstances.push(catSortable);
    }
    
    const grids = document.querySelectorAll('.category-section .nav-grid, .category-section .video-grid');
    if (grids.length > 0 && typeof Sortable !== 'undefined') {
        grids.forEach(grid => {
            const section = grid.closest('.category-section');
            if (!section) return;
            const targetCatId = section.id.replace('section-', '');
            if (targetCatId === 'VIRTUAL_FREQ') return;
            
            const itemSortable = Sortable.create(grid, {
                group: 'shared-category-items',
                animation: 150,
                draggable: '.card:not(.add-new-card), .video-card:not(.add-new-card)',
                onEnd: () => {
                    const allGrids = document.querySelectorAll('.category-section .nav-grid, .category-section .video-grid');
                    const orderedIds = [];
                    
                    allGrids.forEach(g => {
                        const s = g.closest('.category-section');
                        if (!s) return;
                        const catId = s.id.replace('section-', '');
                        if (catId === 'VIRTUAL_FREQ') return;
                        
                        const cards = Array.from(g.children);
                        cards.forEach(card => {
                            if (card.classList.contains('add-new-card')) return;
                            const itemId = card.getAttribute('data-id');
                            if (!itemId) return;
                            
                            orderedIds.push(itemId);
                            const item = window.appData.items.find(i => i.id === itemId);
                            if (item) {
                                item.catId = catId;
                                item.cat_id = catId; // Double sync for dual key compatibility
                            }
                        });
                    });
                    
                    const renderedItemsMap = {};
                    window.appData.items.forEach(item => {
                        if (orderedIds.includes(item.id)) {
                            renderedItemsMap[item.id] = item;
                        }
                    });
                    
                    const reorderedItems = [];
                    orderedIds.forEach(id => {
                        const item = renderedItemsMap[id];
                        if (item) {
                            reorderedItems.push(item);
                        }
                    });
                    
                    const nonRenderedItems = window.appData.items.filter(item => !renderedItemsMap[item.id]);
                    window.appData.items = [...reorderedItems, ...nonRenderedItems];
                    
                    window.isDataDirty = true;
                    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                    showToast("卡片排序已本地更改", "#27ae60");
                    
                    renderNav();
                }
            });
            window.sortableInstances.push(itemSortable);
        });
    }
};

const destroySortable = () => {
    if (window.sortableInstances && window.sortableInstances.length > 0) {
        window.sortableInstances.forEach(inst => {
            if (typeof inst.destroy === 'function') {
                inst.destroy();
            }
        });
        window.sortableInstances = [];
    }
};

// ==================== 6. 安全全局挂载注册 ====================
window.togglePageManagement = togglePageManagement;
window.openCategoryEditModal = openCategoryEditModal;
window.deleteCategory = deleteCategory;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.toggleCategoryVideoMode = toggleCategoryVideoMode;
window.openEditModal = openEditModal;
window.triggerMagicWand = triggerMagicWand;
window.saveItem = saveItem;
window.deleteItem = deleteItem;
window.toggleItemHidden = toggleItemHidden;
window.updateBatchBar = updateBatchBar;
window.doBatchDelete = doBatchDelete;
window.doBatchToggleHidden = doBatchToggleHidden;
window.openBatchMoveModal = openBatchMoveModal;
window.initSortable = initSortable;
window.destroySortable = destroySortable;
