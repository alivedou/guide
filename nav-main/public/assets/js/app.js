/**
 * ==========================================
 * app.js - CloudNav Phase 2 & 3 (Core)
 * ==========================================
 */

// ==================== 全局状态 ====================
let appData = { settings: { cardWidth: 85 }, categories: [], items: [] };
let activeCatId = '';
let sysToken = localStorage.getItem('nav_token') || '';
let isAdmin = false;
let isZenTempExpanded = false;
let isActuallyZen = false;
let isRendering = false; // 渲染防抖锁
let isPageManagementMode = false; // 页面管理模式开关 (Task 3.3)
let selectedIds = new Set(); // 已选中的 ID 集合
let sortableInstances = []; // Sortable 实例存储
let syncTimer = null; // 同步防抖计时器 (Task 2.5.4)
let syncRetryCount = 0; // 重试计数
let touchStartY = 0; // 触摸起点 (Task 2.5.1)
let currentSearchIndex = -1;
let historyIndex = -1;
let themeMode = localStorage.getItem('nav_theme_mode') || 'auto';
let simpleMode = localStorage.getItem('nav_simple_mode') === 'true';
let currentEnginePrefix = localStorage.getItem('nav_search_prefix') || 'https://cn.bing.com/search?q=';

// ==================== 1. 初始化入口 ====================
document.addEventListener('DOMContentLoaded', () => {
    initSiteConfig();
    initThemeMode();
    initSidebar();
    initZenMode();
    init();
    initSearch();
    initAuthUI();
    initAnnouncements();
    initGlobalEvents();
    checkSWUpdate();
});

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
// Task 4.1: 全站 SEO 与标题下发
const initSiteConfig = async () => {
    try {
        const res = await fetch('/api/admin/site-config');
        if (res.ok) {
            const config = await res.json();
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
const initAnnouncements = async () => {
    try {
        const res = await fetch('/api/announcements');
        if (!res.ok) return;
        const { announcements } = await res.json();
        if (!announcements || announcements.length === 0) return;

        announcements.forEach(notice => {
            const hasRead = localStorage.getItem(`read_notice_${notice.id}`);
            if (hasRead) return;

            if (notice.type === 'important') {
                renderImportantNotice(notice);
            } else {
                renderQuietNotice(notice);
            }
        });
    } catch (e) { console.warn('[Notice] Failed to fetch announcements'); }
};

const renderImportantNotice = (notice) => {
    const banner = document.createElement('div');
    banner.className = 'important-banner';
    banner.innerHTML = `
        <div class="banner-content">
            <i class="ri-error-warning-line"></i>
            <span>${notice.content}</span>
            <button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('read_notice_${notice.id}', 'true')">不再提示</button>
        </div>
    `;
    document.body.prepend(banner);
};

const renderQuietNotice = (notice) => {
    showToast(`新公告: ${notice.title} (点击侧边栏查看)`, "#3498db");
    const adminArea = document.getElementById('sidebar-admin-actions');
    if (adminArea && !document.querySelector('.notice-bell')) {
        const bell = document.createElement('div');
        bell.className = 'notice-bell';
        bell.innerHTML = '<i class="ri-notification-3-line"></i><span class="bell-dot"></span>';
        bell.onclick = () => {
            alert(`【公告】${notice.title}\n\n${notice.content}`);
            bell.remove();
            localStorage.setItem('read_notice_${notice.id}', 'true');
        };
        adminArea.prepend(bell);
    }
};
const showToast = (m, c = "#27ae60") => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = m; t.style.background = c; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
};

const showLoader = (t) => {
    const el = document.getElementById('global-loading-text');
    if (el) el.innerText = t;
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
};

const hideLoader = () => {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'none';
};

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
    sysToken = '';
    isAdmin = false;
    showToast("会话已过期，请重新登录", "#e67e22");
    document.getElementById('auth-overlay').style.display = 'flex';
    init(true); // 回退到游客视图
};

// 页面关闭前的紧急同步
window.addEventListener('beforeunload', () => {
    if (!sysToken || isAdmin) return;
    const clicks = localStorage.getItem('nav_clicks_history');
    if (clicks) {
        const payload = JSON.stringify({ ...appData, clicks_history: JSON.parse(clicks) });
        // 使用 Beacon API 确保请求在页面关闭后仍能发出
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/config', blob);
    }
});

const updateStyles = () => {
    const w = appData.settings?.cardWidth || 85;
    document.documentElement.style.setProperty('--card-w', w + 'px');
    document.documentElement.style.setProperty('--card-h', w + 'px');
    const bg = appData.settings?.bgUrl;
    if (bg) {
        document.body.style.background = bg.startsWith('http') ? `url(${bg}) center/cover fixed` : bg;
    }
};

const toggleSkeleton = (s) => {
    const sk = document.getElementById('skeleton-screen');
    const mc = document.getElementById('main-content');
    if (sk) sk.style.display = s ? 'block' : 'none';
    if (mc) mc.style.display = s ? 'none' : 'block';
};

// ==================== 3. 认证逻辑 ====================
const doLogin = async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    if (!u || !p) return showToast("请填写用户名和密码", "#e67e22");

    showLoader('正在验证身份...');
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        
        if (res.status === 429) {
            return showToast(data.error || "尝试次数过多，请稍后再试", "#e74c3c");
        }

        if (data.success) {
            sysToken = 'Bearer ' + data.token;
            localStorage.setItem('nav_token', sysToken);
            document.getElementById('auth-overlay').style.display = 'none';
            showToast(`欢迎回来，${data.user.username}`);
            await init(true);
        } else {
            showToast(data.error || "登录失败", "#e74c3c");
        }
    } catch (err) {
        showToast("登录请求失败", "#e74c3c");
    } finally {
        hideLoader();
    }
};

const doRegister = async () => {
    const userEl = document.getElementById('auth-username');
    const passEl = document.getElementById('auth-password');
    const inviteEl = document.getElementById('auth-invite-code');
    const u = userEl.value.trim();
    const p = passEl.value.trim();
    const i = inviteEl?.value.trim() || '';

    if (!u || !p) {
        showToast("请填写完整信息", "#e67e22");
        return;
    }

    console.log('Registering user:', u);
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p, inviteCode: i })
        });
        
        const data = await res.json();
        console.log('Register response:', data);

        if (res.ok && data.success) {
            showToast("注册成功！即将切换到登录", "#2ecc71");
            setTimeout(() => {
                const loginTab = document.getElementById('tab-login');
                if (loginTab) loginTab.click();
                passEl.value = ''; // 清空密码框
                if (inviteEl) inviteEl.value = '';
            }, 1000);
        } else {
            showToast(data.error || "注册失败", "#e74c3c");
        }
    } catch (err) {
        console.error('Register API Error:', err);
        showToast("无法连接到服务器，请检查网络", "#e74c3c");
    }
};

