const CACHE_NAME = 'mango-sense-v4';
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

self.addEventListener('fetch', (e) => {
    // 允许外部 CDN 资源正常通过，不强制在 ASSETS 列表里下载
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});

