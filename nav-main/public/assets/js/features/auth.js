/**
 * @fileoverview Feature module: auth
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
const initGlobalEvents = (...args) => window.initGlobalEvents(...args);
const initAnnouncements = (...args) => window.initAnnouncements(...args);
const initSiteConfig = (...args) => window.initSiteConfig(...args);
const initLocalBgImage = (...args) => window.initLocalBgImage(...args);
const getBingWallpaper = (...args) => window.getBingWallpaper(...args);
const openNoticeCenter = (...args) => window.openNoticeCenter(...args);
const refreshNoticeBadge = (...args) => window.refreshNoticeBadge(...args);
const checkSWUpdate = (...args) => window.checkSWUpdate(...args);
const checkAnnouncementsUpdate = (...args) => window.checkAnnouncementsUpdate(...args);
const initAnnouncementsWatcher = (...args) => window.initAnnouncementsWatcher(...args);
const wakeUpNavigation = (...args) => window.wakeUpNavigation(...args);
const closeSearch = (...args) => window.closeSearch(...args);
const handleDataSaveOnExit = (...args) => window.handleDataSaveOnExit(...args);
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

// 认证失效统一处理
const handleAuthError = () => {
    console.warn('[Auth] Session expired or invalid');
    localStorage.removeItem('nav_token');
    localStorage.removeItem('nav_current_user');
    localStorage.removeItem('nav_app_data');
    localStorage.removeItem('nav_last_cloud_sync');
    window.sysToken = '';
    window.currentUser = null;
    window.isAdmin = false;
    showToast("会话已过期，请重新登录", "#e67e22");
    openLoginModal();
    init(true); // 回退到游客视图
};

// 统一登录弹窗调用逻辑
const openLoginModal = () => {
    window.lastFocusedElement = document.activeElement; 
    const overlay = document.getElementById('auth-overlay');
    const tabLogin = document.getElementById('tab-login');
    const editModal = document.getElementById('edit-modal');

    if (editModal) editModal.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';
    // 强制切换到登录 Tab
    if (tabLogin) tabLogin.click();

    // 自动聚焦
    setTimeout(() => {
        document.getElementById('auth-username')?.focus();
    }, 100);
};
const toggleSkeleton = (s) => {
    const sk = document.getElementById('skeleton-screen');
    const mc = document.getElementById('main-content');
    if (sk) sk.style.display = s ? 'block' : 'none';
    if (mc) mc.style.display = s ? 'none' : 'block';
};

// ==================== 3. 认证逻辑 ====================
/**
 * 统一调度认证/用户中心弹窗
 */
const showAuthModal = () => {
    const overlay = document.getElementById('auth-overlay');
    const formView = document.getElementById('auth-form-view');
    const userView = document.getElementById('auth-user-view');

    if (!overlay || !formView || !userView) return;

    if (window.sysToken) {
        // 已登录：展示用户信息视图
        formView.style.display = 'none';
        userView.style.display = 'block';

        // 优先从全局状态同步最新信息
        const info = window.currentUser || JSON.parse(localStorage.getItem('nav_current_user') || '{}');
        const nameEl = document.getElementById('auth-current-user-name');
        const roleEl = document.getElementById('auth-user-role-label');

        if (nameEl) {
            // 标准化 ID 格式为 id: xxxx
            const uidStr = info.uid ? ` <small style="font-weight: normal; opacity: 0.6; font-family: monospace;">(id: ${info.uid})</small>` : '';
            nameEl.innerHTML = (info.username || window.appData.username || '未知用户') + uidStr;
        }
        if (roleEl) {
            const roleKey = info.role || window.appData.role || 'guest';
            const roles = {
                'admin': '系统总管理员',
                'super_user': '高级协管员',
                'user': '注册会员',
                'guest': '访客'
            };
            roleEl.innerText = roles[roleKey] || '注册会员';

            // 权限颜色映射
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

    await window.SyncUI.perform('LOGIN', async () => {
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

        window.sysToken = 'Bearer ' + data.token;
        localStorage.setItem('nav_token', window.sysToken);

        // 立即持久化完整的用户信息
        window.currentUser = {
            id: data.user.id,
            uid: data.user.uid,
            username: data.user.username,
            role: data.user.role
        };
        localStorage.setItem('nav_current_user', JSON.stringify(window.currentUser));

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

    await window.SyncUI.perform('REGISTER', async () => {
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
    localStorage.removeItem('nav_current_user'); 
    window.sysToken = '';
    window.currentUser = null;
    window.isAdmin = false;
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
        if (!window.sysToken) {
            // 游客态重置逻辑
            const res = await fetch('/api/config');
            if (res.ok) {
                window.appData = await res.json();
                window.isDataDirty = false;
                localStorage.setItem('nav_app_data', JSON.stringify(window.appData));
                renderNav();
                renderTools();
                showToast("配置已恢复默认 (本地)", "#27ae60");
                return;
            }
        }

        const res = await fetch('/api/config', {
            method: 'DELETE',
            headers: {
                'Authorization': window.sysToken,
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

            // 清除 SW 图标缓存
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ action: 'clearIconCache' });
            }

            showToast("已成功恢复默认配置");

            // 彻底清洗内存状态
            window.activeCatId = '';
            window.isZenTempExpanded = true;

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

    // 绑定右上角关闭按钮
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

        // 切换模式时清空表单，防止状态污染
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

        // 切换模式时清混表单
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

    // 用户中心交互逻辑
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

    // 点击遮罩关闭 优化)
    authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
            closeAllModals();
        }
    });
    // 统一通过 closeAllModals 处理，由其决定是否静默或同步
    document.getElementById('btn-close-edit').onclick = () => closeAllModals();
    document.getElementById('btn-confirm-edit').onclick = saveItem;
};
window.handleAuthError = handleAuthError;
// Window bridge for cross-module and inline onclick callers
window.openLoginModal = openLoginModal;
window.toggleSkeleton = toggleSkeleton;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doLogout = doLogout;
window.doResetConfig = doResetConfig;
window.initAuthUI = initAuthUI;
