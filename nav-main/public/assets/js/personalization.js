/**
 * personalization.js
 * 个性化设置中心 (Personalization & Visual Lab Module)
 * 负责背景毛玻璃度、背景图上传、网站个性化细节样式设置与预览。
 */

// 视觉实验室控制
window.openVisualLab = () => {
    window.lastFocusedElement = document.activeElement; 
    // 互斥显示 (使用静默模式刷新，不触发云端同步)
    if (typeof window.closeAllModals === 'function') {
        window.closeAllModals(true);
    }

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');

    if (!modal || !body) return;

    modal.dataset.modalType = 'visual-lab'; // 🚀 标记为个性化设置
    title.innerHTML = `视觉实验室 ${window.isDataDirty ? '<span style="font-size:10px; background:#e67e22; color:#fff; padding:2px 6px; border-radius:10px; margin-left:10px; vertical-align:middle; font-weight:normal;">本地预览中</span>' : ''}`;
    const isZen = window.appData.settings?.zenMode === true;
    body.innerHTML = `
        <div class="visual-option-group" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px; margin-bottom: 12px;">
            <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-keyboard-line"></i> 布局密度</span>
            <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                <button class="seg-btn ${window.appData.settings?.density === 'compact' ? 'active' : ''}" onclick="setVisualSetting('density', 'compact')">紧凑</button>
                <button class="seg-btn ${(!window.appData.settings?.density || window.appData.settings?.density === 'standard') ? 'active' : ''}" onclick="setVisualSetting('density', 'standard')">平衡</button>
                <button class="seg-btn ${window.appData.settings?.density === 'comfortable' ? 'active' : ''}" onclick="setVisualSetting('density', 'comfortable')">透气</button>
            </div>
        </div>
        <div class="visual-option-group">
            <span class="visual-option-label" style="margin-bottom: 6px;"><i class="ri-image-line"></i> 自定义背景</span>
            <div style="display:flex; gap:8px; width:100%; align-items:center; margin-bottom: 8px;">
                <input type="text" id="bg-url-input" placeholder="输入网络图片 URL (留空显示 Bing 壁纸)"
                       value="${window.appData.settings?.bgUrl === 'local_upload' ? '本地上传图片' : (window.appData.settings?.bgUrl || '')}"
                       onchange="setVisualSetting('bgUrl', this.value)"
                       style="flex:1; height:38px; font-size:12px; box-sizing:border-box;"
                       ${window.appData.settings?.bgUrl === 'local_upload' ? 'disabled' : ''}>
                <button class="icon-btn-action"
                         onclick="setVisualSetting('hideBgMask', !window.appData.settings?.hideBgMask)"
                         title="开启/关闭背景模糊"
                         style="width:38px; height:38px; flex-shrink:0; ${!window.appData.settings?.hideBgMask ? 'background: var(--primary); border-color: var(--primary); color: #fff;' : ''}">
                    <i class="ri-contrast-drop-2-line"></i>
                </button>
            </div>
            <div style="display:flex; gap:8px; width:100%;">
                <button class="tab-btn" onclick="triggerBgUpload()" style="flex:1; font-size:11px; padding: 6px 12px;"><i class="ri-upload-cloud-2-line"></i> 上传本地壁纸</button>
                ${window.appData.settings?.bgUrl === 'local_upload' ? `
                    <button class="tab-btn" onclick="clearBgUpload()" style="flex:1; font-size:11px; padding: 6px 12px; background: rgba(231,76,60,0.15); border-color: rgba(231,76,60,0.3); color: #e74c3c;"><i class="ri-delete-bin-line"></i> 清除本地壁纸</button>
                ` : ''}
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 4px; line-height: 1.4;">
                提示: 支持外链或上传本地壁纸（建议 10MB 内，纯本地缓存，零开销）。
            </p>
        </div>
        <div class="visual-option-group">
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <!-- 1. 空间与核心模态 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-focus-3-line"></i> 空间模态</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${!window.appData.settings?.zenMode ? 'active' : ''}" onclick="toggleZenMode(false)">
                            ${!window.appData.settings?.zenMode ? '●' : '○'} 常规模式
                        </button>
                        <button class="seg-btn ${window.appData.settings?.zenMode ? 'active' : ''}" onclick="toggleZenMode(true)">
                            ${window.appData.settings?.zenMode ? '●' : '○'} 禅意模式
                        </button>
                    </div>
                </div>

                <!-- 2. 单视图隔离 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px; ${isZen ? 'opacity: 0.6;' : ''}">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-window-line"></i> 视图展示</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0; ${isZen ? 'pointer-events: none;' : ''}">
                        <button class="seg-btn ${!window.appData.settings?.isolatedView ? 'active' : ''}" onclick="setVisualSetting('isolatedView', false)">
                            ${!window.appData.settings?.isolatedView ? '●' : '○'} 长页纵览
                        </button>
                        <button class="seg-btn ${window.appData.settings?.isolatedView ? 'active' : ''}" onclick="setVisualSetting('isolatedView', true)">
                            ${window.appData.settings?.isolatedView ? '●' : '○'} 单视图隔离
                        </button>
                    </div>
                </div>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 4px; line-height: 1.3;">说明: 禅意专注内容；单视图精简分类展陈</p>
            ${isZen ? '<p style="font-size: 11px; color: #e67e22; margin-top: 4px; margin-bottom: 0;"><i class="ri-information-line"></i> 禅意模式下强制锁定单视图</p>' : ''}
        </div>
        <div class="visual-option-group">
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <!-- 3. 跳转机制 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-external-link-line"></i> 跳转机制</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${window.appData.settings?.link_target === '_self' ? 'active' : ''}" onclick="setVisualSetting('link_target', '_self')">
                            ${window.appData.settings?.link_target === '_self' ? '●' : '○'} 直接跳转
                        </button>
                        <button class="seg-btn ${(!window.appData.settings?.link_target || window.appData.settings?.link_target === '_blank') ? 'active' : ''}" onclick="setVisualSetting('link_target', '_blank')">
                            ${(!window.appData.settings?.link_target || window.appData.settings?.link_target === '_blank') ? '●' : '○'} 新窗口打开
                        </button>
                    </div>
                </div>

                <!-- 4. 常去网站 -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
                    <span class="visual-option-label" style="margin: 0; font-size: 13px;"><i class="ri-star-line"></i> 常去网站</span>
                    <div class="segmented-control" style="width: 220px; flex-shrink: 0;">
                        <button class="seg-btn ${window.appData.settings?.showFrequent === false ? 'active' : ''}" onclick="setVisualSetting('showFrequent', false)">
                            ${window.appData.settings?.showFrequent === false ? '●' : '○'} 隐藏常去
                        </button>
                        <button class="seg-btn ${window.appData.settings?.showFrequent !== false ? 'active' : ''}" onclick="setVisualSetting('showFrequent', true)">
                            ${window.appData.settings?.showFrequent !== false ? '●' : '○'} 显示常去
                        </button>
                    </div>
                </div>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 4px;">说明: 设定链接跳转行为与常去磁贴显示</p>
        </div>
    `;

    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = window.isDataDirty ? "应用并关闭" : "完成设置";
    confirmBtn.onclick = () => {
        if (typeof window.closeAllModals === 'function') window.closeAllModals();
    };

    // 自动聚焦第一个选项
    setTimeout(() => {
        modal.querySelector('.seg-btn')?.focus();
    }, 50);
};

