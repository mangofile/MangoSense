// ass/js/MangoSense.Worker.js - V4.0 AI 计算线程
import { pipeline, env } from 'https://cdn.jsdelivr.net';

// 配置 2026 模型缓存路径
env.allowLocalModels = false;

let pipe = null;

self.onmessage = async (e) => {
    const { type, text } = e.data;

    if (type === 'INIT') {
        try {
            pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            self.postMessage({ type: 'READY' });
        } catch (err) {
            console.error("AI模型加载失败:", err);
        }
    }

    if (type === 'EMBED') {
        if (!pipe) return;
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        self.postMessage({ type: 'VECTOR', vector, originalText: text });
    }
};