const doLogout = async () => {
    localStorage.removeItem('nav_token');
    sysToken = '';
    isAdmin = false;
    localStorage.removeItem('nav_app_data');
    await init(true);
    showToast("已退出登录");
};

const doResetConfig = async () => {
    if (!confirm("确定要恢复默认配置吗？这将覆盖您当前的自定义导航内容！")) return;
    
    showLoader('正在恢复默认配置...');
    try {
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
    const authOverlay = document.getElementById('auth-overlay');
    let mode = 'login';

    if (!tabLogin || !tabRegister || !btnSubmit) return;

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
        if (tip) tip.innerText = '还没有账号？点击上方“注册”开始';
    });

    tabRegister.addEventListener('click', () => {
        console.log('Switch to register mode');
        mode = 'register';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        const tip = document.getElementById('auth-switch-tip');
        if (tip) tip.innerText = '已有账号？点击上方“登录”返回';
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

    // 点击遮罩关闭 (Task 1.1 优化)
    authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
            authOverlay.style.display = 'none';
        }
    });
    // 绑定编辑框关闭和确认按钮
    document.getElementById('btn-close-edit').onclick = () => document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('btn-confirm-edit').onclick = saveItem;
};

// ==================== 4. 数据加载 ====================
const init = async (forceRender = false) => {
    try {
        console.log('Fetching config...');
        const res = await fetch('/api/config', {
            headers: sysToken ? { 'Authorization': sysToken } : {}
        });
        
        if (res.ok) {
            const data = await res.json();
            console.log('Config received:', data);
            
            // 数据完整性校验
            if (!data.categories || !data.items) {
                throw new Error('Malformed data from server');
            }

            appData = data;
            
            // 恢复云端点击数据 (Task 2.5.4)
            if (data.clicks_history) {
                localStorage.setItem('nav_clicks_history', JSON.stringify(data.clicks_history));
            }
            
            isAdmin = appData.isAdmin;
            localStorage.setItem('nav_app_data', JSON.stringify(appData));
            
            // 渲染
            renderNav();
            renderTools();
            updateStyles();
        } else {
            console.error('Config fetch failed:', res.status);
        }
        toggleSkeleton(false);
    } catch (e) { 
        console.error('Init error:', e);
        toggleSkeleton(false);
        renderTools();
    }
};

// ==================== 5. 渲染逻辑 ====================
const buildCardHtml = (i) => {
    const target = appData.settings?.openInNewTab ? '_blank' : '_self';
    const icon = i.icon && i.icon.startsWith('http') 
        ? `<img src="${i.icon}" loading="lazy" data-retry-index="0" onerror="utils.handleIconError(this, '${i.url}')">` 
        : `<span class="emoji-icon">${i.icon || '🔗'}</span>`;
    return `<a href="${i.url}" target="${target}"><div class="icon-wrapper">${icon}</div><h3>${i.title}</h3></a>`;
};

