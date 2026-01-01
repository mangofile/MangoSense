/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: SEMANTIC_WORKER_CORE_2026
 * STATUS: FIXED_VERSION
 */

// 从 ESM 直接加载 Transformers.js
import { pipeline, env } from 'esm.sh';

// 2026 部署配置
env.allowLocalModels = false;
env.useBrowserCache = true;
// 强制指向远程 Wasm 资源，解决部署端路径 404 问题
env.backends.onnx.wasm.wasmPaths = 'cdn.jsdelivr.net';

let pipe = null;

// Worker 监听逻辑（禁止使用 window/document）
self.onmessage = async (e) => {
    const { type, text } = e.data;

    if (type === 'INIT') {
        try {
            console.log("MECIS AI Worker: 正在初始化语义引擎...");
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("MECIS AI Worker: 初始化失败", err);
        }
    }

    if (type === 'EMBED' && pipe) {
        try {
            const output = await pipe(text, { pooling: 'mean', normalize: true });
            self.postMessage({ 
                type: 'VECTOR', 
                vector: Array.from(output.data), 
                originalText: text 
            });
        } catch (err) {
            console.error("MECIS AI Worker: 处理异常", err);
        }
    }
};
