/**
 * cloud-sync.js
 * 云端备份同步及管理中心 (Cloud Backup & Synchronization Module)
 * 负责用户配置的云端同步、手动/自动备份计划、拉取备份覆盖本地配置及安全验证流转。
 */

// 唤起云端备份中心 (风格对齐视觉实验室)
window.openSyncCenter = () => {
    if (!window.sysToken) return window.showToast("请先登录再使用云端同步功能", "#e67e22");

    window.lastFocusedElement = document.activeElement; 
    if (typeof window.closeAllModals === 'function') window.closeAllModals(true);

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');

    if (!modal || !body) return;

    modal.dataset.modalType = 'sync-center';
    title.innerHTML = `<i class="ri-cloud-line"></i> 云端同步中心`;

    // 获取同步状态
    const lastSync = localStorage.getItem('nav_last_cloud_sync');
    const timeStr = lastSync ? window.formatSystemDate(parseInt(lastSync), true) : '从未备份';
    const isOverdue = lastSync && (Date.now() - parseInt(lastSync) > (window.appData.settings?.syncInterval || 7) * 24 * 3600 * 1000);

    // 计算冷却时间 (Task节流.3)
    const cooldownMs = 5 * 60 * 1000;
    const remaining = lastSync ? Math.max(0, cooldownMs - (Date.now() - parseInt(lastSync))) : 0;
    const isCooling = remaining > 0;
    const coolMin = Math.ceil(remaining / 60000);

    // 手动模式下的脏数据提醒
    const showDirtyHint = window.isDataDirty && !window.appData.settings?.syncInterval && !isCooling;

    body.innerHTML = `
        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-history-line"></i> 备份状态反馈</span>
            <div style="background: var(--glass-card); padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); position: relative;">
                <p style="font-size: 13px; margin: 0; display:flex; justify-content: space-between; align-items: center;">
                    <span>上次同步时间：</span>
                    <b style="color: ${lastSync ? 'var(--primary-color)' : '#e74c3c'}">${timeStr}</b>
                </p>
                ${isOverdue ? `<p style="font-size: 11px; color: #e67e22; margin-top: 8px;"><i class="ri-error-warning-line"></i> 提示：您的云端备份已超过 ${window.appData.settings?.syncInterval || 7} 天未更新，建议立即同步。</p>` : ''}
                ${window.isDataDirty ? `<p style="font-size: 11px; color: var(--primary-color); margin-top: 8px;"><i class="ri-edit-line"></i> 检测到本地有未同步的修改。</p>` : ''}
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
            <span class="visual-option-label"><i class="ri-cloud-download-line"></i> 从云端下载到本地</span>
            <div class="visual-btn-group">
                <button class="tab-btn active"
                        id="btn-pull-cloud"
                        style="flex:1; justify-content: center; height:42px; border: 1px solid #e67e22; color: #e67e22; background: transparent;"
                        onclick="pullBackupFromCloud()">
                    <i class="ri-download-cloud-line"></i> 拉取云端数据到本地
                </button>
            </div>
            <p style="font-size: 11px; opacity: 0.8; color: #e67e22; margin-top: 8px;"><i class="ri-alert-line"></i> 警告：此操作将使用云端已有的备份数据【完全覆盖】您当前的本地数据，此操作不可撤销，请谨慎点击！</p>
        </div>

        <div class="visual-option-group">
            <span class="visual-option-label"><i class="ri-timer-flash-line"></i> 云端备份模式</span>
            <div class="segmented-control" style="width: 100%; box-sizing: border-box; display: flex;">
                <button class="seg-btn ${!window.appData.settings?.syncInterval ? 'active' : ''}" onclick="setSyncMode(0)" style="padding: 6px 4px; font-size: 12px;">
                    ${!window.appData.settings?.syncInterval ? '●' : '○'} 手动模式
                </button>
                <button class="seg-btn ${window.appData.settings?.syncInterval === 3 ? 'active' : ''}" onclick="setSyncMode(3)" style="padding: 6px 4px; font-size: 12px;">
                    ${window.appData.settings?.syncInterval === 3 ? '●' : '○'} 每 3 天
                </button>
                <button class="seg-btn ${window.appData.settings?.syncInterval === 7 ? 'active' : ''}" onclick="setSyncMode(7)" style="padding: 6px 4px; font-size: 12px;">
                    ${window.appData.settings?.syncInterval === 7 ? '●' : '○'} 每 7 天
                </button>
                <button class="seg-btn ${window.appData.settings?.syncInterval === 30 ? 'active' : ''}" onclick="setSyncMode(30)" style="padding: 6px 4px; font-size: 12px;">
                    ${window.appData.settings?.syncInterval === 30 ? '●' : '○'} 每 30 天
                </button>
            </div>
            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px;">
                ${window.appData.settings?.syncInterval > 0
                    ? '<i class="ri-checkbox-circle-line" style="color:var(--success-color)"></i> 当前已开启自动同步模式（修改发生变更且退出管理时将自动同步）。'
                    : '<i class="ri-information-line"></i> 当前为全手动维护，建议退出管理后手动执行备份以防配置丢失。'}
            </p>
        </div>
    `;

    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = "完成并关闭";
    confirmBtn.onclick = () => {
        if (typeof window.closeAllModals === 'function') window.closeAllModals();
    };
};

