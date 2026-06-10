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
const CACHE_NAME = 'nav-core-v8';
const ICON_CACHE_NAME = 'nav-icons-v2';
const MAX_ICON_CACHE_ITEMS = 150; // 图标缓存自限容量

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

// 需要缓存的核心静态资源
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/utils.js',
  '/assets/js/app.js',
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
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
              // 触发异步修剪，不阻塞加载
              trimCache(ICON_CACHE_NAME, MAX_ICON_CACHE_ITEMS);
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 1. 对于 HTML 页面请求，采用 Network First (网络优先)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
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
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});