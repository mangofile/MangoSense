/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: SEMANTIC_WORKER_CORE_2026
 * STATUS: GITHUB_PAGES_STABLE
 */

// 1. 【关键修复】明确导入源，防止 esm.sh 返回 404 HTML
import { pipeline, env } from 'esm.sh';

// 2. 【关键修复】环境配置：重定向 Wasm 路径
// GitHub Pages 无法正确托管 .wasm 二进制片段，必须强制指向远程 CDN
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = 'cdn.jsdelivr.net';

let pipe = null;

// AI 线程监听逻辑
self.onmessage = async (e) => {
    const { type, text } = e.data;

    if (type === 'INIT') {
        try {
            // 加载对中文支持最稳健的多语言特征提取模型 (约 110MB)
            // 首次加载较慢，之后会存储在浏览器的 Cache Storage 中
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("MECIS AI: 模型引擎载入失败", err);
            // 发送失败反馈，防止主线程死等
            self.postMessage({ type: 'ERROR', message: err.message });
        }
    }

    if (type === 'EMBED') {
        if (!pipe) {
            console.warn("MECIS AI: 引擎尚未初始化，无法处理语义");
            return;
        }
        try {
            // 生成 384 维语义特征向量
            const output = await pipe(text, { pooling: 'mean', normalize: true });
            // 将 Float32Array 转换为普通数组，以便通过 postMessage 序列化传输
            const vector = Array.from(output.data);
            self.postMessage({ type: 'VECTOR', vector, originalText: text });
        } catch (err) {
            console.error("MECIS AI: 向量化处理异常", err);
        }
    }
};


