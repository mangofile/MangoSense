/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: INTEGRATED_PWA_COI_CORE_2026
 * 整合了 COI 隔离解锁 与 PWA 离线缓存
 */

const CACHE_NAME = 'mango-v4-cache';
const ASSETS = [
    './',
    './index.html',
    './ass/css/style.css',
    './ass/js/MangoSense.js',
    './ass/js/MangoSense.Worker.js',
    './manifest.json',
    './coi-serviceworker.js'
];

// --- 1. PWA 离线缓存逻辑 ---
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// --- 2. 核心拦截逻辑：整合隔离 Header + 离线缓存 ---
self.addEventListener('fetch', (event) => {
    const r = event.request;

    // 针对 AI 模型 CDN 的处理：直接透传，不干预
    if (r.url.includes('jsdelivr.net') || r.url.includes('esm.sh')) {
        return; 
    }

    event.respondWith(
        fetch(r).then((response) => {
            // 如果是第三方脚本且 status 为 0，直接返回
            if (response.status === 0) return response;

            // --- 关键：为所有请求注入跨域隔离 Header ---
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }).catch(async () => {
            // 离线时尝试回退到缓存
            return await caches.match(r);
        })
    );
});


