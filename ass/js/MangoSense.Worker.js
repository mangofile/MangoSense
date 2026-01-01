/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: SEMANTIC_WORKER_CORE_2026
 * STATUS: PRODUCTION_READY
 */

// 1. 明确从 ESM 加载 Transformers.js，确保版本锁定在 2026 稳定版
import { pipeline, env } from 'esm.sh';

/**
 * 2. 核心环境配置 (针对 GitHub Pages 部署优化)
 */
// 禁用搜索本地模型，防止在 GitHub Pages 产生大量 404 请求
env.allowLocalModels = false;
// 开启浏览器缓存，模型一旦下载即永久存储于 Cache Storage
env.useBrowserCache = true;
// 【关键】强制重定向 Wasm 文件路径到官方 CDN，解决部署端无法解析二进制片段的问题
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
            
            // 使用对中文支持最稳健的轻量级模型 (约 110MB)
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            
            console.log("MECIS AI: 模型载入成功");
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("MECIS AI: 初始化失败，请检查网络或跨域隔离设置:", err);
            self.postMessage({ type: 'ERROR', message: err.message });
        }
    }

    // --- 逻辑 B: 文本向量化 (Embedding) ---
    if (type === 'EMBED') {
        if (!pipe) {
            console.warn("MECIS AI: 引擎尚未就绪，无法处理文本");
            return;
        }

        try {
            // 生成 384 维语义特征向量
            // pooling: 'mean' 提取平均特征，normalize: true 方便后续进行余弦相似度计算
            const output = await pipe(text, { pooling: 'mean', normalize: true });
            
            // 将 Float32Array 转换为普通 Array 以便通过 postMessage 安全传输回主线程
            const vector = Array.from(output.data);
            
            self.postMessage({ 
                type: 'VECTOR', 
                vector: vector, 
                originalText: text 
            });
        } catch (err) {
            console.error("MECIS AI: 向量化处理异常:", err);
            self.postMessage({ type: 'ERROR', message: "向量生成失败" });
        }
    }
};
