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
    initThemeMode();
    initSidebar();
    initZenMode();
    init();
    initSearch();
    initAuthUI();
    initGlobalEvents();
});

// ==================== 2. 辅助工具 ====================
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

        if (res.ok) {
            console.log('[Sync] Cloud sync successful');
            syncRetryCount = 0;
        } else {
            throw new Error('Sync failed');
        }
    } catch (e) {
        syncRetryCount++;
        const delay = Math.min(Math.pow(2, syncRetryCount) * 1000, 60000); // 指数退避
        console.warn(`[Sync] Retrying in ${delay/1000}s...`, e);
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncClicksToCloud, delay);
    }
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
    const u = userEl.value.trim();
    const p = passEl.value.trim();

    if (!u || !p) {
        showToast("请填写完整信息", "#e67e22");
        return;
    }

    console.log('Registering user:', u);
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        
        const data = await res.json();
        console.log('Register response:', data);

        if (res.ok && data.success) {
            showToast("注册成功！即将切换到登录", "#2ecc71");
            setTimeout(() => {
                const loginTab = document.getElementById('tab-login');
                if (loginTab) loginTab.click();
                passEl.value = ''; // 清空密码框
            }, 1000);
        } else {
            showToast(data.error || "注册失败，请换个用户名试试", "#e74c3c");
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
        ? `<img src="${i.icon}" loading="lazy" onerror="this.onerror=null;this.src='/favicon.ico'">` 
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

        // 导航视界定义：自动校正过期的或无效的 activeCatId (Task 2.1 深度自愈)
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
                    // 切换分类时自动回到视界顶部
                    window.scrollTo({ top: 350, behavior: 'smooth' });
                }
                else { 
                    document.getElementById('section-' + cat.id)?.scrollIntoView({ behavior: 'smooth' }); 
                }
            };
            sidebarNav.appendChild(navItem);

            // Zen Mode 核心逻辑：遵循单一视图原则 (Task 2.1 规范化)
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
                card.innerHTML = buildCardHtml(item);
                
                card.onclick = () => recordClick(item.id);
                
                // 键盘激活支持
                card.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        recordClick(item.id);
                        window.open(item.url, appData.settings?.openInNewTab ? '_blank' : '_self');
                    }
                };
                
                grid.appendChild(card);
            });
            section.appendChild(grid);
            container.appendChild(section);
        });

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
    if (!area) return;
    
    // 如果已登录
    if (sysToken) {
        const userDisplayName = appData.username || '已登录用户';
        const roleBadge = isAdmin ? '<span class="admin-badge">ADMIN</span>' : '';
        
        area.innerHTML = `
            <div class="sidebar-user-card">
                <div class="user-info">
                    <span class="user-name">${userDisplayName}</span>
                    ${roleBadge}
                </div>
                <div class="user-actions">
                    <button class="icon-btn" onclick="showToast('偏好设置即将上线')" title="设置"><i class="ri-settings-3-line"></i></button>
                    <button class="icon-btn" onclick="doResetConfig()" title="恢复默认配置"><i class="ri-refresh-line"></i></button>
                    <button class="icon-btn" onclick="doLogout()" title="退出登录"><i class="ri-logout-box-r-line"></i></button>
                </div>
            </div>
        `;
    } else {
        area.innerHTML = `
            <div class="sidebar-nav-item" onclick="document.getElementById('auth-overlay').style.display='flex'">
                <i class="ri-user-line"></i> <span>登录 / 注册</span>
            </div>
        `;
    }
};

// ==================== 6. 其他初始化 ====================
const initThemeMode = () => {
    document.body.classList.toggle('dark-theme', themeMode === 'dark');
    document.body.classList.toggle('light-theme', themeMode === 'light');
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
                        <span class="result-icon">${m.icon?.startsWith('http') ? `<img src="${m.icon}">` : (m.icon || '🔗')}</span>
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

const initGlobalEvents = () => {
    // 1. 全场景沉浸唤醒监听 (Task 2.5.1 - 增强版)
    window.addEventListener('wheel', (e) => {
        if (isActuallyZen && e.deltaY > 10) {
            isZenTempExpanded = true;
            renderNav();
        }
    }, { passive: true });

    // 移动端手势唤醒
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        if (isActuallyZen && touchStartY - touchEndY > 50) { // 上滑 50px
            isZenTempExpanded = true;
            renderNav();
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

        // 8. Escape 一键复位
        if (e.key === 'Escape') { 
            const sea = document.getElementById('sea-input');
            if (sea) {
                sea.value = '';
                sea.blur();
                document.body.classList.remove('is-searching'); // 退出搜索态
            }

            const modals = document.querySelectorAll('.modal');
            let anyModalOpen = false;
            modals.forEach(m => {
                if (window.getComputedStyle(m).display !== 'none') {
                    m.style.display = 'none';
                    anyModalOpen = true;
                }
            });

            if (anyModalOpen) return;

            if (isZenTempExpanded) { 
                isZenTempExpanded = false; 
                renderNav(); 
                toggleSidebar(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });
};
