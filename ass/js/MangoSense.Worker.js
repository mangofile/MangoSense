/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: SEMANTIC_WORKER_CORE_2026
 * STATUS: PRODUCTION_READY
 */

// 1. 从 ESM 加载 Transformers.js
import { pipeline, env } from 'esm.sh';

/**
 * 2. 核心环境配置 (针对 GitHub Pages 部署优化)
 */
env.allowLocalModels = false;
env.useBrowserCache = true;
// 强制重定向 Wasm 路径到官方 CDN
env.backends.onnx.wasm.wasmPaths = 'cdn.jsdelivr.net';

let pipe = null;

/**
 * 3. AI 线程消息监听器
 */
self.onmessage = async (e) => {
    const { type, text } = e.data;

    // --- 逻辑 A: 引擎初始化 ---
    if (type === 'INIT') {
        try {
            console.log("MECIS AI: 正在初始化多语言语义模型...");
            // 加载模型
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            console.log("MECIS AI: 模型载入成功");
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("MECIS AI: 初始化失败:", err);
            self.postMessage({ type: 'ERROR', message: err.message });
        }
    }

    // --- 逻辑 B: 文本向量化 (Embedding) ---
    if (type === 'EMBED') {
        if (!pipe) return;
        try {
            const output = await pipe(text, { pooling: 'mean', normalize: true });
            const vector = Array.from(output.data);
            self.postMessage({ 
                type: 'VECTOR', 
                vector: vector, 
                originalText: text 
            });
        } catch (err) {
            console.error("MECIS AI: 向量化处理异常:", err);
        }
    }
};
