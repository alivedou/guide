/**
 * @fileoverview Feature module: profile
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

const openProfileCenter = async () => {
    if (!window.sysToken) return showAuthModal();
    window.lastFocusedElement = document.activeElement;
    closeAllModals(true);
    showLoader('正在读取个人资料...');

    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': window.sysToken }
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
        const currentAvatar = window.appData.settings?.avatarUrl || localStorage.getItem('nav_user_avatar_' + userId) || DEFAULT_AVATARS[0];

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
                        'Authorization': window.sysToken
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
                    if (!window.appData.settings) window.appData.settings = {};
                    window.appData.settings.avatarUrl = selectedAvatar;
                    window.isDataDirty = true;

                    // 局部更新本地用户信息
                    storedUser.username = username;
                    localStorage.setItem('nav_current_user', JSON.stringify(storedUser));
                    window.currentUser = storedUser;
                    window.appData.username = username;

                    modal.style.display = 'none';
                    renderNav();
                    renderTools();

                    // 开启分享时立刻把当前本地导航发布到云端，否则访客会读到注册时的默认主页
                    if (isShared && shareSlug && window.sysToken && window.appData?.categories && window.appData?.items) {
                        showLoader('正在把当前主页发布到分享链接...');
                        try {
                            const uploadData = JSON.parse(JSON.stringify(window.appData));
                            if (uploadData.settings) delete uploadData.settings.themeMode;
                            const syncRes = await fetch('/api/config', {
                                method: 'POST',
                                headers: {
                                    'Authorization': window.sysToken,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(uploadData)
                            });
                            const syncBody = await syncRes.json().catch(() => ({}));
                            if (syncRes.ok && syncBody.success) {
                                window.isDataDirty = false;
                                localStorage.setItem('nav_last_cloud_sync', Date.now().toString());
                                localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                                if (typeof window.getCoreDataFingerprint === 'function') {
                                    window.lastSyncFingerprint = window.getCoreDataFingerprint(window.appData);
                                }
                            } else {
                                showToast("分享已开启，但当前主页上传失败。请打开云端同步手动上传，否则访客仍可能看到默认模板。", "#e67e22");
                            }
                        } catch (syncErr) {
                            showToast("分享已开启，但当前主页上传失败。请打开云端同步手动上传，否则访客仍可能看到默认模板。", "#e67e22");
                        } finally {
                            hideLoader();
                        }
                    }
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
// Window bridge for cross-module and inline onclick callers
window.showTempPasswordChangeAlert = showTempPasswordChangeAlert;
