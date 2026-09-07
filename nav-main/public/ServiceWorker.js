/**
 * @fileoverview 
 * @author adou
 * @copyright Copyright (c) 2026 adou. All rights reserved.
 * @license MIT
 * @disclaimer 免责声明：本软件及相关代码仅用于学术研究与个人学习，作者不对因使用本软件产生的任何直接或间接损失承担责任。
 */

/**
 * ==========================================
 * ServiceWorker.js - PWA 核心脚本
 * 实现 Stale-While-Revalidate 缓存策略
 * ==========================================
 */

// 缓存版本号
const CACHE_NAME = 'nav-core-v18';
const ICON_CACHE_NAME = 'nav-icons-v2'; // cache version
const MAX_ICON_CACHE_ITEMS = 150; // 图标缓存自限容量

// 处理外部消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'clearIconCache') {
    caches.delete(ICON_CACHE_NAME).then(() => {
      console.log('[ServiceWorker] Icon cache cleared.');
    });
  }
});

// 安全限制缓存条数，避免无限膨胀
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => {
          trimCache(cacheName, maxItems);
        });
      }
    });
  });
}

// 生成 1x1 像素透明 GIF 响应以静默处理 favicon 404
function getTransparent1x1() {
  const transparentBytes = new Uint8Array([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0,
    255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0,
    1, 0, 1, 0, 0, 2, 2, 76, 1, 0, 59
  ]);
  return new Response(transparentBytes, {
    headers: { 'Content-Type': 'image/gif' }
  });
}

// 需要缓存的核心静态资源
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/tokens.css',
  '/assets/css/layout.css',
  '/assets/css/sidebar.css',
  '/assets/css/cards.css',
  '/assets/css/modals.css',
  '/assets/css/responsive.css',
  '/assets/css/search.css',
  '/assets/css/admin.css',
  '/assets/js/utils.js',
  '/assets/js/main.js',
  'https://lib.baomitu.com/remixicon/3.5.0/remixicon.css',
  'https://lib.baomitu.com/Sortable/1.15.0/Sortable.min.js'
];

/**
 * 安装事件
 */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

/**
 * 激活事件
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== ICON_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * 请求拦截事件
 */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API 请求不走 SW 缓存
  if (url.pathname.startsWith('/api/')) return;

  // 图标请求特殊处理 (Cache First)
  const isIconApi = [
    'api.iowen.cn', 
    'www.google.com', 
    'icons.duckduckgo.com',
    'favicon.ico'
  ].some(domain => url.href.includes(domain));

  if (isIconApi) {
    event.respondWith(
      caches.open(ICON_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) return response;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.ok || networkResponse.status === 200 || networkResponse.type === 'opaque') {
              const responseToCache = networkResponse.clone();
              cache.put(event.request, responseToCache);
              // 触发异步修剪，不阻塞加载
              trimCache(ICON_CACHE_NAME, MAX_ICON_CACHE_ITEMS);
              return networkResponse;
            } else {
              const fallbackResponse = getTransparent1x1();
              cache.put(event.request, fallbackResponse.clone());
              return fallbackResponse;
            }
          }).catch(err => {
            console.warn('[ServiceWorker] Icon fetch failed:', err);
            const fallbackResponse = getTransparent1x1();
            cache.put(event.request, fallbackResponse.clone());
            return fallbackResponse;
          });
        });
      })
    );
    return;
  }

  // 1. 对于 HTML 页面请求，采用 Network First (网络优先)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        const responseToCache = networkResponse.clone();
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
          return networkResponse;
        });
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. 静态资源采用 Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});