const renderNav = () => {
    if (isRendering) return;
    isRendering = true;

    try {
        const sidebarNav = document.getElementById('sidebar-nav');
        const container = document.getElementById('grid-container');
        if (!sidebarNav || !container) return;

        // 基础数据防御
        if (!appData || !appData.categories) {
            console.warn('AppData not ready');
            return;
        }

        const clickData = getFrequentItemsData();
        const freqIds = Object.keys(clickData).filter(id => clickData[id] >= 10);

        sidebarNav.innerHTML = '';
        container.innerHTML = '';

        let cats = isAdmin ? [...appData.categories] : appData.categories.filter(c => !c.hidden);
        if (freqIds.length > 0 && appData.settings?.showFrequent !== false) {
            cats.unshift({ id: 'VIRTUAL_FREQ', name: '常去网站', icon: '⭐' });
        }

        // 导航视界定义：自动校正过期的或无效 of activeCatId (Task 2.1 深度自愈)
        const isValidActiveCat = cats.some(c => c.id === activeCatId);
        if (cats.length > 0 && (!activeCatId || !isValidActiveCat)) {
            activeCatId = cats[0].id;
        }

        cats.forEach(cat => {
            const navItem = document.createElement('div');
            navItem.className = `sidebar-nav-item ${activeCatId === cat.id ? 'active' : ''}`;
            navItem.innerHTML = `<span class="nav-icon">${cat.icon}</span><span class="nav-label">${cat.name}</span>`;
            navItem.onclick = () => {
                activeCatId = cat.id;
                if (appData.settings?.zenMode) { 
                    isZenTempExpanded = true; 
                    renderNav(); 
                    // 切换分类时，由于是隔离渲染，直接滚动到顶部即可
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                else { 
                    document.getElementById('section-' + cat.id)?.scrollIntoView({ behavior: 'smooth' }); 
                }
            };
            sidebarNav.appendChild(navItem);

            // Zen Mode 核心逻辑：遵循单一视图原则 (Task 2.1 规范化)
            // 在极简模式展开态，只渲染当前选中的分类，实现视觉隔离
            if (appData.settings?.zenMode && isZenTempExpanded && cat.id !== activeCatId) return;

            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = 'section-' + cat.id;
            section.innerHTML = `<div class="category-section-title">${cat.icon} ${cat.name}</div>`;

            const grid = document.createElement('div');
            grid.className = 'nav-grid';
            
            // 健壮的过滤逻辑：同时支持 catId 和 cat_id (容错设计)
            const items = (cat.id === 'VIRTUAL_FREQ') 
                ? appData.items.filter(i => freqIds.includes(i.id)) 
                : appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id) && (isAdmin || !i.hidden));
                
            items.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = `card ${item.hidden ? 'hidden-item' : ''}`;
                // 为磁贴增加 Tab 索引与唯一 ID，方便键盘流转 (Task 2.5.3)
                card.setAttribute('tabindex', '0');
                card.setAttribute('data-id', item.id);
                card.style.animationDelay = `${idx * 0.03}s`;
                
                let html = buildCardHtml(item);
                
                // Admin 编辑入口 (Task 3.2)
                if (isAdmin) {
                    html += `<div class="card-admin-btns">
                        <button class="card-edit-btn" onclick="event.stopPropagation(); openEditModal('${item.id}')" title="编辑"><i class="ri-edit-line"></i></button>
                    </div>`;
                }
                
                card.innerHTML = html;
                
                // 处理点击逻辑 (Task 3.3 页面管理适配)
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
                        recordClick(item.id);
                    }
                };
                
                // 键盘激活支持
                card.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        if (isPageManagementMode) {
                            card.click();
                        } else {
                            recordClick(item.id);
                            window.open(item.url, appData.settings?.openInNewTab ? '_blank' : '_self');
                        }
                    }
                };
                
                grid.appendChild(card);
            });

            // Task 4.4: 磁贴末尾的新增入口 (仅管理模式)
            if (isPageManagementMode && cat.id !== 'VIRTUAL_FREQ') {
                const addCard = document.createElement('div');
                const catItemCount = items.length;
                const isCatFull = catItemCount >= 100;

                addCard.className = `card add-new-card ${isCatFull ? 'disabled' : ''}`;
                addCard.innerHTML = `
                    <div class="icon-wrapper"><i class="ri-add-line"></i></div>
                    <h3>${isCatFull ? '已满' : '新增书签'}</h3>
                `;
                addCard.onclick = () => {
                    if (isCatFull) return showToast("该分类已达到 100 个书签上限", "#e74c3c");
                    activeCatId = cat.id;
                    openEditModal('');
                };
                grid.appendChild(addCard);
            }

            section.appendChild(grid);
            container.appendChild(section);
        });

        // Task 4.4: 侧边栏新增分类入口 (仅管理模式)
        if (isPageManagementMode && isAdmin) {
            const addCatBtn = document.createElement('div');
            const isCatLimit = appData.categories.length >= 20;
            const sidebarNav = document.getElementById('sidebar-nav');
            if (sidebarNav) {
                addCatBtn.className = `sidebar-nav-item add-cat-nav ${isCatLimit ? 'disabled' : ''}`;
                addCatBtn.innerHTML = `<span class="nav-icon"><i class="ri-add-line"></i></span><span class="nav-label">${isCatLimit ? '分类已满' : '添加分类'}</span>`;
                addCatBtn.onclick = () => {
                    if (isCatLimit) return showToast("最多只能创建 20 个分类", "#e74c3c");
                    const name = prompt("请输入新分类名称:");
                    if (name) {
                        const newCat = { id: 'cat_' + Date.now(), name, icon: '📂', hidden: false };
                        appData.categories.push(newCat);
                        showToast(`分类 ${name} 已创建`);
                        syncConfigToCloud();
                        renderNav();
                    }
                };
                sidebarNav.appendChild(addCatBtn);
            }
        }

        isActuallyZen = appData.settings?.zenMode && !isZenTempExpanded;
        document.body.classList.toggle('zen-active', isActuallyZen);
        
        const zenBtn = document.getElementById('zen-expand-btn');
        if (zenBtn) zenBtn.style.display = isActuallyZen ? 'flex' : 'none';

        // Zen Mode 下强制侧边栏行为 (Task 2.1)
        if (isActuallyZen || (appData.settings?.zenMode && isZenTempExpanded)) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('open')) {
                document.getElementById('sidebar-overlay')?.classList.remove('visible');
            }
        }

        // Task 1.1: UX Bridge - 游客引导
        if (!sysToken && isActuallyZen) {
            let bridge = document.getElementById('guest-login-bridge');
            if (!bridge) {
                bridge = document.createElement('div');
                bridge.id = 'guest-login-bridge';
                bridge.className = 'guest-login-bridge';
                bridge.innerText = '管理我的书签';
                bridge.onclick = () => document.getElementById('auth-overlay').style.display = 'flex';
                const searchSection = document.getElementById('search-section');
                if (searchSection) searchSection.appendChild(bridge);
            }
        } else {
            document.getElementById('guest-login-bridge')?.remove();
        }
    } finally {
        isRendering = false;
    }
};

const renderTools = () => {
    const area = document.getElementById('sidebar-admin-actions');
    const adminBanner = document.getElementById('admin-active-banner');
    if (!area) return;
    
    // 如果已登录
    if (sysToken) {
        const userDisplayName = appData.username || '已登录用户';
        const roleBadge = isAdmin ? '<span class="admin-badge">ADMIN</span>' : '';
        
        // Task 1.1: 配额状态感知
        const isAllFull = appData.categories.length > 0 && appData.categories.every(cat => 
            appData.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length >= 100
        );

        // 管理员模式视觉高亮切换
        if (isAdmin && adminBanner) {
            adminBanner.style.display = 'flex';
            document.body.classList.add('admin-mode');
        } else if (adminBanner) {
            adminBanner.style.display = 'none';
            document.body.classList.remove('admin-mode');
        }

        area.innerHTML = `
            <div class="sidebar-admin-container">
                <div class="sidebar-nav-label">管理面板</div>
                
                ${isAdmin ? `
                <div class="sidebar-nav-item admin-tool-btn" onclick="openAdminHub()">
                    <span class="nav-icon"><i class="ri-shield-user-line"></i></span>
                    <span class="nav-label">控制中心</span>
                </div>` : ''}

                <div class="sidebar-nav-item admin-tool-btn ${isPageManagementMode ? 'active' : ''}" onclick="togglePageManagement()">
                    <span class="nav-icon"><i class="ri-layout-masonry-line"></i></span>
                    <span class="nav-label">页面管理</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn ${isAllFull ? 'disabled' : ''}" 
                     onclick="${isAllFull ? 'showToast(\'书签配额已满\', \'#e74c3c\')' : 'openEditModal(\'\')'}">
                    <span class="nav-icon"><i class="ri-add-circle-line"></i></span>
                    <span class="nav-label">新增网址</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn" onclick="openJsonEditor()">
                    <span class="nav-icon"><i class="ri-code-s-slash-line"></i></span>
                    <span class="nav-label">专家模式</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn" onclick="exportConfig()">
                    <span class="nav-icon"><i class="ri-download-2-line"></i></span>
                    <span class="nav-label">备份导出</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn" onclick="document.getElementById('import-file').click()">
                    <span class="nav-icon"><i class="ri-upload-2-line"></i></span>
                    <span class="nav-label">配置导入</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn" onclick="doResetConfig()">
                    <span class="nav-icon"><i class="ri-refresh-line"></i></span>
                    <span class="nav-label">重置模板</span>
                </div>

                <div class="sidebar-nav-item admin-tool-btn logout-btn" onclick="doLogout()">
                    <span class="nav-icon"><i class="ri-logout-box-r-line"></i></span>
                    <span class="nav-label">退出系统</span>
                </div>

                <div class="sidebar-user-info">
                    <i class="ri-user-smile-line"></i>
                    <span>${userDisplayName} ${roleBadge}</span>
                </div>
            </div>
        `;
    } else {
        area.innerHTML = `
            <div class="sidebar-nav-item" onclick="document.getElementById('auth-overlay').style.display='flex'">
                <span class="nav-icon"><i class="ri-user-line"></i></span>
                <span class="nav-label">登录 / 注册</span>
            </div>
        `;
    }
};

