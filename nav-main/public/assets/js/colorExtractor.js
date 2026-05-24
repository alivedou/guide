/**
 * ==========================================
 * colorExtractor.js - 图标主色提取工具 v2
 * 用于 Style 2：从网址图标提取主色 RGB，
 * 并生成与图标色相近的毛玻璃背景
 *
 * 特性：
 * - 优先使用 Canvas + CORS 提取
 * - CORS 失败时降级到 ColorThief API
 * - 持久化追踪已提取的图标 URL，重建 DOM 后自动恢复颜色
 * ==========================================
 */
(function () {
    // 持久化追踪已提取颜色的图标 URL（跨 DOM 重建持久）
    const extractedUrls = new Set();

    // 提取主色 RGB（从 <img> 元素）
    function extractDominantColor(imgEl) {
        try {
            const canvas = document.createElement('canvas');
            const size = 32;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgEl, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;

            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

                // 忽略透明像素
                if (a < 80) continue;

                // 忽略接近白色
                const brightness = (r + g + b) / 3;
                if (brightness > 230) continue;

                // 忽略接近黑色
                if (brightness < 25) continue;

                // 忽略饱和度过低的灰色
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const saturation = max === 0 ? 0 : (max - min) / max;
                if (saturation < 0.12) continue;

                rSum += r;
                gSum += g;
                bSum += b;
                count++;
            }

            if (count === 0) return null;
            return [
                Math.round(rSum / count),
                Math.round(gSum / count),
                Math.round(bSum / count)
            ];
        } catch (e) {
            return null;
        }
    }

    // 通过 ColorThief API 提取颜色（降级方案，无需 CORS）
    function extractColorViaAPI(imgUrl) {
        return new Promise(function (resolve) {
            // ColorThief API: https://api.colorthief.fns.design/
            const apiUrl = `https://api.colorthief.fns.design/color?image=${encodeURIComponent(imgUrl)}`;
            fetch(apiUrl)
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data && data.r !== undefined) {
                        resolve([data.r, data.g, data.b]);
                    } else {
                        resolve(null);
                    }
                })
                .catch(function () { resolve(null); });
        });
    }

    // 加载图片（优先尝试 CORS 模式）
    function loadImage(src) {
        return new Promise(function (resolve) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.crossOrigin = 'anonymous';
            img.src = src;
        });
    }

    /**
     * 提取图标颜色（异步）
     * iconUrl: 完整的图标 URL
     * callback: function([r,g,b]) 或 null
     */
    function getIconColor(iconUrl, callback) {
        if (!iconUrl) { callback(null); return; }

        // 缓存 key（基于原始 URL）
        const cacheKey = 'icon_color_' + btoa(unescape(encodeURIComponent(iconUrl))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);

        // 先查 sessionStorage 缓存
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                callback(JSON.parse(cached));
                return;
            }
        } catch (e) { }

        // 异步加载图片并提取颜色
        loadImage(iconUrl).then(function (img) {
            if (!img) {
                // 图片加载失败，尝试 API 降级
                extractColorViaAPI(iconUrl).then(function (color) {
                    if (color) {
                        try { sessionStorage.setItem(cacheKey, JSON.stringify(color)); } catch (e) { }
                        extractedUrls.add(iconUrl);
                    }
                    callback(color);
                });
                return;
            }

            const color = extractDominantColor(img);
            if (color) {
                try { sessionStorage.setItem(cacheKey, JSON.stringify(color)); } catch (e) { }
                extractedUrls.add(iconUrl);
                callback(color);
            } else {
                // Canvas 提取失败（可能是 tainted canvas），尝试 API 降级
                extractColorViaAPI(iconUrl).then(function (apiColor) {
                    if (apiColor) {
                        try { sessionStorage.setItem(cacheKey, JSON.stringify(apiColor)); } catch (e) { }
                        extractedUrls.add(iconUrl);
                    }
                    callback(apiColor);
                });
            }
        });
    }

    /**
     * 批量为 Style 2 的卡片应用颜色
     * 找到所有 .card[data-icon-url] 元素，提取其图标颜色并注入 CSS 变量
     */
    function applyIconColorsToCards() {
        const cards = document.querySelectorAll('.card[data-icon-url]');
        if (!cards.length) return;

        cards.forEach(function (card) {
            const iconUrl = card.getAttribute('data-icon-url');
            if (!iconUrl) return;

            // 跳过已添加过颜色的卡片（支持 DOM 重建后自动恢复）
            if (card.classList.contains('has-color')) return;

            // 从 sessionStorage 快速恢复颜色
            const cacheKey = 'icon_color_' + btoa(unescape(encodeURIComponent(iconUrl))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const color = JSON.parse(cached);
                    applyColorToCard(card, color[0], color[1], color[2]);
                    extractedUrls.add(iconUrl);
                    return;
                }
            } catch (e) { }

            // 异步提取颜色
            getIconColor(iconUrl, function (color) {
                if (color) {
                    applyColorToCard(card, color[0], color[1], color[2]);
                }
            });
        });
    }

    function applyColorToCard(card, r, g, b) {
        card.style.setProperty('--card-bg-r', r);
        card.style.setProperty('--card-bg-g', g);
        card.style.setProperty('--card-bg-b', b);
        card.classList.add('has-color');
    }

    // 暴露到全局
    window.colorExtractor = {
        applyIconColorsToCards: applyIconColorsToCards,
        getIconColor: getIconColor,
        extractDominantColor: extractDominantColor,
        applyColorToCard: applyColorToCard,
        extractedUrls: extractedUrls
    };
})();
