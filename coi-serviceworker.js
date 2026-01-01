/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// MECIS V4.0 PRO 2026 路径兼容补丁版
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) return;
        if (ev.data.type === "deregister") {
            self.registration.unregister().then(() => self.clients.matchAll()).then(clients => {
                clients.forEach((client) => client.navigate(client.url));
            });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;

        const request = (coepCredentialless && r.mode === "no-cors")
            ? new Request(r, { credentials: "omit" })
            : r;

        event.respondWith(
            fetch(request).then((response) => {
                if (response.status === 0) return response;
                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
                if (!coepCredentialless) newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            }).catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const n = navigator;
        const coi = {
            doReload: () => {
                window.sessionStorage.setItem("coiReloadedBySelf", "true");
                window.location.reload();
            },
            quiet: false,
            ...window.coi
        };

        if (window.crossOriginIsolated) return;

        // 【2026路径增强】自动识别 GitHub Pages 二级目录
        const scriptSrc = document.currentScript ? document.currentScript.src : window.location.pathname + 'coi-serviceworker.js';

        if (n.serviceWorker) {
            n.serviceWorker.register(scriptSrc, { scope: "./" }).then((registration) => {
                !coi.quiet && console.log("MECIS_COI: 注册成功，Scope:", registration.scope);

                // 强制新版本立刻上位
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated') coi.doReload();
                    });
                });

                if (registration.active && !n.serviceWorker.controller) {
                    !coi.quiet && console.log("MECIS_COI: 环境锁定中，正在激活隔离...");
                    coi.doReload();
                }
            });
        }
    })();
}
