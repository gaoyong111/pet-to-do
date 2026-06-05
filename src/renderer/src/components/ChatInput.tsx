/**
 * ChatInput — 右键对话输入框（底部整行）
 *
 *   1. AI 对话 — 流式输出到气泡，上下文来自 useChatStore
 *   2. 内建命令 — /task /remind /todo /help
 *   3. 自然语言意图 — 「帮我记个任务」→ /task
 *   4. 快捷键 — Enter 发送，Shift+Enter 换行，Escape 关闭
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getAIChatService, loadAIConfig, ChatAbortedError } from '../utils/aiChatService';
import { buildAIContext } from '../utils/chatContext';
import { detectChatIntent } from '../utils/chatIntent';
import { getRandomDialogue } from '../i18n';
import { useChatStore } from '../store/useChatStore';
import './ChatInput.css';

export interface ChatInputProps {
    visible: boolean;
    onClose: () => void;
    onCommand: (command: string, args: string) => void;
    onBubble: (text: string, type?: 'emotion' | 'info' | 'system') => void;
    onStreamStart?: () => void;
    onBubbleStream?: (text: string) => void;
    onStreamEnd?: (text: string, duration?: number) => void;
}

const COMMANDS: Array<{ cmd: string; desc: string; usage: string }> = [
    { cmd: '/task',   desc: '创建任务',      usage: '/task 明天交报告' },
    { cmd: '/remind', desc: '创建提醒',      usage: '/remind 下午3点开会' },
    { cmd: '/todo',   desc: '今日任务',      usage: '/todo' },
    { cmd: '/help',   desc: '帮助',          usage: '/help' },
];

const AI_BUBBLE_DURATION = 8000;

function parseCommand(text: string): { command: string; args: string } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return null;
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return { command: trimmed.toLowerCase(), args: '' };
    return {
        command: trimmed.slice(0, spaceIdx).toLowerCase(),
        args: trimmed.slice(spaceIdx + 1).trim(),
    };
}

const MAX_HEIGHT = 100;

export default function ChatInput({
    visible, onClose, onCommand, onBubble, onStreamStart, onBubbleStream, onStreamEnd,
}: ChatInputProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const streamTextRef = useRef('');

    const aiEnabled = useMemo(() => {
        const cfg = loadAIConfig();
        if (!cfg.enabled) return false;
        const svc = getAIChatService();
        svc.setConfig(cfg);
        return svc.isAvailable();
    }, [visible]);

    const placeholder = aiEnabled
        ? '说点什么... Enter 发送（AI 已启用）'
        : '说点什么... Enter 发送（AI 未启用，/help 查看命令）';

    useEffect(() => {
        if (visible) {
            useChatStore.getState().loadFromStorage();
            setText('');
            setLoading(false);
            streamTextRef.current = '';
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const handler = (e: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const timer = setTimeout(() => document.addEventListener('mousedown', handler), 150);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
        };
    }, [visible, onClose]);

    const autoResize = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
    }, []);

    const handleStop = useCallback(() => {
        getAIChatService().abortChat();
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        setText('');
        setLoading(true);
        streamTextRef.current = '';

        try {
            const cmd = parseCommand(trimmed);
            if (cmd) {
                useChatStore.getState().addMessage({
                    role: 'user', content: trimmed, source: 'command',
                });

                if (cmd.command === '/help') {
                    const helpText = COMMANDS.map(c => `${c.cmd.padEnd(8)} ${c.desc}`).join('\n');
                    onBubble(helpText, 'system');
                    useChatStore.getState().addMessage({
                        role: 'pet', content: helpText, source: 'system',
                    });
                } else if (['/task', '/remind', '/todo'].includes(cmd.command)) {
                    onCommand(cmd.command, cmd.args);
                }
                return;
            }

            const intent = detectChatIntent(trimmed);
            if (intent) {
                useChatStore.getState().addMessage({
                    role: 'user', content: trimmed, source: 'command',
                });
                onCommand(intent.command, intent.args);
                return;
            }

            useChatStore.getState().addMessage({
                role: 'user', content: trimmed, source: 'ai',
            });

            const aiConfig = loadAIConfig();
            const aiService = getAIChatService();
            aiService.setConfig(aiConfig);

            if (aiConfig.enabled && aiService.isAvailable()) {
                const context = buildAIContext(useChatStore.getState().messages);
                onStreamStart?.();

                try {
                    const result = await aiService.chatStream(context, (chunk) => {
                        streamTextRef.current = chunk;
                        onBubbleStream?.(chunk);
                    });
                    if (result?.trim()) {
                        const finalText = result.trim();
                        useChatStore.getState().addMessage({
                            role: 'assistant', content: finalText, source: 'ai',
                        });
                        onStreamEnd?.(finalText, AI_BUBBLE_DURATION);
                    } else {
                        const phrase = getRandomDialogue('chatFallback') || getRandomDialogue('idle') || '唔...';
                        onStreamEnd?.(phrase, AI_BUBBLE_DURATION);
                        useChatStore.getState().addMessage({
                            role: 'pet', content: phrase, source: 'phrase',
                        });
                    }
                } catch (aiErr) {
                    if (aiErr instanceof ChatAbortedError || (aiErr as Error).message === '已停止生成') {
                        const partial = streamTextRef.current.trim();
                        if (partial) {
                            const stoppedText = `${partial}（已停止）`;
                            useChatStore.getState().addMessage({
                                role: 'assistant', content: stoppedText, source: 'ai',
                            });
                            onStreamEnd?.(stoppedText, 5000);
                        } else {
                            onStreamEnd?.('已停止', 3000);
                        }
                        return;
                    }
                    const reason = (aiErr as Error).message || '连接失败';
                    console.error('[ChatInput] AI 失败:', reason);
                    const phrase = getRandomDialogue('chatFallback') || getRandomDialogue('idle') || '嘛...';
                    const errText = `${phrase}\n（${reason}）`;
                    onStreamEnd?.(errText, 5000);
                    useChatStore.getState().addMessage({
                        role: 'pet', content: `${phrase}（${reason}）`, source: 'system',
                    });
                }
            } else {
                const phrase = getRandomDialogue('chatFallback') || getRandomDialogue('idle') || '嗯嗯...';
                onBubble(phrase, 'emotion');
                useChatStore.getState().addMessage({
                    role: 'pet', content: phrase, source: 'phrase',
                });
            }
        } catch (err) {
            console.error('[ChatInput] 发送失败:', err);
            onBubble('出了点问题...', 'system');
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [text, loading, onCommand, onBubble, onStreamStart, onBubbleStream, onStreamEnd]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Escape') onClose();
    }, [handleSend, onClose]);

    if (!visible) return null;

    return (
        <div className="chatinput-bar" ref={barRef}>
            <div className="chatinput-hints">
                {COMMANDS.map(c => (
                    <span
                        key={c.cmd}
                        className="chatinput-hint"
                        onClick={() => { setText(c.usage); inputRef.current?.focus(); }}
                        title={c.desc}
                    >
                        {c.cmd}
                    </span>
                ))}
                <span className={`chatinput-ai-badge ${aiEnabled ? 'on' : 'off'}`}>
                    {aiEnabled ? 'AI' : '离线'}
                </span>
            </div>

            <div className="chatinput-input-row">
                <textarea
                    ref={inputRef}
                    className="chatinput-textarea"
                    value={text}
                    onChange={e => { setText(e.target.value); autoResize(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={1}
                    disabled={loading}
                />
                {loading ? (
                    <button
                        className="chatinput-stop"
                        onClick={handleStop}
                        title="停止生成"
                    >
                        ■
                    </button>
                ) : (
                    <button
                        className="chatinput-send"
                        onClick={handleSend}
                        disabled={!text.trim()}
                    >
                        ↑
                    </button>
                )}
            </div>
        </div>
    );
}
