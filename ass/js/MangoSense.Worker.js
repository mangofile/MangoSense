/**
 * PROTOCOL_RECOVERY_KEY::MECIS_V4.0_STABLE
 * STATUS: INTEGRATED_FINAL_VERSION
 * VERSION: V4.0-AI-READY (Project: Mango Sense)
 * 2026-PRODUCTION-READY
 */

(function() {
    // --- 1. 动态物理隔离逻辑 (继承 V3.5) ---
    const getFileName = () => {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    };

    const getSafeDBName = () => {
        const safeName = getFileName().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return `MangoDB_V4_${safeName}`; 
    };

    const DB_NAME = getSafeDBName(); 
    const DB_VERSION = 1;
    const STORE_QA = "QA_COLLECTION";
    const STORE_QUICK = "QUICK_REPLIES";
    const DB_KEY_THEME = 'USER_THEME_PREFERENCE';

    let db = null;
    let qaData = []; 
    let quickReplies = [];
    let aiWorker = null;
    let isAiReady = false;

    // --- 2. 异步数据库驱动 ---
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const _db = e.target.result;
                if (!_db.objectStoreNames.contains(STORE_QA)) _db.createObjectStore(STORE_QA, { keyPath: "id" });
                if (!_db.objectStoreNames.contains(STORE_QUICK)) _db.createObjectStore(STORE_QUICK, { autoIncrement: true });
            };
            request.onsuccess = (e) => { db = e.target.result; resolve(); };
            request.onerror = () => reject("IndexedDB Error");
        });
    }

    const IO = {
        async getAll(storeName) {
            return new Promise(res => {
                const tx = db.transaction(storeName, "readonly");
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => res(req.result);
            });
        },
        async put(storeName, data) {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(data);
            return new Promise(res => tx.oncomplete = () => res());
        },
        async delete(storeName, id) {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(id);
            return new Promise(res => tx.oncomplete = () => res());
        },
        async clear(storeName) {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).clear();
            return new Promise(res => tx.oncomplete = () => res());
        }
    };

    // --- 3. AI 核心：Web Worker 交互 (V4.0 关键修复) ---
    function initAiWorker() {
        const workerUrl = new URL('./MangoSense.Worker.js', import.meta.url).href;
        try {
            aiWorker = new Worker(workerUrl, { type: 'module' });
            aiWorker.postMessage({ type: 'INIT' });
            aiWorker.onmessage = (e) => {
                if (e.data.type === 'READY') {
                    isAiReady = true;
                    const tag = document.querySelector('.version-tag');
                    if(tag) tag.innerHTML = 'v4.0-AI-READY';
                    console.log("MECIS AI Core: 语义引擎已就绪");
                }
            };
        } catch (error) {
            console.error("AI Worker 启动失败:", error);
        }
    }

    async function getVector(text) {
        if (!isAiReady) return null;
        return new Promise(res => {
            const handler = (e) => {
                if (e.data.type === 'VECTOR' && e.data.originalText === text) {
                    aiWorker.removeEventListener('message', handler);
                    res(e.data.vector);
                }
            };
            aiWorker.addEventListener('message', handler);
            aiWorker.postMessage({ type: 'EMBED', text });
        });
    }

    function cosineSimilarity(v1, v2) {
        if (!v1 || !v2) return 0;
        const dot = v1.reduce((s, c, i) => s + c * v2[i], 0);
        const nA = Math.sqrt(v1.reduce((s, c) => s + c * c, 0));
        const nB = Math.sqrt(v2.reduce((s, c) => s + c * c, 0));
        return (nA === 0 || nB === 0) ? 0 : dot / (nA * nB);
    }

    // --- 4. 核心启动逻辑 (V4.0 部署补丁版) ---
    window.onload = async () => {
        // A. 优先数据库初始化
        await initDB();

        // B. 延迟 1 秒开启 AI，避免阻塞浏览器对 PWA manifest 的首屏评估
        setTimeout(() => {
            initAiWorker(); 
            console.log("MECIS: AI 延时启动以优化 PWA 安装环境");
        }, 1000);
        
        const currentFile = getFileName();
        // 迁移旧版 LocalStorage 数据 (保持逻辑不丢失)
        const oldQA = localStorage.getItem(`QA_DATA_${currentFile}`);
        const oldQuick = localStorage.getItem(`QUICK_DATA_${currentFile}`);
        if (oldQA || oldQuick) {
            if (oldQA) {
                const list = JSON.parse(oldQA);
                for (let item of list) await IO.put(STORE_QA, item);
                localStorage.removeItem(`QA_DATA_${currentFile}`);
            }
            if (oldQuick) {
                const list = JSON.parse(oldQuick);
                for (let text of list) await IO.put(STORE_QUICK, {text});
                localStorage.removeItem(`QUICK_DATA_${currentFile}`);
            }
        }

        const savedTheme = localStorage.getItem(DB_KEY_THEME) || 'light-theme';
        document.body.className = savedTheme;
        
        await refreshMemory();
        renderAll();

        // 注意：HTML 头部已经注册了 sw.js，此处不再重复注册以防 Scope 冲突
    };
    async function refreshMemory() {
        qaData = await IO.getAll(STORE_QA);
        const quickRows = await IO.getAll(STORE_QUICK);
        quickReplies = quickRows.map(r => typeof r === 'string' ? r : r.text);
        if (quickReplies.length === 0) {
            const defaultQuick = ['您好', '好的', '请稍后'];
            for (let t of defaultQuick) await IO.put(STORE_QUICK, {text: t});
            quickReplies = defaultQuick;
        }
    }

    // --- 5. 渲染与搜索引擎 (整合 V3.5 模糊匹配 + V4.0 语义匹配) ---
    window.renderMainList = async function() {
        const searchInput = document.getElementById('searchInput');
        const term = searchInput?.value.trim() || "";
        const clearBtn = document.getElementById('clearSearch');
        const container = document.getElementById('qaDisplay');
        if (!container) return;
        if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';

        let displayData = [];
        if (!term) {
            // 无搜索时按点击量排序
            displayData = [...qaData].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
            if (displayData.length === 0 && qaData.length > 0) displayData = [...qaData].reverse().slice(0, 10);
        } else {
            // 1. 传统模糊匹配引擎
            const fuzzyResults = qaData.filter(item => 
                fuzzyMatch(item.question, term) || item.replies.some(r => fuzzyMatch(r, term))
            );

            // 2. AI 语义引擎 (V4.0 增强)
            if (isAiReady) {
                const queryVec = await getVector(term);
                const semanticResults = qaData
                    .filter(item => item.vector) // 仅对比已向量化的数据
                    .map(item => ({
                        ...item,
                        score: cosineSimilarity(queryVec, item.vector)
                    }))
                    .filter(item => item.score > 0.65); // 语义置信度阈值

                // 合并去重并按得分排序
                const combined = [...fuzzyResults, ...semanticResults];
                displayData = Array.from(new Map(combined.map(i => [i.id, i])).values());
                displayData.sort((a, b) => (b.score || 0) - (a.score || 0));
            } else {
                displayData = fuzzyResults.reverse();
            }
        }

        container.innerHTML = displayData.map(item => `
            <div class="qa-card" style="${item.score ? `border-left: 4px solid rgba(45,92,247,${item.score})` : ''}">
                <span class="question-text">
                    问：${item.question}
                    ${item.score ? `<span class="match-score">AI 匹配 ${(item.score * 100).toFixed(0)}%</span>` : ''}
                    ${!term ? `<span style="font-size:10px; color:var(--accent-blue); float:right;">热度 ${item.clicks || 0}</span>` : ''}
                </span>
                <div class="replies-box">${item.replies.map(r => `<div class="reply-option" onclick="copyText('${r}', ${item.id})">${r}</div>`).join('')}</div>
                ${item.images && item.images.length > 0 ? renderImageSection(item.images) : ''}
            </div>`).join('');
    };

    window.saveNewQA = async function() {
        const question = document.getElementById('newQuestion').value;
        const replies = Array.from(document.querySelectorAll('.reply-val')).map(i => i.value).filter(v => v.trim() !== "");
        const imgCats = document.querySelectorAll('.img-cat-val');
        const imgFiles = document.querySelectorAll('.img-file-val');
        
        if(!question || (replies.length === 0)) return alert("请完整填写内容");

        showToast("AI 语义分析中...");
        
        // 生成语义特征向量 (V4.0)
        let vector = null;
        if (isAiReady) vector = await getVector(question);

        // 处理图片
        let images = [];
        for (let i = 0; i < imgFiles.length; i++) {
            const file = imgFiles[i].files[0];
            if (file) {
                const base = await new Promise(res => {
                    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
                });
                images.push({ category: imgCats[i].value || "默认", url: base });
            }
        }

        await IO.put(STORE_QA, { id: Date.now(), question, replies, images, clicks: 0, vector });
        await refreshMemory();
        showToast("已存入 AI 库");
        
        // 重置表单
        document.getElementById('newQuestion').value = '';
        document.getElementById('replyInputs').innerHTML = `<div class="reply-input-item"><input type="text" class="reply-val" placeholder="回复话术 1"><button onclick="addReplyInput()" class="plus-btn">+</button></div>`;
        document.getElementById('imageInputs').innerHTML = `<div class="image-input-item"><input type="text" class="img-cat-val" placeholder="分类..."><input type="file" class="img-file-val" accept="image/*"><button onclick="addImageInput()" class="plus-btn">+</button></div>`;
        renderAll(); 
        if(typeof renderManageLists === 'function') renderManageLists();
    };
    // --- 6. 核心功能补全 (完全保留 V3.5 逻辑) ---
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
        navigator.clipboard.writeText(t).then(async () => {
            showToast("已复制");
            if (id) {
                const it = qaData.find(i => i.id === id);
                if (it) { 
                    it.clicks = (it.clicks || 0) + 1; 
                    await IO.put(STORE_QA, it); 
                    if (!document.getElementById('searchInput').value.trim()) renderMainList(); 
                }
            }
        });
    };

    window.copyImage = async (u) => {
        try {
            const res = await fetch(u); const b = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]);
            showToast("图片已复制");
        } catch (e) { showToast("复制失败"); }
    };

    function renderImageSection(images) {
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
                        ${groups[cat].map(url => `<img src="${url}" onclick="copyImage('${url}')" title="点击复制图片">`).join('')}
                    </div>
                </div>`).join('') + `</div>`;
    }

    // --- 7. 管理界面逻辑 ---
    window.renderManageLists = () => {
        const mTerm = document.getElementById('manageSearchInput')?.value.trim().toLowerCase() || "";
        const qaContainer = document.getElementById('manageQaList');
        const quickContainer = document.getElementById('manageQuickList');

        if (qaContainer) {
            const filteredQa = qaData.filter(item => 
                !mTerm || item.question.toLowerCase().includes(mTerm) || item.replies.some(r => r.toLowerCase().includes(mTerm))
            ).reverse();

            qaContainer.innerHTML = filteredQa.map(item => `
                <div class="manage-item">
                    <div style="display:flex; align-items:center; overflow:hidden;">
                        ${(item.images?.length > 0) ? '<span style="margin-right:8px;">🖼️</span>' : ''}
                        <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${item.question}</span>
                    </div>
                    <span class="del-btn" onclick="deleteQA(${item.id})">删除</span>
                </div>`).join('');
        }
        if (quickContainer) {
            quickContainer.innerHTML = [...quickReplies].reverse().map((t, i) => `
                <div class="manage-item"><span>${t}</span><span class="del-btn" onclick="deleteQuick(${quickReplies.length - 1 - i})">删除</span></div>
            `).join('');
        }
    };

    window.toggleTheme = () => {
        const n = document.body.className === 'light-theme' ? 'dark-theme' : 'light-theme';
        document.body.className = n; localStorage.setItem(DB_KEY_THEME, n);
    };

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
        if (m) { m.style.display = s ? 'flex' : 'none'; if(s) renderManageLists(); }
    };

    window.switchTab = (t) => {
        document.querySelectorAll('.panel, .modal-tabs button').forEach(el => el.classList.remove('active'));
        document.getElementById(`panel-${t}`)?.classList.add('active');
        document.getElementById(`tab-${t}`)?.classList.add('active');
    };

    window.showToast = (m) => {
        const t = document.createElement('div'); t.innerText = m;
        t.style = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 20px;border-radius:20px;z-index:9999;font-size:14px;";
        document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
    };

    window.clearAllData = async () => {
        if(confirm("确定清空全库吗？")) { await IO.clear(STORE_QA); await IO.clear(STORE_QUICK); location.reload(); }
    };

    window.deleteQA = async (id) => { await IO.delete(STORE_QA, id); await refreshMemory(); renderManageLists(); renderAll(); };

    window.deleteQuick = async (index) => {
        const list = await IO.getAll(STORE_QUICK);
        const keys = await new Promise(res => {
            const tx = db.transaction(STORE_QUICK, "readonly");
            const r = tx.objectStore(STORE_QUICK).getAllKeys();
            r.onsuccess = () => res(r.result);
        });
        await IO.delete(STORE_QUICK, keys[index]);
        await refreshMemory(); renderManageLists(); renderAll();
    };

    window.exportData = async () => {
        const obj = { qaData, quickReplies };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
        const link = document.createElement('a'); link.href = dataStr; 
        link.download = `芒果备份_${getFileName().split('.')[0]}.json`; link.click();
    };

    window.importData = (event) => {
        const file = event.target.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const d = JSON.parse(e.target.result);
                await IO.clear(STORE_QA); await IO.clear(STORE_QUICK);
                for (let item of (d.qaData || [])) await IO.put(STORE_QA, item);
                for (let t of (d.quickReplies || [])) await IO.put(STORE_QUICK, {text: t});
                location.reload();
            } catch(err) { alert("导入失败"); }
        };
        r.readAsText(file);
    };

    window.renderAll = () => {
        const c = document.getElementById('quickReplyList');
        if (c) c.innerHTML = quickReplies.map(t => `<div class="tag-item" onclick="copyText('${t}')">${t}</div>`).join('');
        renderMainList();
    };

    window.clearSearchInput = () => {
        const input = document.getElementById('searchInput');
        if(input) { input.value = ''; renderMainList(); }
    };

})(); // 闭包结束
