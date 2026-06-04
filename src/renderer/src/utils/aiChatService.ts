/**
 * AI 对话服务
 * 
 * 支持三种后端：
 *   1. 本地 Ollama (http://...:11434/api/chat)
 *   2. 第三方 OpenAI 兼容 API (/v1/chat/completions)
 *   3. Claude CLI (claude -p --print)
 * 
 * 均支持 streaming 流式输出，通过回调实时推送文本片段。
 */

import { AIConfig, DEFAULT_AI_CONFIG } from '../types';

/** 对话消息 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** 对话结果 */
export interface ChatResult {
    /** 完整响应文本 */
    text: string;
    /** 插件执行的动作（可选，用于命令处理） */
    action?: { type: string; payload?: any };
}

/** 流式回调 */
export type StreamCallback = (chunk: string) => void;

/** 10 秒 */
const TIMEOUT_MS = 10000;

/**
 * Promise 超时包装
 */
function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
    ]);
}

/**
 * 从 localStorage 加载 AI 配置
 */
export function loadAIConfig(): AIConfig {
    try {
        const saved = localStorage.getItem('pet-ai-config');
        if (saved) {
            return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
        }
    } catch { /* ignore */ }
    return { ...DEFAULT_AI_CONFIG };
}

/**
 * 持久化 AI 配置
 */
export function saveAIConfig(config: AIConfig): void {
    localStorage.setItem('pet-ai-config', JSON.stringify(config));
}

/**
 * AI 对话服务类
 * 
 * 用法：
 *   const svc = new AIChatService(config);
 *   const result = await svc.chat({
 *     messages: [{ role: 'user', content: '你好' }],
 *     onChunk: (text) => console.log(text), // 实时流式回调
 *   });
 *   // result.text 包含完整响应
 */
class AIChatService {
    private config: AIConfig;

    constructor(config?: AIConfig) {
        this.config = config || loadAIConfig();
    }

    /** 更新配置 */
    setConfig(config: AIConfig): void {
        this.config = config;
    }

    /** 配置是否有效（已启用且填写了必要字段） */
    isAvailable(): boolean {
        if (!this.config.enabled) return false;
        if (this.config.provider === 'local') {
            return !!this.config.ollamaUrl && !!this.config.ollamaModel;
        }
        if (this.config.provider === 'claude_cli') {
            return true; // CLI 自带认证，无需配置
        }
        return !!this.config.apiUrl && !!this.config.apiKey && !!this.config.model;
    }

    /**
     * 发起对话（非流式）
     * 错误时抛出异常
     */
    async chat(messages: ChatMessage[]): Promise<string> {
        return await this._chat(messages, null, TIMEOUT_MS);
    }

    /**
     * 发起流式对话
     * @param messages 对话历史
     * @param onChunk 每次收到累积文本时的回调
     * @returns 完整响应文本，错误时抛出异常（含具体原因）
     */
    async chatStream(
        messages: ChatMessage[],
        onChunk: StreamCallback
    ): Promise<string> {
        return await this._chat(messages, onChunk, TIMEOUT_MS);
    }

    /**
     * 测试连接
     */
    async testConnection(): Promise<{ ok: boolean; message: string }> {
        try {
            const testMsgs: ChatMessage[] = [
                { role: 'user', content: '回复"OK"' }
            ];
            const result = await this._chat(testMsgs, null, 5000);
            if (result && result.includes('OK')) {
                return { ok: true, message: '连接成功！AI 服务正常。' };
            }
            return { ok: true, message: `连接成功，但响应异常: "${result?.slice(0, 30)}"` };
        } catch (err) {
            return { ok: false, message: `连接失败: ${(err as Error).message}` };
        }
    }