window.setVisualSetting = (key, value) => {
    if (!window.appData.settings) window.appData.settings = {};

    // 禅意模式下的交互拦截与引导
    if (window.appData.settings.zenMode && key === 'isolatedView') {
        if (typeof window.showToast === 'function') {
            window.showToast("禅意模式已强制开启隔离视图，退出后可修改常规模态", "#e67e22");
        }
        return;
    }

    window.appData.settings[key] = value;
    window.isDataDirty = true; // 标记待同步

    // 如果修改了影响 DOM 结构的配置，触发重新渲染
    if (['isolatedView', 'showFrequent', 'link_target'].includes(key)) {
        if (typeof window.renderNav === 'function') window.renderNav();
    }

    if (typeof window.updateStyles === 'function') window.updateStyles();
    window.openVisualLab(); // 刷新弹窗状态
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

            // 安全限制：使用 IndexedDB 存储本地大文件，轻松支持 10MB 本地图片，零服务器开销
            if (file.size > 10 * 1024 * 1024) {
                if (typeof window.showToast === 'function') {
                    window.showToast("上传失败：本地图片大小请限制在 10MB 以内", "#e74c3c");
                }
                return;
            }

            if (typeof window.showLoader === 'function') window.showLoader('正在载入并处理图片...');
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const base64Data = event.target.result;
                    if (typeof window.saveBgToDB === 'function') {
                        await window.saveBgToDB(base64Data);
                    }
                    window.navLocalBgImage = base64Data;
                    window.setVisualSetting('bgUrl', 'local_upload');
                    if (typeof window.showToast === 'function') {
                        window.showToast("本地壁纸载入成功 (数据纯本地缓存，不占用服务器空间)");
                    }
                    window.openVisualLab(); // 重新刷新弹窗以呈现“清除”按钮
                } catch (err) {
                    if (typeof window.showToast === 'function') {
                        window.showToast("载入失败，请重试", "#e74c3c");
                    }
                } finally {
                    if (typeof window.hideLoader === 'function') window.hideLoader();
                }
            };
            reader.readAsDataURL(file);
        };
    }
    input.click();
};

window.clearBgUpload = async () => {
    if (typeof window.deleteBgFromDB === 'function') {
        await window.deleteBgFromDB();
    }
    window.navLocalBgImage = null;
    localStorage.removeItem('nav_local_bg_image');
    window.setVisualSetting('bgUrl', '');
    if (typeof window.showToast === 'function') {
        window.showToast("本地自定壁纸已清除");
    }
    window.openVisualLab(); // 重新刷新弹窗
};

window.toggleZenMode = (force, isFromShortcut = false) => {
    if (!window.appData.settings) window.appData.settings = {};
    const newState = typeof force === 'boolean' ? force : !window.appData.settings.zenMode;
    window.appData.settings.zenMode = newState;
    window.isDataDirty = true; // 标记待同步

    // 逻辑流转：进入禅意模式时默认静默，退出时默认展开
    if (newState) {
        window.isZenTempExpanded = false;
        // 禅意模式下强制关闭侧边栏
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    } else {
        window.isZenTempExpanded = true;
        // 回到标准模式时，根据图钉状态决定是否展开侧边栏
        if (window.isSidebarPinned && typeof window.toggleSidebar === 'function') window.toggleSidebar(true);
    }

    if (isFromShortcut) {
        if (typeof window.showToast === 'function') {
            window.showToast(newState ? "切换到禅意模式" : "切换到常规模式", newState ? "#2c3e50" : "#3498db");
        }
    }

    // 强制清理搜索状态
    const sea = document.getElementById('sea-input');
    if (sea) sea.value = '';
    document.body.classList.remove('is-searching');

    if (typeof window.renderNav === 'function') window.renderNav();
    if (typeof window.updateStyles === 'function') window.updateStyles();

    // 同步视觉实验室 UI
    if (document.getElementById('edit-modal').style.display === 'flex') window.openVisualLab();
};
