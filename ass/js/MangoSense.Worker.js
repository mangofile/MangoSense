/**
 * PROJECT: MANGO SENSE AI V4.0
 * CORE: SEMANTIC_WORKER_CORE_2026
 */
import { pipeline, env } from 'https://esm.sh';

// 2026 环境配置：强制使用浏览器原生缓存，不请求本地模型
env.allowLocalModels = false;
env.useBrowserCache = true;

let pipe = null;

// AI 线程监听逻辑
self.onmessage = async (e) => {
    const { type, text } = e.data;

    if (type === 'INIT') {
        try {
            // 加载对中文支持最稳健的多语言特征提取模型
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("MECIS AI: 模型引擎载入失败", err);
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
            const vector = Array.from(output.data);
            self.postMessage({ type: 'VECTOR', vector, originalText: text });
        } catch (err) {
            console.error("MECIS AI: 向量化处理异常", err);
        }
    }
};