    /**
     * 自动检测本地 Ollama 可用模型
     */
    async detectOllamaModels(baseUrl?: string): Promise<string[]> {
        const url = baseUrl || this.config.ollamaUrl || 'http://localhost:11434';
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const resp = await fetch(`${url}/api/tags`, { signal: controller.signal });
            clearTimeout(timer);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            return (data.models || []).map((m: any) => m.name);
        } catch {
            return [];
        }
    }

    // === 私有实现 ===

    private async _chat(
        messages: ChatMessage[],
        onChunk: StreamCallback | null,
        timeoutMs: number
    ): Promise<string> {
        if (!this.isAvailable()) throw new Error('AI 未启用或配置不完整');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            if (this.config.provider === 'local') {
                return await this._ollamaChat(messages, onChunk, controller.signal);
            }
            if (this.config.provider === 'claude_cli') {
                return await withTimeout(
                    this._claudeCLIChat(messages, onChunk),
                    timeoutMs,
                    `AI 响应超时（${timeoutMs / 1000}秒）`
                );
            }
            return await this._openAIChat(messages, onChunk, controller.signal);
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                throw new Error(`AI 响应超时（${timeoutMs / 1000}秒）`);
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Ollama streaming chat
     * POST {baseUrl}/api/chat
     * 响应: 逐行 JSON，每行 { message: { content: "..." }, done: false|true }
     */
    private async _ollamaChat(
        messages: ChatMessage[],
        onChunk: StreamCallback | null,
        signal: AbortSignal
    ): Promise<string | null> {
        const url = `${this.config.ollamaUrl}/api/chat`;
        const body = JSON.stringify({
            model: this.config.ollamaModel,
            messages,
            stream: !!onChunk
        });

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal
        });

        if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${resp.statusText}`);

        if (!onChunk || !resp.body) {
            const data = await resp.json();
            return data?.message?.content || null;
        }

        // Streaming
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    const chunk = data?.message?.content || '';
                    if (chunk) {
                        fullText += chunk;
                        onChunk(fullText);  // 传累积文本，方便 UI 直接替换
                    }
                } catch { /* skip malformed lines */ }
            }
        }

        return fullText || null;
    }

    /**
     * OpenAI-compatible streaming chat
     * POST {baseUrl}/chat/completions
     * 响应: SSE 格式，data: {"choices":[{"delta":{"content":"..."}}]}
     */
    private async _openAIChat(
        messages: ChatMessage[],
        onChunk: StreamCallback | null,
        signal: AbortSignal
    ): Promise<string | null> {
        const url = `${this.config.apiUrl}/chat/completions`;
        const body = JSON.stringify({
            model: this.config.model,
            messages,
            stream: !!onChunk
        });

        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body,
            signal
        });

        if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);

        if (!onChunk || !resp.body) {
            const data = await resp.json();
            return data?.choices?.[0]?.message?.content || null;
        }

        // SSE streaming
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(dataStr);
                    const chunk = data?.choices?.[0]?.delta?.content || '';
                    if (chunk) {
                        fullText += chunk;
                        onChunk(fullText);  // 传累积文本，方便 UI 直接替换
                    }
                } catch { /* skip */ }
            }
        }

        return fullText || null;
    }

    /**
     * Claude CLI streaming chat
     * 通过 IPC 调用主进程 spawn('claude', ['-p', '--print', prompt])
     * 主进程逐行推送 stdout 到渲染进程
     */
    private async _claudeCLIChat(
        messages: ChatMessage[],
        onChunk: StreamCallback | null
    ): Promise<string> {
        // 构建对话提示词
        const prompt = messages.map(m => {
            const label = m.role === 'system' ? '系统' : m.role === 'user' ? '用户' : '助手';
            return `[${label}]: ${m.content}`;
        }).join('\n\n') + '\n\n[助手]:';

        if (!window.petAPI?.claudeChat) {
            throw new Error('Claude CLI 不可用（preload 未加载）');
        }

        const cliPath = this.config.claudeCLIPath || 'claude';

        if (onChunk) {
            return await window.petAPI.claudeChat(prompt, cliPath, (chunk) => {
                onChunk(chunk);
            });
        }
        return await window.petAPI.claudeChat(prompt, cliPath);
    }
}

/** 全局单例 */
let serviceInstance: AIChatService | null = null;

export function getAIChatService(): AIChatService {
    if (!serviceInstance) {
        serviceInstance = new AIChatService();
    }
    return serviceInstance;
}

export default AIChatService;
