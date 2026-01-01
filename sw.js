// sw.js - V4.0 兼容性版本
const CACHE_NAME = 'mango-v4-cache';
const ASSETS = [
    './',
    'index.html',
    'ass/css/style.css',
    'ass/js/MangoSense.js',
    'ass/js/MangoSense.Worker.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// 关键修正：不再拦截外部 CDN 的 fetch，让浏览器直接处理
self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('jsdelivr.net')) {
        return; // 直接跳过，不干预 AI 模型加载
    }
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});

