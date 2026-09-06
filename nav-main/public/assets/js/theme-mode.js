/**
 * theme-mode.js
 * 主题模式模块 (Theme Mode Module)
 * 负责侧边栏明亮模式、暗黑模式与系统跟随的切换及状态保存。
 */

// 使用 Object.defineProperty 代理，确保所有对全局变量 themeMode 的读写在任何模块都完全透传
Object.defineProperty(window, 'themeMode', {
    get() {
        return window._themeMode || 'auto';
    },
    set(val) {
        window._themeMode = val;
    },
    configurable: true
});

// 初始化内部状态
window._themeMode = localStorage.getItem('nav_theme_mode') || 'auto';

// 提取稳定的主题更新函数
window.applyThemeUpdate = () => {
    const isDark = window.themeMode === 'dark' || (window.themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = isDark ? '#111111' : '#f0f3f8';
    }
};

// 监听系统主题变化 (全局监听一次即可)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (window.themeMode === 'auto') window.applyThemeUpdate();
});

window.setThemeMode = (mode) => {
    window.themeMode = mode;
    localStorage.setItem('nav_theme_mode', mode);

    window.applyThemeUpdate(); // 立即应用

    // 同步 UI
    if (typeof window.renderTools === 'function') {
        window.renderTools();
    } else if (typeof renderTools === 'function') {
        renderTools();
    }
};

window.toggleThemeMode = () => {
    const modes = ['auto', 'light', 'dark'];
    let index = modes.indexOf(window.themeMode);
    if (index === -1) index = 0;
    const nextMode = modes[(index + 1) % modes.length];

    window.setThemeMode(nextMode);

    const modeNames = { 'auto': '跟随系统', 'light': '明亮模式', 'dark': '暗黑模式' };
    if (typeof window.showToast === 'function') {
        window.showToast(`主题已切换为: ${modeNames[nextMode]}`, "#3498db");
    } else if (typeof showToast === 'function') {
        showToast(`主题已切换为: ${modeNames[nextMode]}`, "#3498db");
    }
};

window.initThemeMode = () => {
    window.applyThemeUpdate();
};