// 从云端拉取备份数据到本地 (方案 B：原地高颜值弹窗重绘确认，消灭浏览器丑陋系统 confirm)
window.pullBackupFromCloud = () => {
    if (!window.sysToken) return window.showToast("请先登录再拉取备份", "#e67e22");

    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    if (!body || !confirmBtn) return;

    body.innerHTML = `
        <div style="text-align: center; padding: 20px 10px;">
            <div style="font-size: 48px; color: #e67e22; margin-bottom: 12px; animation: focus-pulse 1.5s infinite;"><i class="ri-alert-line"></i></div>
            <h3 style="font-size: 15px; font-weight: bold; color: var(--text); margin-bottom: 8px;">云端拉取全量覆盖确认</h3>
            <p style="font-size: 12px; color: var(--text-dim); line-height: 1.6; margin: 0 10px 15px;">
                您即将从云端下载并还原您之前安全存档备份的数据！<br><br>
                <span style="color:#e67e22; font-weight:bold;"><i class="ri-error-warning-line"></i> 警告：拉取操作将完全覆写并清空您当前设备上的本地分类与网址！此操作不可撤销，确定继续吗？</span>
            </p>
            <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: center;">
                <button class="tab-btn" onclick="window.openSyncCenter()" style="flex: 1; height: 38px; justify-content: center; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-dim); cursor: pointer; border-radius: 8px;">取消并返回</button>
                <button class="tab-btn active" onclick="window.executePullBackupFromCloud()" style="flex: 1; height: 38px; justify-content: center; background: #e67e22; border-color: #e67e22; color: #fff; cursor: pointer; border-radius: 8px;">确认拉取覆盖</button>
            </div>
        </div>
    `;

    // 临时隐藏底下的共用关闭按钮
    confirmBtn.style.display = 'none';
};

window.executePullBackupFromCloud = async () => {
    if (!window.sysToken) return window.showToast("请先登录再拉取备份", "#e67e22");

    if (window.SyncUI) {
        await window.SyncUI.perform('RESTORE_MANUAL', async () => {
            const res = await fetch('/api/config', {
                headers: { 'Authorization': window.sysToken }
            });

            if (res.status === 401) {
                if (typeof window.hideLoader === 'function') window.hideLoader();
                return window.handleAuthError();
            }

            const data = await res.json();

            if (res.ok && data) {
                // 解析隔离 - 容错处理
                if (!data.categories || !data.items) {
                    window.appData = { ...window.MINIMAL_SAFE_DATA, ...data };
                    if (!window.appData.categories || window.appData.categories.length === 0) window.appData.categories = window.MINIMAL_SAFE_DATA.categories;
                    if (!window.appData.items) window.appData.items = [];
                } else {
                    window.appData = data;
                }

                window.isDataDirty = false;
                localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                window.lastSyncFingerprint = window.getCoreDataFingerprint(window.appData);

                // 写入云端最新备份时间到本地，保持多终端同步状态实时一致
                if (data.lastUpdated) {
                    const parseTime = Date.parse(data.lastUpdated.trim().replace(/-/g, '/'));
                    if (!isNaN(parseTime)) {
                        localStorage.setItem('nav_last_cloud_sync', parseTime.toString());
                    } else {
                        localStorage.setItem('nav_last_cloud_sync', Date.now().toString());
                    }
                } else {
                    localStorage.setItem('nav_last_cloud_sync', Date.now().toString());
                }

                // 重新刷新与渲染
                if (typeof window.renderNav === 'function') window.renderNav();
                if (typeof window.renderTools === 'function') window.renderTools();
                if (typeof window.updateStyles === 'function') window.updateStyles();

                window.showToast("云端备份拉取并覆盖本地成功！", "#27ae60");
                if (typeof window.closeAllModals === 'function') window.closeAllModals(true); // 静默关闭弹窗
            } else {
                throw new Error("从服务器拉取备份失败，请重试");
            }
        });
    }
};