// ==================== 6. 其他初始化 ====================
const initThemeMode = () => {
    document.body.classList.toggle('dark-theme', themeMode === 'dark');
    document.body.classList.toggle('light-theme', themeMode === 'light');
    
    // 同步 PWA 状态栏颜色 (Task 5.1)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = themeMode === 'dark' ? '#111111' : '#f0f3f8';
    }
};

const toggleSidebar = (force) => {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (!s || !o) return;
    const isOpen = typeof force === 'boolean' ? force : !s.classList.contains('open');
    s.classList.toggle('open', isOpen);
    o.classList.toggle('visible', isOpen);
};

const initSidebar = () => {
    const t = document.getElementById('sidebar-toggle');
    const o = document.getElementById('sidebar-overlay');
    if (t) t.onclick = () => toggleSidebar();
    if (o) o.onclick = () => toggleSidebar(false);
};

const initZenMode = () => {
    const btn = document.getElementById('zen-expand-btn');
    if (btn) btn.onclick = () => { isZenTempExpanded = true; renderNav(); };
};

const initSearch = () => {
    const sea = document.getElementById('sea-input');
    const dropdown = document.getElementById('sea-dropdown');
    const resultsList = document.getElementById('local-results-list');
    if (!sea || !dropdown || !resultsList) return;

    sea.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const val = sea.value.trim();
            if (val) {
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
            if (items.length === 0) return;
            e.preventDefault();
            
            let activeIdx = items.findIndex(i => i.classList.contains('active'));
            if (e.key === 'ArrowDown') activeIdx = (activeIdx + 1) % items.length;
            else activeIdx = (activeIdx - 1 + items.length) % items.length;
            
            items.forEach((item, idx) => item.classList.toggle('active', idx === activeIdx));
        }
    };

    // 搜索态视觉隔离逻辑 (Task 2.5.2 增强)
    sea.addEventListener('input', () => {
        const val = sea.value.trim().toLowerCase();
        const hasText = val.length > 0;
        document.body.classList.toggle('is-searching', hasText);
        
        if (hasText) {
            // 执行站内模糊搜索
            const matches = appData.items.filter(i => 
                (i.title.toLowerCase().includes(val) || (i.desc && i.desc.toLowerCase().includes(val))) &&
                (isAdmin || !i.hidden)
            ).slice(0, 8); // 最多显示 8 个结果

            if (matches.length > 0) {
                resultsList.innerHTML = matches.map((m, idx) => `
                    <div class="local-result-item ${idx === 0 ? 'active' : ''}" onclick="recordClick('${m.id}'); window.open('${m.url}', '${appData.settings?.openInNewTab ? '_blank' : '_self'}')">
                        <span class="result-icon">${m.icon?.startsWith('http') ? `<img src="${m.icon}" data-retry-index="0" onerror="utils.handleIconError(this, '${m.url}')">` : (m.icon || '🔗')}</span>
                        <div class="result-info">
                            <div class="result-title">${m.title}</div>
                            <div class="result-url">${m.url}</div>
                        </div>
                    </div>
                `).join('');
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
        if (appData.settings?.zenMode && !isZenTempExpanded) {
            isZenTempExpanded = true;
            renderNav();
        }
    });

    // 点击外部关闭搜索下拉
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            dropdown.style.display = 'none';
        }
    });
};

// ==================== 9. Task 3.3: 页面管理模式 (Page Management) ====================

const togglePageManagement = (force) => {
    if (!isAdmin) return showToast("仅管理员可进入页面管理模式", "#e67e22");

    isPageManagementMode = typeof force === 'boolean' ? force : !isPageManagementMode;
    document.body.classList.toggle('page-manage-active', isPageManagementMode);
    
    if (isPageManagementMode) {
        selectedIds.clear();
        showToast("进入页面管理模式：支持跨分类拖拽和批量操作", "#3498db");
        initSortable();
    } else {
        destroySortable();
        updateBatchBar();
        showToast("已退出页面管理模式");
    }
    
    renderTools();
    renderNav(); // 刷新渲染以更新交互状态
};

const initSortable = () => {
    destroySortable(); // 清理旧实例
    
    // 1. 书签网格排序 (支持跨分类)
    const grids = document.querySelectorAll('.nav-grid');
    grids.forEach(grid => {
        const catId = grid.closest('.category-section').id.replace('section-', '');
        if (catId === 'VIRTUAL_FREQ') return;

        const sortable = new Sortable(grid, {
            group: 'shared-bookmarks',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            handle: '.icon-wrapper',
            onEnd: (evt) => handleSortEnd(evt, 'item')
        });
        sortableInstances.push(sortable);
    });

    // 2. 侧边栏分类排序 (仅管理模式开启)
    const sidebarNav = document.getElementById('sidebar-nav');
    if (sidebarNav) {
        const catSortable = new Sortable(sidebarNav, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.nav-icon',
            onEnd: (evt) => handleSortEnd(evt, 'category')
        });
        sortableInstances.push(catSortable);
    }
};

const destroySortable = () => {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];
};

const handleSortEnd = (evt, type) => {
    if (type === 'item') {
        const fromCatId = evt.from.closest('.category-section').id.replace('section-', '');
        const toCatId = evt.to.closest('.category-section').id.replace('section-', '');
        const itemId = evt.item.getAttribute('data-id');

        console.log(`[Sort] Moved item ${itemId} from ${fromCatId} to ${toCatId}`);

        // 更新本地内存状态
        const item = appData.items.find(i => i.id === itemId);
        if (item) {
            item.catId = toCatId;
            item.cat_id = toCatId;
        }

        // 重新物理校准所有 items 顺序 (基于当前 DOM 顺序)
        const newItemsOrder = [];
        document.querySelectorAll('.nav-grid .card').forEach(card => {
            const id = card.getAttribute('data-id');
            const found = appData.items.find(i => i.id === id);
            if (found) newItemsOrder.push(found);
        });
        
        // 补全不在 DOM 中的 items (如果有)
        appData.items.forEach(i => {
            if (!newItemsOrder.find(ni => ni.id === i.id)) newItemsOrder.push(i);
        });
        appData.items = newItemsOrder;

    } else if (type === 'category') {
        console.log('[Sort] Categories reordered');
        const newCatOrder = [];
        document.querySelectorAll('.sidebar-nav-item').forEach(nav => {
            const label = nav.querySelector('.nav-label')?.innerText;
            const found = appData.categories.find(c => c.name === label);
            if (found) newCatOrder.push(found);
        });
        appData.categories = newCatOrder;
    }

    // 触发防抖同步
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncConfigToCloud, 2000);
};

