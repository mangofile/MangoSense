// sw.js - MECIS V4.0 2026 统一控制中心
const CACHE_NAME = 'mango-v4-final';
const ASSETS = [
    './',
    './index.html',
    './ass/css/style.css',
    './ass/js/MangoSense.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    // 允许 AI 模型 CDN 穿透
    if (url.includes('jsdelivr.net') || url.includes('esm.sh')) return;

    e.respondWith(
        fetch(e.request).then(response => {
            if (response.status === 0) return response;
            // 2026 强制注入隔离 Header，解锁 SharedArrayBuffer
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }).catch(() => caches.match(e.request))
    );
});
