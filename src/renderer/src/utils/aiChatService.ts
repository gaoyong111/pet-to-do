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
import { loadSystemPromptFromStorage } from './systemPrompt';

/** 用户主动停止生成 */
export class ChatAbortedError extends Error {
    constructor(message = '已停止生成') {
        super(message);
        this.name = 'ChatAbortedError';
    }
}

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

/** Ollama 本机候选地址（检测时依次尝试） */
export const OLLAMA_LOCAL_CANDIDATES = [
    'http://127.0.0.1:11434',
    'http://localhost:11434',
] as const;

export interface OllamaDetectResult {
    models: string[];
    /** 实际连通的 Ollama 地址 */
    url: string | null;
    error?: string;
}

function normalizeOllamaBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
}

function isChatCapableModel(model: { name?: string; capabilities?: string[] }): boolean {
    const caps = model.capabilities;
    if (!caps || caps.length === 0) return true;
    return caps.includes('completion') || caps.includes('vision') || caps.includes('tools');
}

async function fetchOllamaModels(baseUrl: string, timeoutMs = 5000): Promise<string[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/tags`, {
            signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        return (data.models || [])
            .filter(isChatCapableModel)
            .map((m: { name: string }) => m.name);
    } finally {
        clearTimeout(timer);
    }
}

function getTimeoutMs(config: AIConfig): number {
  if (config.timeoutMs > 0) return config.timeoutMs;
  if (config.provider === 'local') return 120_000;
  if (config.provider === 'claude_cli') return 35_000;
  return 30_000;
}

function timeoutErrorMessage(config: AIConfig, timeoutMs: number, afterFirstChunk: boolean): string {
  const sec = Math.round(timeoutMs / 1000);
  if (config.provider === 'local') {
    if (afterFirstChunk) {
      return `AI 生成中断（${sec} 秒无新内容）`;
    }
    return `AI 响应超时（${sec} 秒）。本地模型首次加载较慢，可在终端执行 ollama run ${config.ollamaModel} 预热后重试`;
  }
  return `AI 响应超时（${sec} 秒）`;
}

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
    private activeController: AbortController | null = null;
    private userAborted = false;

    constructor(config?: AIConfig) {
        this.config = config || loadAIConfig();
    }

    /** 更新配置 */
    setConfig(config: AIConfig): void {
        this.config = config;
    }

    /** 停止当前进行中的对话（Ollama / API / Claude CLI） */
    abortChat(): void {
        this.userAborted = true;
        this.activeController?.abort();
        window.petAPI?.claudeChatAbort?.();
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
        return await this._chat(messages, null, getTimeoutMs(this.config));
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
        return await this._chat(messages, onChunk, getTimeoutMs(this.config));
    }

    /**
     * 测试连接（不要求 AI 已启用，便于配置阶段验证）
     */
    async testConnection(): Promise<{ ok: boolean; message: string }> {
        if (this.config.provider === 'local') {
            return this.testOllamaConnection();
        }

        if (!this.isConfigured()) {
            return { ok: false, message: '配置不完整，请检查 API 地址和密钥' };
        }

        try {
            const testMsgs: ChatMessage[] = [
                { role: 'user', content: '回复"OK"' },
            ];
            const timeoutMs = getTimeoutMs(this.config);
            const result = await this._chatInternal(testMsgs, null, timeoutMs, { skipEnabledCheck: true });
            if (result && result.includes('OK')) {
                return { ok: true, message: '连接成功！AI 服务正常。' };
            }
            return { ok: true, message: `连接成功，响应: "${result?.slice(0, 30) || ''}"` };
        } catch (err) {
            return { ok: false, message: `连接失败: ${(err as Error).message}` };
        }
    }

    /** 本地 Ollama 专用测试：短回复 + 更长超时（首次加载模型较慢） */
    private async testOllamaConnection(): Promise<{ ok: boolean; message: string }> {
        if (!this.config.ollamaUrl || !this.config.ollamaModel) {
            return { ok: false, message: '请填写 Ollama 地址和模型' };
        }

        const timeoutMs = 60_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const url = `${normalizeOllamaBaseUrl(this.config.ollamaUrl)}/api/chat`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.ollamaModel,
                    messages: [{ role: 'user', content: '回复OK' }],
                    stream: false,
                    options: { num_predict: 8, temperature: 0 },
                }),
                signal: controller.signal,
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                return {
                    ok: false,
                    message: `Ollama ${resp.status}: ${errText.slice(0, 120) || resp.statusText}`,
                };
            }

            const data = await resp.json();
            const text = (data?.message?.content || '').trim();
            if (text) {
                return {
                    ok: true,
                    message: `连接成功！模型 ${this.config.ollamaModel} 响应正常。`,
                };
            }
            return { ok: true, message: '连接成功，模型已响应（内容为空）' };
        } catch (err) {
            if (this.isAbortError(err)) {
                return {
                    ok: false,
                    message: `连接超时（${timeoutMs / 1000} 秒）。本地模型首次加载较慢，请确认 Ollama 运行中后重试。`,
                };
            }
            return { ok: false, message: `连接失败: ${(err as Error).message}` };
        } finally {
            clearTimeout(timer);
        }
    }

    /** 配置字段是否齐全（不检查 enabled） */
    private isConfigured(): boolean {
        if (this.config.provider === 'local') {
            return !!this.config.ollamaUrl && !!this.config.ollamaModel;
        }
        if (this.config.provider === 'claude_cli') {
            return true;
        }
        return !!this.config.apiUrl && !!this.config.apiKey && !!this.config.model;
    }

    /**
     * 自动检测 Ollama 可用模型
     * 依次尝试：配置的地址 → 本机 127.0.0.1 / localhost
     */
    async detectOllamaModels(baseUrl?: string): Promise<OllamaDetectResult> {
        const configured = normalizeOllamaBaseUrl(
            baseUrl || this.config.ollamaUrl || OLLAMA_LOCAL_CANDIDATES[0]
        );
        const candidates = [
            configured,
            ...OLLAMA_LOCAL_CANDIDATES.filter(u => u !== configured),
        ];

        let lastError = '无法连接 Ollama，请确认 Ollama 已启动';

        for (const url of candidates) {
            try {
                const models = await fetchOllamaModels(url);
                return { models, url };
            } catch (err) {
                const msg = (err as Error).message || String(err);
                if (msg.includes('AbortError') || msg.includes('aborted')) {
                    lastError = `连接 ${url} 超时，请检查地址是否正确`;
                } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                    lastError = `无法访问 ${url}，请确认 Ollama 已启动且地址正确`;
                } else {
                    lastError = `${url}: ${msg}`;
                }
            }
        }

        return { models: [], url: null, error: lastError };
    }

    // === 私有实现 ===

    private async _chat(
        messages: ChatMessage[],
        onChunk: StreamCallback | null,
        timeoutMs: number
    ): Promise<string> {
        if (!this.isAvailable()) throw new Error('AI 未启用或配置不完整');
        return this._chatInternal(messages, onChunk, timeoutMs);
    }

    private async _chatInternal(
        messages: ChatMessage[],
        onChunk: StreamCallback | null,
        timeoutMs: number,
        opts?: { skipEnabledCheck?: boolean }
    ): Promise<string> {
        if (!opts?.skipEnabledCheck && !this.isAvailable()) {
            throw new Error('AI 未启用或配置不完整');
        }
        if (!this.isConfigured()) {
            throw new Error('AI 配置不完整');
        }

        this.userAborted = false;
        const controller = new AbortController();
        this.activeController = controller;

        let timer: ReturnType<typeof setTimeout> | null = null;
        let gotFirstChunk = false;
        const firstByteTimeout = timeoutMs;
        const idleTimeout = this.config.provider === 'local' ? 45_000 : timeoutMs;

        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const armTimeout = () => {
            clearTimer();
            const ms = gotFirstChunk ? idleTimeout : firstByteTimeout;
            timer = setTimeout(() => controller.abort(), ms);
        };

        const wrappedChunk: StreamCallback | null = onChunk
            ? (text: string) => {
                if (text.trim()) gotFirstChunk = true;
                armTimeout();
                onChunk(text);
            }
            : null;

        armTimeout();

        try {
            if (this.config.provider === 'local') {
                return await this._ollamaChat(messages, wrappedChunk, controller.signal);
            }
            if (this.config.provider === 'claude_cli') {
                return await withTimeout(
                    this._claudeCLIChat(messages, wrappedChunk),
                    timeoutMs,
                    timeoutErrorMessage(this.config, timeoutMs, false)
                );
            }
            return await this._openAIChat(messages, wrappedChunk, controller.signal);
        } catch (err) {
            if (this.isAbortError(err)) {
                if (this.userAborted) throw new ChatAbortedError();
                throw new Error(timeoutErrorMessage(this.config, timeoutMs, gotFirstChunk));
            }
            if (err instanceof ChatAbortedError) throw err;
            if ((err as Error).message === '已停止生成') throw new ChatAbortedError();
            throw err;
        } finally {
            clearTimer();
            this.activeController = null;
        }
    }

    private isAbortError(err: unknown): boolean {
        return err instanceof DOMException && err.name === 'AbortError';
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
        const url = `${normalizeOllamaBaseUrl(this.config.ollamaUrl)}/api/chat`;
        const body = JSON.stringify({
            model: this.config.ollamaModel,
            messages,
            stream: !!onChunk,
            keep_alive: '10m',
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

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                if (signal.aborted) {
                    await reader.cancel().catch(() => {});
                    throw new DOMException('Aborted', 'AbortError');
                }

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
                            onChunk(fullText);
                        }
                    } catch { /* skip malformed lines */ }
                }
            }
        } finally {
            reader.releaseLock();
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

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                if (signal.aborted) {
                    await reader.cancel().catch(() => {});
                    throw new DOMException('Aborted', 'AbortError');
                }

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
                            onChunk(fullText);
                        }
                    } catch { /* skip */ }
                }
            }
        } finally {
            reader.releaseLock();
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