const updateBatchBar = () => {
    const bar = document.getElementById('batch-actions-bar');
    const countEl = document.getElementById('batch-count');
    if (!bar || !countEl) return;

    if (isPageManagementMode && selectedIds.size > 0) {
        countEl.innerText = selectedIds.size;
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
};

const syncConfigToCloud = async () => {
    if (!sysToken) return;
    console.log('[Sync] Saving changes to cloud...');
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(appData)
        });

        if (res.status === 401) return handleAuthError();
        
        if (res.status === 403) {
            const err = await res.json();
            if (err.code === 'ERR_QUOTA_EXCEEDED') {
                return showToast(err.error || "已达到书签配额上限，请先清理无用书签", "#e74c3c");
            }
        }

        if (res.ok) showToast("更改已自动保存到云端");
        else throw new Error("Cloud save failed");
    } catch (e) {
        showToast("自动保存失败", "#e74c3c");
    }
};

const doBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个书签吗？`)) return;

    appData.items = appData.items.filter(i => !selectedIds.has(i.id));
    selectedIds.clear();
    showToast("批量删除成功");
    
    await syncConfigToCloud();
    renderNav();
    updateBatchBar();
};

const openBatchMoveModal = () => {
    if (selectedIds.size === 0) return;
    
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = `批量移动 (${selectedIds.size} 个书签)`;
    body.innerHTML = `
        <div class="form-group">
            <label>选择目标分类</label>
            <select id="batch-move-cat" class="edit-input">
                ${appData.categories.filter(c => c.id !== 'VIRTUAL_FREQ').map(c => `
                    <option value="${c.id}">${c.name}</option>
                `).join('')}
            </select>
        </div>
    `;
    
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = () => {
        const targetCatId = document.getElementById('batch-move-cat').value;
        const targetCat = appData.categories.find(c => c.id === targetCatId);
        
        if (!targetCat) return showToast("无效的目标分类", "#e67e22");

        // Task 4.3: 批量移动配额校验
        const currentItemsInTarget = appData.items.filter(i => (i.catId === targetCatId || i.cat_id === targetCatId) && !selectedIds.has(i.id));
        if (currentItemsInTarget.length + selectedIds.size > 100) {
            return showToast(`目标分类已满，无法容纳新增的 ${selectedIds.size} 个书签`, "#e74c3c");
        }

        appData.items.forEach(i => {
            if (selectedIds.has(i.id)) {
                i.catId = targetCatId;
                i.cat_id = targetCatId;
            }
        });

        modal.style.display = 'none';
        selectedIds.clear();
        showToast(`成功移动至 ${targetCat.name}`);
        
        syncConfigToCloud();
        renderNav();
        updateBatchBar();
    };
};

// ==================== 10. Task 4.1: 管理员后台 (Admin Hub) ====================

const openAdminHub = async () => {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = "管理员控制中心 (Admin Hub)";
    body.innerHTML = '<div class="admin-hub-loading">正在加载全站数据...</div>';
    modal.style.display = 'flex';
    confirmBtn.style.display = 'none'; // 后台采用即时操作

    try {
        const [usersRes, configRes, inviteRes, announceRes] = await Promise.all([
            fetch('/api/admin/users', { headers: { 'Authorization': sysToken } }),
            fetch('/api/admin/site-config'),
            fetch('/api/admin/invitations', { headers: { 'Authorization': sysToken } }),
            fetch('/api/admin/announcements', { headers: { 'Authorization': sysToken } })
        ]);
        
        const { users } = await usersRes.json();
        const config = await configRes.json();
        const { invitations } = await inviteRes.json();
        const { announcements } = await announceRes.json();

        body.innerHTML = `
            <div class="admin-hub-tabs">
                <button class="hub-tab active" onclick="switchHubTab('users')">用户管理</button>
                <button class="hub-tab" onclick="switchHubTab('config')">全站设置</button>
                <button class="hub-tab" onclick="switchHubTab('invites')">邀请管理</button>
                <button class="hub-tab" onclick="switchHubTab('announcements')">公告管理</button>
            </div>
            <div id="hub-content-users" class="hub-pane active">
                <table class="admin-table">
                    <thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>${u.username}</td>
                                <td>
                                    <select onchange="updateUserAdmin('${u.id}', { role: this.value })" ${u.role === 'admin' ? 'disabled' : ''}>
                                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="super_user" ${u.role === 'super_user' ? 'selected' : ''}>Super User</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </td>
                                <td><span class="status-badge ${u.status}">${u.status}</span></td>
                                <td>
                                    ${u.role === 'admin' ? '-' : `
                                        <button class="action-link" onclick="updateUserAdmin('${u.id}', { status: '${u.status === 'active' ? 'frozen' : 'active'}' })">
                                            ${u.status === 'active' ? '冻结' : '解冻'}
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div id="hub-content-config" class="hub-pane">
                <div class="form-group">
                    <label>站点标题</label>
                    <input type="text" id="admin-site-title" value="${config.siteTitle || ''}">
                </div>
                <div class="form-group">
                    <label>Favicon URL</label>
                    <input type="text" id="admin-favicon-url" value="${config.faviconUrl || ''}">
                </div>
                <div class="form-group">
                    <label>SEO 关键词</label>
                    <input type="text" id="admin-site-keywords" value="${config.seoKeywords || ''}">
                </div>
                <div class="form-group">
                    <label>SEO 描述</label>
                    <textarea id="admin-site-desc">${config.seoDescription || ''}</textarea>
                </div>
                <div class="form-group" style="display:flex; gap:20px; margin-top:10px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" id="admin-allow-reg" ${config.allowOpenRegistration !== false ? 'checked' : ''}> 开放注册
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" id="admin-require-invite" ${config.requireInvitation ? 'checked' : ''}> 强制邀请码
                    </label>
                </div>
                <button class="tab-btn active" style="width:100%; margin-top:15px;" onclick="saveSiteConfig()">保存全站配置</button>
            </div>
            <div id="hub-content-invites" class="hub-pane">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button class="tab-btn active" onclick="generateInvites(1)">生成 1 个</button>
                    <button class="tab-btn active" onclick="generateInvites(5)">生成 5 个</button>
                    <button class="tab-btn" onclick="copyUnusedInvites()">复制未使用</button>
                </div>
                <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 8px;">
                    <table class="admin-table">
                        <thead><tr><th>邀请码</th><th>状态</th><th>使用者</th><th>操作</th></tr></thead>
                        <tbody>
                            ${invitations.map(i => `
                                <tr>
                                    <td style="font-family: monospace;">${i.code}</td>
                                    <td><span class="status-badge ${i.status}">${i.status}</span></td>
                                    <td>${i.used_by_name || '-'}</td>
                                    <td>
                                        ${i.status === 'unused' ? `<button class="action-link" onclick="deleteInvite('${i.code}')">删除</button>` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div id="hub-content-announcements" class="hub-pane">
                <div class="admin-announce-editor">
                    <div class="form-group">
                        <label>公告标题</label>
                        <input type="text" id="announce-title" placeholder="请输入标题">
                    </div>
                    <div class="form-group">
                        <label>公告内容</label>
                        <textarea id="announce-content" rows="3" placeholder="请输入公告内容"></textarea>
                    </div>
                    <div class="form-row" style="display:flex; gap:15px; margin-bottom:10px;">
                        <div class="form-group" style="flex:1">
                            <label>类型</label>
                            <select id="announce-type">
                                <option value="quiet">Quiet (静默铃铛)</option>
                                <option value="important">Important (顶部条幅)</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1">
                            <label>过期时间</label>
                            <input type="datetime-local" id="announce-expire">
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                            <input type="checkbox" id="announce-top"> 置顶公告
                        </label>
                    </div>
                    <button class="tab-btn active" style="width:100%; margin-top:10px;" onclick="saveAnnouncement()">发布公告</button>
                </div>
                <hr style="border:0; border-top:1px solid var(--glass-border); margin:15px 0;">
                <div style="max-height: 200px; overflow-y: auto;">
                    <table class="admin-table">
                        <thead><tr><th>标题</th><th>类型</th><th>状态</th><th>操作</th></tr></thead>
                        <tbody>
                            ${announcements.map(a => `
                                <tr>
                                    <td>${a.title}</td>
                                    <td>${a.type}</td>
                                    <td>${a.status}</td>
                                    <td>
                                        <button class="action-link" onclick="deleteAnnouncement(${a.id})">删除</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="error-text">加载失败: ${e.message}</div>`;
    }
};

window.switchHubTab = (tab) => {
    document.querySelectorAll('.hub-tab').forEach(t => t.classList.toggle('active', t.innerText.includes(
        tab === 'users' ? '用户' : (tab === 'config' ? '全站' : '邀请')
    )));
    document.querySelectorAll('.hub-pane').forEach(p => p.classList.toggle('active', p.id === `hub-content-${tab}`));
};

window.generateInvites = async (count) => {
    try {
        const res = await fetch('/api/admin/invitations', {
            method: 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        });
        if (res.ok) {
            showToast(`成功生成 ${count} 个邀请码`);
            openAdminHub();
        }
    } catch (e) { showToast("生成失败", "#e74c3c"); }
};

window.deleteInvite = async (code) => {
    if (!confirm("确定要删除此邀请码吗？")) return;
    try {
        const res = await fetch('/api/admin/invitations', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (res.ok) {
            showToast("删除成功");
            openAdminHub();
        }
    } catch (e) { showToast("删除失败", "#e74c3c"); }
};

window.updateUserAdmin = async (userId, payload) => {
    const adminPassword = prompt("执行管理操作，请输入您的管理员密码进行二次验证:");
    if (adminPassword === null) return;
    if (!adminPassword) return showToast("请输入密码", "#e67e22");

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...payload, adminPassword })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("操作成功");
            openAdminHub();
        } else {
            showToast(data.error || "操作失败", "#e74c3c");
        }
    } catch (e) { showToast("请求失败", "#e74c3c"); }
};

