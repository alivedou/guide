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
    const h = JSON.parse(localStorage.getItem('nav_clicks_history') || '{}');
    const now = Date.now();
    const counts = {};
    Object.keys(h).forEach(id => {
        if (!Array.isArray(h[id])) return;
        const valid = h[id].filter(ts => (now - ts) < 7*24*3600*1000);
        if (valid.length >= 10) counts[id] = valid.length;
    });
    return counts;
};

const recordClick = (id) => {
    let h = JSON.parse(localStorage.getItem('nav_clicks_history') || '{}');
    if (!h[id]) h[id] = [];
    h[id].push(Date.now());
    localStorage.setItem('nav_clicks_history', JSON.stringify(h));
};

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
        const res = await fetch('/api/config', {
            headers: sysToken ? { 'Authorization': sysToken } : {}
        });
        if (res.ok) {
            appData = await res.json();
            isAdmin = appData.isAdmin;
            localStorage.setItem('nav_app_data', JSON.stringify(appData));
            renderNav();
            renderTools();
            updateStyles();
        }
        toggleSkeleton(false);
    } catch (e) { 
        toggleSkeleton(false);
        renderTools();
    }
};

// ==================== 5. 渲染逻辑 ====================
const buildCardHtml = (i) => {
    const target = appData.settings?.openInNewTab ? '_blank' : '_self';
    const icon = i.icon && i.icon.startsWith('http') ? `<img src="${i.icon}" onerror="this.src='/favicon.ico'">` : `<span class="emoji-icon">${i.icon || '🔗'}</span>`;
    return `<a href="${i.url}" target="${target}"><div class="icon-wrapper">${icon}</div><h3>${i.title}</h3></a>`;
};

const renderNav = () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const container = document.getElementById('grid-container');
    if (!sidebarNav || !container) return;

    const clickData = getFrequentItemsData();
    const freqIds = Object.keys(clickData).filter(id => clickData[id] >= 10);

    sidebarNav.innerHTML = '';
    container.innerHTML = '';

    let cats = isAdmin ? [...appData.categories] : appData.categories.filter(c => !c.hidden);
    if (freqIds.length > 0 && appData.settings?.showFrequent !== false) {
        cats.unshift({ id: 'VIRTUAL_FREQ', name: '常去网站', icon: '⭐' });
    }

    cats.forEach(cat => {
        const navItem = document.createElement('div');
        navItem.className = `sidebar-nav-item ${activeCatId === cat.id ? 'active' : ''}`;
        navItem.innerHTML = `<span class="nav-icon">${cat.icon}</span><span class="nav-label">${cat.name}</span>`;
        navItem.onclick = () => {
            activeCatId = cat.id;
            if (appData.settings?.zenMode) { isZenTempExpanded = true; renderNav(); }
            else { document.getElementById('section-' + cat.id)?.scrollIntoView({ behavior: 'smooth' }); }
        };
        sidebarNav.appendChild(navItem);

        if (appData.settings?.zenMode && isZenTempExpanded && cat.id !== activeCatId) return;

        const section = document.createElement('div');
        section.className = 'category-section';
        section.id = 'section-' + cat.id;
        section.innerHTML = `<div class="category-section-title">${cat.icon} ${cat.name}</div>`;

        const grid = document.createElement('div');
        grid.className = 'nav-grid';
        const items = (cat.id === 'VIRTUAL_FREQ') ? appData.items.filter(i => freqIds.includes(i.id)) : appData.items.filter(i => i.catId === cat.id && (isAdmin || !i.hidden));
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `card ${item.hidden ? 'hidden-item' : ''}`;
            card.innerHTML = buildCardHtml(item);
            card.onclick = () => recordClick(item.id);
            grid.appendChild(card);
        });
        section.appendChild(grid);
        container.appendChild(section);
    });

    const isActuallyZen = appData.settings?.zenMode && !isZenTempExpanded;
    document.body.classList.toggle('zen-active', isActuallyZen);
    document.getElementById('zen-expand-btn').style.display = isActuallyZen ? 'flex' : 'none';
};

const renderTools = () => {
    const area = document.getElementById('sidebar-admin-actions');
    if (!area) return;
    area.innerHTML = isAdmin 
        ? `<div class="sidebar-nav-item" onclick="showToast('设置开发中...')"><i class="ri-settings-3-line"></i> 偏好设置</div>
           <div class="sidebar-nav-item" onclick="doLogout()"><i class="ri-logout-box-r-line"></i> 退出登录</div>`
        : `<div class="sidebar-nav-item" onclick="document.getElementById('auth-overlay').style.display='flex'"><i class="ri-user-line"></i> 登录/注册</div>`;
};

// ==================== 6. 其他初始化 ====================
const initThemeMode = () => {
    document.body.classList.toggle('dark-theme', themeMode === 'dark');
    document.body.classList.toggle('light-theme', themeMode === 'light');
};

const initSidebar = () => {
    const t = document.getElementById('sidebar-toggle');
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (t) t.onclick = () => { s.classList.toggle('open'); o.classList.toggle('visible'); };
    if (o) o.onclick = () => { s.classList.remove('open'); o.classList.remove('visible'); };
};

const initZenMode = () => {
    document.getElementById('zen-expand-btn').onclick = () => { isZenTempExpanded = true; renderNav(); };
};

const initSearch = () => {
    const sea = document.getElementById('sea-input');
    if (sea) sea.onkeydown = (e) => {
        if (e.key === 'Enter') window.open(currentEnginePrefix + encodeURIComponent(sea.value), '_blank');
    };
};

const initGlobalEvents = () => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { 
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            if (isZenTempExpanded) { isZenTempExpanded = false; renderNav(); }
        }
    });
};
