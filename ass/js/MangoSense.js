/**
 * PROTOCOL_RECOVERY_KEY::MECIS_V4.0_FINAL_INTEGRATED
 * STATUS: LOGIC_FIXED_STABLE
 * VERSION: V4.0-AI-READY
 * 2026-PRODUCTION
 */

(function() {
    // --- 1. 动态物理隔离逻辑 ---
    window.getFileName = () => {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    };

    window.getSafeDBName = () => {
        const safeName = window.getFileName().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return `MangoDB_V4_${safeName}`; 
    };

    window.DB_NAME = window.getSafeDBName(); 
    window.DB_VERSION = 1;
    window.STORE_QA = "QA_COLLECTION";
    window.STORE_QUICK = "QUICK_REPLIES";
    window.DB_KEY_THEME = 'USER_THEME_PREFERENCE';
    window.DB_KEY_INIT = 'MECIS_QUICK_INIT_DONE'; // 常用语初始化标记

    window.db = null;
    window.qaData = []; 
    window.quickReplies = [];
    window.aiWorker = null;
    window.isAiReady = false;

    // --- 2. 异步数据库驱动 ---
    window.initDB = async function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(window.DB_NAME, window.DB_VERSION);
            request.onupgradeneeded = (e) => {
                const _db = e.target.result;
                if (!_db.objectStoreNames.contains(window.STORE_QA)) _db.createObjectStore(window.STORE_QA, { keyPath: "id" });
                if (!_db.objectStoreNames.contains(window.STORE_QUICK)) _db.createObjectStore(window.STORE_QUICK, { autoIncrement: true });
            };
            request.onsuccess = (e) => { window.db = e.target.result; resolve(); };
            request.onerror = () => reject("IndexedDB Error");
        });
    }

    window.IO = {
        async getAll(storeName) {
            return new Promise(res => {
                const tx = window.db.transaction(storeName, "readonly");
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => res(req.result);
            });
        },
        async put(storeName, data) {
            const tx = window.db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(data);
            return new Promise(res => tx.oncomplete = () => res());
        },
        async delete(storeName, id) {
            const tx = window.db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(id);
            return new Promise(res => tx.oncomplete = () => res());
        },
        async clear(storeName) {
            const tx = window.db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).clear();
            return new Promise(res => tx.oncomplete = () => res());
        }
    };

    // --- 3. 内存刷新逻辑 (修复清空后自动反弹问题) ---
    window.refreshMemory = async function() {
        window.qaData = await window.IO.getAll(window.STORE_QA);
        const quickRows = await window.IO.getAll(window.STORE_QUICK);
        window.quickReplies = quickRows.map(r => typeof r === 'string' ? r : r.text);
        
        // 修正逻辑：只有在库完全为空且从未初始化过时，才注入默认值
        const isInitDone = localStorage.getItem(window.DB_KEY_INIT);
        if (window.quickReplies.length === 0 && !isInitDone) {
            const defaultQuick = ['您好', '好的', '请稍后'];
            for (let t of defaultQuick) await window.IO.put(window.STORE_QUICK, {text: t});
            window.quickReplies = defaultQuick;
            localStorage.setItem(window.DB_KEY_INIT, 'true'); 
        }
    };

    // --- 4. 核心启动逻辑 (PWA 兼容与 AI 延迟启动) ---
    window.onload = async () => {
        console.log("MECIS V4.0: 正在构建环境...");
        try {
            await window.initDB();
            await window.refreshMemory();
            window.renderAll(); 

            const savedTheme = localStorage.getItem(window.DB_KEY_THEME) || 'light-theme';
            document.body.className = savedTheme;

            // 注册 PWA 离线
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js').catch(console.warn);
            }

            // 延迟启动 AI 引擎，确保 UI 线程优先处理 PWA 安装信号
            setTimeout(() => {
                window.initAiWorker();
            }, 1200);
        } catch (err) {
            console.error("启动关键错误:", err);
            window.renderAll(); 
        }
    };
    // --- 3. AI 核心：Web Worker 交互 ---
    window.initAiWorker = function() {
        const workerUrl = new URL('./MangoSense.Worker.js', import.meta.url).href;
        try {
            window.aiWorker = new Worker(workerUrl, { type: 'module' });
            window.aiWorker.postMessage({ type: 'INIT' });
            window.aiWorker.onmessage = (e) => {
                if (e.data.type === 'READY') {
                    window.isAiReady = true;
                    const tag = document.querySelector('.version-tag');
                    if(tag) tag.innerHTML = 'v4.0-AI-READY';
                    console.log("MECIS AI: 已在后台就绪");
                }
            };
        } catch (error) {
            console.error("AI Worker 启动失败:", error);
        }
    };

    window.getVector = async function(text) {
        if (!window.isAiReady) return null;
        return new Promise(res => {
            const handler = (e) => {
                if (e.data.type === 'VECTOR' && e.data.originalText === text) {
                    window.aiWorker.removeEventListener('message', handler);
                    res(e.data.vector);
                }
            };
            window.aiWorker.addEventListener('message', handler);
            window.aiWorker.postMessage({ type: 'EMBED', text });
        });
    };

    window.cosineSimilarity = function(v1, v2) {
        if (!v1 || !v2) return 0;
        const dot = v1.reduce((s, c, i) => s + c * v2[i], 0);
        const nA = Math.sqrt(v1.reduce((s, c) => s + c * c, 0));
        const nB = Math.sqrt(v2.reduce((s, c) => s + c * c, 0));
        return (nA === 0 || nB === 0) ? 0 : dot / (nA * nB);
    };

    // --- 5. 渲染与搜索引擎 (2026 增强型) ---
    window.renderMainList = async function() {
        const searchInput = document.getElementById('searchInput');
        const term = searchInput?.value.trim() || "";
        const clearBtn = document.getElementById('clearSearch');
        const container = document.getElementById('qaDisplay');
        if (!container) return;
        if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';

        let displayData = [];
        if (!term) {
            displayData = [...window.qaData].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
            if (displayData.length === 0 && window.qaData.length > 0) displayData = [...window.qaData].reverse().slice(0, 10);
        } else {
            // A. 模糊匹配逻辑
            const fuzzyResults = window.qaData.filter(item => 
                window.fuzzyMatch(item.question, term) || item.replies.some(r => window.fuzzyMatch(r, term))
            );

            // B. AI 语义引擎
            if (window.isAiReady) {
                const queryVec = await window.getVector(term);
                const semanticResults = window.qaData
                    .filter(item => item.vector)
                    .map(item => ({
                        ...item,
                        score: window.cosineSimilarity(queryVec, item.vector)
                    }))
                    .filter(item => item.score > 0.65);

                const combined = [...fuzzyResults, ...semanticResults];
                displayData = Array.from(new Map(combined.map(i => [i.id, i])).values());
                displayData.sort((a, b) => (b.score || 0) - (a.score || 0));
            } else {
                displayData = fuzzyResults.reverse();
            }
        }

        container.innerHTML = displayData.length > 0 ? displayData.map(item => `
            <div class="qa-card" style="${item.score ? `border-left: 4px solid rgba(45,92,247,${item.score})` : ''}">
                <span class="question-text">
                    问：${item.question}
                    ${item.score ? `<span class="match-score">AI 匹配 ${(item.score * 100).toFixed(0)}%</span>` : ''}
                    ${!term ? `<span style="font-size:10px; color:var(--accent-blue); float:right;">热度 ${item.clicks || 0}</span>` : ''}
                </span>
                <div class="replies-box">${item.replies.map(r => `<div class="reply-option" onclick="window.copyText('${r}', ${item.id})">${r}</div>`).join('')}</div>
                ${item.images && item.images.length > 0 ? window.renderImageSection(item.images) : ''}
            </div>`).join('') : `<div style="text-align:center; padding:40px; color:#666;">暂无匹配数据，请在配置中心添加数据</div>`;
    };

    window.saveNewQA = async function() {
        const question = document.getElementById('newQuestion').value;
        const replies = Array.from(document.querySelectorAll('.reply-val')).map(i => i.value).filter(v => v.trim() !== "");
        const imgCats = document.querySelectorAll('.img-cat-val');
        const imgFiles = document.querySelectorAll('.img-file-val');
        
        if(!question || (replies.length === 0)) return alert("请完整填写内容");

        window.showToast("AI 语义分析中...");
        
        let vector = null;
        if (window.isAiReady) vector = await window.getVector(question);

        let images = [];
        for (let i = 0; i < imgFiles.length; i++) {
            const file = imgFiles[i].files;
            if (file && file[0]) {
                const base = await new Promise(res => {
                    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file[0]);
                });
                images.push({ category: imgCats[i].value || "默认", url: base });
            }
        }

        await window.IO.put(window.STORE_QA, { id: Date.now(), question, replies, images, clicks: 0, vector });
        await window.refreshMemory();
        window.showToast("我记住了");
        
        // 重置表单
        document.getElementById('newQuestion').value = '';
        document.getElementById('replyInputs').innerHTML = `<div class="reply-input-item"><input type="text" class="reply-val" placeholder="回复话术 1"><button onclick="window.addReplyInput()" class="plus-btn">+</button></div>`;
        document.getElementById('imageInputs').innerHTML = `<div class="image-input-item"><input type="text" class="img-cat-val" placeholder="分类..."><input type="file" class="img-file-val" accept="image/*"><button onclick="window.addImageInput()" class="plus-btn">+</button></div>`;
        window.renderAll(); 
        window.renderManageLists();
    };
    // --- 6. 核心功能补全 (2026 稳定版) ---
    window.fuzzyMatch = function(str, keyword) {
        if (!str || !keyword) return false;
        str = str.toLowerCase(); keyword = keyword.toLowerCase();
        if (str.includes(keyword)) return true;
        let mistakes = 0, i = 0, j = 0;
        while (i < str.length && j < keyword.length) {
            if (str[i] === keyword[j]) { j++; } else { mistakes++; }
            i++;
        }
        return j === keyword.length || (keyword.length > 3 && mistakes <= 1);
    };

    window.copyText = async (t, id = null) => {
        try {
            await navigator.clipboard.writeText(t);
            window.showToast("已复制话术");
            if (id) {
                const it = window.qaData.find(i => i.id === id);
                if (it) { 
                    it.clicks = (it.clicks || 0) + 1; 
                    await window.IO.put(window.STORE_QA, it); 
                    if (!document.getElementById('searchInput').value.trim()) window.renderMainList(); 
                }
            }
        } catch (err) { window.showToast("复制失败"); }
    };

    window.copyImage = async (u) => {
        try {
            const res = await fetch(u); 
            const b = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]);
            window.showToast("图片已复制");
        } catch (e) { window.showToast("复制失败"); }
    };

    window.renderImageSection = function(images) {
        const groups = {};
        images.forEach(img => {
            if (!groups[img.category]) groups[img.category] = [];
            groups[img.category].push(img.url);
        });
        return `<div class="image-library">` + 
            Object.keys(groups).map(cat => `
                <div class="image-group">
                    <span class="group-label">${cat}-图片集:</span>
                    <div class="img-grid">
                        ${groups[cat].map(url => `<img src="${url}" onclick="window.copyImage('${url}')">`).join('')}
                    </div>
                </div>`).join('') + `</div>`;
    };

    // --- 7. 管理界面逻辑 (修正删除与清空漏洞) ---
    window.renderManageLists = () => {
        const mTerm = document.getElementById('manageSearchInput')?.value.trim().toLowerCase() || "";
        const qaContainer = document.getElementById('manageQaList');
        const quickContainer = document.getElementById('manageQuickList');

        if (qaContainer) {
            const filteredQa = window.qaData.filter(item => 
                !mTerm || item.question.toLowerCase().includes(mTerm) || item.replies.some(r => r.toLowerCase().includes(mTerm))
            ).reverse();
            qaContainer.innerHTML = filteredQa.map(item => `
                <div class="manage-item">
                    <div style="display:flex; align-items:center; overflow:hidden;">
                        ${(item.images?.length > 0) ? '<span style="margin-right:8px;">🖼️</span>' : ''}
                        <span>${item.question}</span>
                    </div>
                    <span class="del-btn" onclick="window.deleteQA(${item.id})">删除</span>
                </div>`).join('');
        }
        if (quickContainer) {
            // 确保渲染顺序与数据库 Key 顺序一致
            quickContainer.innerHTML = [...window.quickReplies].reverse().map((t, i) => `
                <div class="manage-item"><span>${t}</span><span class="del-btn" onclick="window.deleteQuick(${i})">删除</span></div>
            `).join('');
        }
    };

    // 修正：支持删除最后一个常用语，并防止 refreshMemory 自动填充
    window.deleteQuick = async (index) => {
        const tx = window.db.transaction(window.STORE_QUICK, "readonly");
        const store = tx.objectStore(window.STORE_QUICK);
        const keys = await new Promise(res => {
            const r = store.getAllKeys(); r.onsuccess = () => res(r.result);
        });
        
        // 由于界面是反序渲染的，需要反转 Key 列表来匹配 index
        const targetKey = keys.reverse()[index];
        if (targetKey !== undefined) {
            await window.IO.delete(window.STORE_QUICK, targetKey);
            // 标记已由用户操作过，即便为空也不再自动填充默认值
            localStorage.setItem(window.DB_KEY_INIT, 'true');
            await window.refreshMemory();
            window.renderManageLists();
            window.renderAll();
        }
    };

    window.clearAllData = async () => {
        if(confirm("确定清空全库吗？")) { 
            await window.IO.clear(window.STORE_QA); 
            await window.IO.clear(window.STORE_QUICK); 
            // 清除标记，允许下次访问时重新生成默认语
            localStorage.removeItem(window.DB_KEY_INIT);
            location.reload(); 
        }
    };

    // 其他 UI 交互函数
    window.addReplyInput = () => {
        const d = document.createElement('div'); d.className = 'reply-input-item';
        d.innerHTML = `<input type="text" class="reply-val" placeholder="回复话术..."><button onclick="this.parentElement.remove()" class="plus-btn">-</button>`;
        document.getElementById('replyInputs').appendChild(d);
    };

    window.addImageInput = () => {
        const d = document.createElement('div'); d.className = 'image-input-item';
        d.innerHTML = `<input type="text" class="img-cat-val" placeholder="分类..."><input type="file" class="img-file-val" accept="image/*"><button type="button" onclick="this.parentElement.remove()" class="plus-btn">-</button>`;
        document.getElementById('imageInputs').appendChild(d);
    };

    window.toggleModal = (s) => {
        const m = document.getElementById('modalOverlay');
        if (m) { m.style.display = s ? 'flex' : 'none'; if(s) window.renderManageLists(); }
    };

    window.switchTab = (t) => {
        document.querySelectorAll('.panel, .modal-tabs button').forEach(el => el.classList.remove('active'));
        document.getElementById(`panel-${t}`)?.classList.add('active');
        document.getElementById(`tab-${t}`)?.classList.add('active');
    };

    window.showToast = (m) => {
        const t = document.createElement('div'); t.innerText = m;
        t.className = 'mecis-toast'; // 建议在 CSS 中统一样式
        t.style = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 20px;border-radius:20px;z-index:9999;font-size:14px;";
        document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
    };

    window.deleteQA = async (id) => { await window.IO.delete(window.STORE_QA, id); await window.refreshMemory(); window.renderManageLists(); window.renderAll(); };

    window.exportData = async () => {
        const obj = { qaData: window.qaData, quickReplies: window.quickReplies };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
        const link = document.createElement('a'); 
        link.href = dataStr; 
        link.download = `芒果备份_${window.getFileName().split('.')[0]}.json`; 
        link.click();
    };

    window.importData = (event) => {
        const file = event.target.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const d = JSON.parse(e.target.result);
                await window.IO.clear(window.STORE_QA); 
                await window.IO.clear(window.STORE_QUICK);
                for (let item of (d.qaData || [])) await window.IO.put(window.STORE_QA, item);
                for (let t of (d.quickReplies || [])) await window.IO.put(window.STORE_QUICK, {text: t});
                localStorage.setItem(window.DB_KEY_INIT, 'true');
                location.reload();
            } catch(err) { alert("导入失败"); }
        };
        r.readAsText(file);
    };

    window.renderAll = () => {
        const c = document.getElementById('quickReplyList');
        if (c) c.innerHTML = window.quickReplies.map(t => `<div class="tag-item" onclick="window.copyText('${t}')">${t}</div>`).join('');
        window.renderMainList();
    };

    window.clearSearchInput = () => {
        const input = document.getElementById('searchInput');
        if(input) { input.value = ''; window.renderMainList(); }
    };

    window.toggleTheme = () => {
        const n = document.body.className === 'light-theme' ? 'dark-theme' : 'light-theme';
        document.body.className = n; 
        localStorage.setItem(window.DB_KEY_THEME, n);
    };

})(); // 闭包结束