window.saveAnnouncement = async () => {
    const payload = {
        title: document.getElementById('announce-title').value.trim(),
        content: document.getElementById('announce-content').value.trim(),
        type: document.getElementById('announce-type').value,
        expire_at: document.getElementById('announce-expire').value,
        is_top: document.getElementById('announce-top').checked
    };

    if (!payload.title || !payload.content) return showToast("标题和内容不能为空", "#e67e22");

    try {
        const res = await fetch('/api/admin/announcements', {
            method: 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast("公告已发布");
            openAdminHub();
        }
    } catch (e) { showToast("发布失败", "#e74c3c"); }
};

window.deleteAnnouncement = async (id) => {
    if (!confirm("确定要删除这条公告吗？")) return;
    try {
        const res = await fetch('/api/admin/announcements', {
            method: 'DELETE',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            showToast("已删除");
            openAdminHub();
        }
    } catch (e) { showToast("删除失败", "#e74c3c"); }
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

window.copyUnusedInvites = () => {
    const cells = document.querySelectorAll('#hub-content-invites td[style*="monospace"]');
    const unused = [];
    cells.forEach(cell => {
        const status = cell.nextElementSibling.innerText;
        if (status === 'unused') unused.push(cell.innerText);
    });
    if (unused.length === 0) return showToast("没有可用的邀请码", "#e67e22");
    navigator.clipboard.writeText(unused.join('\n')).then(() => showToast("已复制到剪贴板"));
};

window.toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    if (!confirm(`确定要将该用户设为 ${newStatus} 吗？`)) return;

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status: newStatus })
        });
        if (res.ok) {
            showToast("状态更新成功");
            openAdminHub(); // 刷新
        }
    } catch (e) { showToast("操作失败", "#e74c3c"); }
};