// 手动同步云端逻辑
window.manualSyncCloud = async (refreshUI = false) => {
    if (!window.sysToken) return window.showToast("请先登录再进行备份", "#e67e22");

    // Task節流.2: 仅在手动备份 (refreshUI === true) 时启用冷却逻辑 (5 分钟)
    if (refreshUI) {
        const lastSync = parseInt(localStorage.getItem('nav_last_cloud_sync') || '0');
        const cooldownMs = 5 * 60 * 1000;
        const remaining = cooldownMs - (Date.now() - lastSync);
        if (remaining > 0) {
            const min = Math.ceil(remaining / 60000);
            return window.showToast(`操作频繁：手动备份冷却中，请 ${min} 分钟后再试`, "#e67e22");
        }
    }

    // 1. 数据合法性校验 (Data Validation)
    if (!window.appData || !Array.isArray(window.appData.categories) || !Array.isArray(window.appData.items)) {
        return window.showToast("本地数据结构异常，取消上传以保护云端数据", "#e74c3c");
    }

    if (window.appData.categories.length === 0) {
        if (typeof window.requireSystemConfirm === 'function') {
            const ok = await window.requireSystemConfirm("清空备份确认", "检测到本地没有分类数据，确定要清空云端备份吗？", true);
            if (!ok) return;
        }
    }

    if (window.SyncUI) {
        await window.SyncUI.perform('BACKUP_MANUAL', async () => {
            // 深度复制一份发包数据，并在发送至云端前安全擦除 themeMode 设置以保持本地独享
            const uploadData = JSON.parse(JSON.stringify(window.appData));
            if (uploadData.settings) {
                delete uploadData.settings.themeMode;
            }

            const res = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Authorization': window.sysToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(uploadData)
            });

            if (res.status === 401) {
                if (typeof window.hideLoader === 'function') window.hideLoader();
                return window.handleAuthError();
            }

            const data = await res.json();

            if (res.ok && data.success) {
                // 3. 成功反馈与状态记录
                window.isDataDirty = false;
                const now = Date.now();
                localStorage.setItem('nav_last_cloud_sync', now.toString());
                localStorage.setItem('nav_app_data', JSON.stringify(window.appData));

                // 更新同步指纹并重置状态
                window.lastSyncFingerprint = window.getCoreDataFingerprint(window.appData);

                // 使用同步后回调逻辑，由 SyncUI 自动弹出成功提示
                if (refreshUI && typeof window.openSyncCenter === 'function') window.openSyncCenter();
            } else {
                throw new Error((data.error || "服务器拒绝保存") + " - " + (data.message || ""));
            }
        });
    }
};

// 逻辑层整合 - 统一同步模式管理
window.setSyncMode = (days) => {
    if (!window.appData.settings) window.appData.settings = {};
    window.appData.settings.syncInterval = days;

    localStorage.setItem('nav_app_data', JSON.stringify(window.appData));

    // 刷新 UI
    window.openSyncCenter();

    const msg = days === 0 ? "已切换为手动备份模式" : `已设置为 ${days} 天自动提醒备份模式`;
    window.showToast(msg);
};
