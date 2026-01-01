const CACHE_NAME = 'mango-sense-v4-core';
// 2026 核心缓存列表
const ASSETS = [
    './',
    'index.html',
    './ass/css/style.css',
    './ass/js/MangoSense.js',
    './ass/images/web_Logo.png',
    'cdn.jsdelivr.net'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // 策略：缓存优先，模型文件由 Transformers.js 内部 Cache API 管理
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});