window.saveSiteConfig = async () => {
    const config = {
        siteTitle: document.getElementById('admin-site-title').value,
        faviconUrl: document.getElementById('admin-favicon-url').value,
        seoKeywords: document.getElementById('admin-site-keywords').value,
        seoDescription: document.getElementById('admin-site-desc').value,
        allowOpenRegistration: document.getElementById('admin-allow-reg').checked,
        requireInvitation: document.getElementById('admin-require-invite').checked
    };

    try {
        const res = await fetch('/api/admin/site-config', {
            method: 'POST',
            headers: { 'Authorization': sysToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (res.ok) {
            showToast("全站配置已更新，正在应用...");
            initSiteConfig();
        }
    } catch (e) { showToast("保存失败", "#e74c3c"); }
};

// ==================== 11. Task 3.5: JSON 专家模式 & 导入导出 ====================

let monacoEditor = null;

const openJsonEditor = () => {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-title');
    const body = document.getElementById('edit-form-body');
    const confirmBtn = document.getElementById('btn-confirm-edit');
    
    if (!modal || !body) return;

    title.innerText = "JSON 专家模式 (专家级定制)";
    body.innerHTML = `
        <div style="margin-bottom: 10px; display:flex; gap:10px;">
            <button class="action-link" onclick="formatMonacoJson()"><i class="ri-magic-line"></i> 一键美化</button>
            <span style="color:var(--text-dim); font-size:12px;">提示: 修改后点击下方“应用”保存到云端</span>
        </div>
        <div id="monaco-container" style="height: 400px; border-radius: 8px; overflow: hidden; border: 1px solid var(--glass-border);"></div>
    `;
    modal.style.display = 'flex';
    confirmBtn.style.display = 'block';
    confirmBtn.innerText = "应用并同步到云端";

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
            
            // Task 4.3: 专家模式配额校验
            if (parsed.categories.length > 20) throw new Error("分类数量超出上限 (20)");
            for (const cat of parsed.categories) {
                const count = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
                if (count > 100) throw new Error(`分类 [${cat.name}] 下的书签数量 (${count}) 超出上限 (100)`);
            }

            appData = parsed;
            showLoader('正在同步专家配置...');
            await syncConfigToCloud();
            renderNav();
            modal.style.display = 'none';
        } catch (e) {
            showToast(`JSON 格式错误: ${e.message}`, "#e74c3c");
        } finally {
            hideLoader();
        }
    };
};

const exportConfig = () => {
    const date = new Date();
    const filename = `CloudNav_Config_${date.getMonth() + 1}${date.getDate()}.json`;
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("配置文件导出成功");
};

const initGlobalEvents = () => {
    // 快捷导航按钮逻辑 (Task 4.2)
    const fabToTop = document.getElementById('scroll-to-top');
    const fabToBottom = document.getElementById('scroll-to-bottom');
    const fabGroup = document.getElementById('quick-nav-group');
    let fabTimer = null;

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
        }, { passive: true });
    }

    // 监听文件导入
    const importInput = document.getElementById('import-file');
    if (importInput) {
        importInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (!parsed.categories || !parsed.items) throw new Error("非法的 CloudNav 配置格式");
                    
                    // Task 4.3: 导入配额校验
                    if (parsed.categories.length > 20) throw new Error("分类数量超出上限 (20)");
                    for (const cat of parsed.categories) {
                        const count = parsed.items.filter(i => (i.catId === cat.id || i.cat_id === cat.id)).length;
                        if (count > 100) throw new Error(`分类 [${cat.name}] 下的书签数量 (${count}) 超出上限 (100)`);
                    }

                    if (!confirm("导入将覆盖当前所有配置，确定继续吗？")) return;
                    
                    appData = parsed;
                    showLoader('正在导入并同步...');
                    await syncConfigToCloud();
                    renderNav();
                    showToast("导入成功");
                } catch (err) {
                    showToast(`导入失败: ${err.message}`, "#e74c3c");
                } finally {
                    hideLoader();
                    importInput.value = ''; // 清空以支持重复导入
                }
            };
            reader.readAsText(file);
        };
    }

    // 1. 全场景沉浸唤醒监听 (Task 2.5.1 - 增强版)
    window.addEventListener('wheel', (e) => {
        if (isActuallyZen && e.deltaY > 10) {
            isZenTempExpanded = true;
            renderNav();
        }
    }, { passive: true });

    // 移动端手势唤醒 (Task 5.2: Gesture Engine)
    let touchStartX = 0;
    window.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // 1. Zen Mode 上滑唤醒 (已有逻辑增强)
        if (isActuallyZen && touchStartY - touchEndY > 50 && Math.abs(deltaX) < 30) {
            isZenTempExpanded = true;
            renderNav();
        }

        // 2. 侧边栏侧滑逻辑 (Mobile Layout Only)
        if (window.innerWidth < 768) {
            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar?.classList.contains('open');

            if (!isOpen && touchStartX < 30 && deltaX > 60) {
                // 从边缘向右滑 -> 唤起
                toggleSidebar(true);
            } else if (isOpen && deltaX < -60) {
                // 开启状态下向左滑 -> 隐藏
                toggleSidebar(false);
            }
        }
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (isActuallyZen) {
            // 排除交互元素，仅背景触发 (Task 2.5.1 优化)
            if (!e.target.closest('.card, .sidebar, .modal, .sidebar-toggle, .search-wrapper')) {
                isZenTempExpanded = true;
                renderNav();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        const focusedCard = document.activeElement.closest('.card');
        
        // 2. 全键盘磁贴流转算法 (Task 2.5.3 - 动态适配)
        if (!isInput && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const cards = Array.from(document.querySelectorAll('.grid-container .card:not(.hidden-item)'));
            if (cards.length === 0) return;

            e.preventDefault();
            
            if (!focusedCard) {
                cards[0].focus();
                return;
            }

            const currentIndex = cards.indexOf(focusedCard);
            let nextIndex = currentIndex;

            // 获取网格列数 (根据实际渲染样式动态计算)
            const grid = focusedCard.closest('.nav-grid');
            let columns = 1;
            if (grid) {
                const computed = window.getComputedStyle(grid).gridTemplateColumns;
                columns = computed.split(' ').length;
            }

            switch (e.key) {
                case 'ArrowRight': nextIndex = Math.min(currentIndex + 1, cards.length - 1); break;
                case 'ArrowLeft': nextIndex = Math.max(currentIndex - 1, 0); break;
                case 'ArrowDown': nextIndex = Math.min(currentIndex + columns, cards.length - 1); break;
                case 'ArrowUp': nextIndex = Math.max(currentIndex - columns, 0); break;
            }

            if (cards[nextIndex]) {
                cards[nextIndex].focus();
                // 确保聚焦磁贴在视界中心 (Task 2.5.3 优化)
                cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // 3. Ctrl+B 切换侧边栏 (逃生通道)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            if (appData.settings?.zenMode && !isZenTempExpanded) {
                isZenTempExpanded = true;
                renderNav();
                setTimeout(() => toggleSidebar(true), 100);
            } else {
                toggleSidebar();
            }
            return;
        }

        // 4. 键入即唤醒 (Task 2.2)
        if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const sea = document.getElementById('sea-input');
            if (sea) {
                sea.focus();
                // 浏览器会自动将当前按下的键填入刚聚焦的 input
            }
        }

        // 5. Alt + L 唤起登录
        if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            document.getElementById('auth-overlay').style.display = 'flex';
            setTimeout(() => document.getElementById('auth-username')?.focus(), 100);
            return;
        }

        // 6. Ctrl+K 快速聚焦
        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const sea = document.getElementById('sea-input');
            if (sea) {
                sea.value = '';
                sea.focus();
            }
            return;
        }

        // 7. 页面滚动快捷键 (Task 4.2)
        if (!isInput) {
            if (e.key === 'Home') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            if (e.key === 'End') {
                e.preventDefault();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        }

        // 8. Escape 一键复位 (Task 2.2)
        if (e.key === 'Escape') { 
            const sea = document.getElementById('sea-input');
            const dropdown = document.getElementById('sea-dropdown');

            const modals = document.querySelectorAll('.modal');
            let anyModalOpen = false;
            modals.forEach(m => {
                if (window.getComputedStyle(m).display !== 'none') {
                    m.style.display = 'none';
                    anyModalOpen = true;
                }
            });

            if (anyModalOpen) return;

            // 如果侧边栏打开，优先关闭
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                toggleSidebar(false);
                return;
            }

            // 如果是在展开态，回归极简态
            if (isZenTempExpanded) {
                isZenTempExpanded = false;
                renderNav();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (sea) {
                sea.value = '';
                sea.focus(); // 回归搜索聚焦状态
                if (dropdown) dropdown.style.display = 'none';
                document.body.classList.remove('is-searching'); 
            }
        }
    });
};

// ==================== 7. Task 3.2: 魔法棒与编辑逻辑 ====================

const openEditModal = (id) => {
    const item = appData.items.find(i => i.id === id) || { id: '', title: '', url: '', icon: '', desc: '', cat_id: activeCatId };
    const modal = document.getElementById('edit-modal');
    const body = document.getElementById('edit-form-body');
    if (!modal || !body) return;

    modal.setAttribute('data-editing-id', id);
    document.getElementById('edit-title').innerText = id ? '编辑书签' : '添加新书签';

    body.innerHTML = `
        <div class="form-row">
            <label><i class="ri-link"></i> 网址</label>
            <div style="display:flex; gap:8px; width:100%">
                <input type="text" id="edit-url" value="${item.url}" placeholder="https://...">
                <button id="btn-magic-wand" class="icon-btn-action" title="魔法棒自动抓取" onclick="triggerMagicWand()">
                    <i class="ri-magic-line"></i>
                </button>
            </div>
        </div>
        <div class="form-row">
            <label><i class="ri-font-size"></i> 标题</label>
            <input type="text" id="edit-title-input" value="${item.title}" placeholder="网站名称">
        </div>
        <div class="form-row">
            <label><i class="ri-image-line"></i> 图标</label>
            <div style="display:flex; gap:8px; width:100%; align-items:center;">
                <input type="text" id="edit-icon" value="${item.icon}" placeholder="Emoji 或 图片 URL">
                <div id="edit-icon-preview" class="preview-container">
                    ${item.icon?.startsWith('http') ? `<img src="${item.icon}">` : `<span>${item.icon || '🔗'}</span>`}
                </div>
            </div>
        </div>
        <div class="form-row">
            <label><i class="ri-text-snippet"></i> 描述</label>
            <textarea id="edit-desc" rows="2" placeholder="可选描述" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:8px;">${item.desc || ''}</textarea>
        </div>
        <div class="form-row">
            <label><i class="ri-folders-line"></i> 分类</label>
            <select id="edit-cat">
                ${appData.categories.map(c => `<option value="${c.id}" ${c.id === (item.cat_id || item.catId) ? 'selected' : ''}>${c.name}</option>`).join('')}
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

    modal.style.display = 'flex';
};

const triggerMagicWand = async () => {
    const url = document.getElementById('edit-url').value.trim();
    if (!url) return showToast("请先输入网址", "#e67e22");
    if (!url.startsWith('http')) return showToast("请输入完整的 http(s) 网址", "#e67e22");

    const btn = document.getElementById('btn-magic-wand');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetch(`/api/proxy/fetch-metadata?url=${encodeURIComponent(url)}`, {
            headers: { 'Authorization': sysToken }
        });
        const result = await res.json();

        if (result.success) {
            const { title, desc, icon } = result.data;
            const titleInput = document.getElementById('edit-title-input');
            const descInput = document.getElementById('edit-desc');
            const iconInput = document.getElementById('edit-icon');

            if (!titleInput.value) titleInput.value = title;
            if (!descInput.value) descInput.value = desc;
            if (!iconInput.value) {
                iconInput.value = icon;
                iconInput.dispatchEvent(new Event('input'));
            }
            showToast("魔法填充成功！");
        } else {
            showToast(result.error || "抓取失败", "#e74c3c");
        }
    } catch (e) {
        showToast("请求服务失败", "#e74c3c");
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
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
    const targetCatItems = appData.items.filter(i => (i.catId === payload.catId || i.cat_id === payload.catId) && i.id !== id);
    if (targetCatItems.length >= 100) {
        return showToast("目标分类已满 (上限 100 个书签)", "#e74c3c");
    }

    showLoader('正在保存...');
    try {
        // 关键修复：直接在本地内存中先执行更新，确保 renderNav 能立即看到
        const newItems = [...appData.items];
        if (id) {
            const idx = newItems.findIndex(i => i.id === id);
            newItems[idx] = { ...newItems[idx], ...payload };
        } else {
            newItems.push(payload);
        }

        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 
                'Authorization': sysToken,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ ...appData, items: newItems })
        });

        if (res.ok) {
            showToast("保存成功");
            modal.style.display = 'none';
            appData.items = newItems; // 同步内存
            renderNav(); // 立即渲染
            await init(true); // 后台执行完整初始化
        } else {
            showToast("保存失败", "#e74c3c");
        }
    } catch (e) {
        showToast("请求失败", "#e74c3c");
    } finally {
        hideLoader();
    }
};
