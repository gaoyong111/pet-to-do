/**
 * ChatInput — 右键对话输入框（底部整行）
 * 
 * 替换旧的快捷添加任务，提供：
 *   1. 自由对话 — 接入 AI（在线 streaming / 离线短语池）
 *   2. 内建命令 — /task /remind /todo /help
 *   3. 快捷键 — Enter 发送，Shift+Enter 换行，Escape 关闭
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { getAIChatService, ChatMessage, loadAIConfig } from '../utils/aiChatService';
import { getRandomDialogue } from '../i18n';
import { useChatStore } from '../store/useChatStore';
import './ChatInput.css';

export interface ChatInputProps {
    visible: boolean;
    onClose: () => void;
    onCommand: (command: string, args: string) => void;
    onBubble: (text: string, type?: 'emotion' | 'info' | 'system') => void;
    onBubbleStream?: (text: string) => void;
    getHistory?: () => ChatMessage[];
    addToHistory?: (msg: ChatMessage) => void;
}

const COMMANDS: Array<{ cmd: string; desc: string; usage: string }> = [
    { cmd: '/task',   desc: '创建任务',      usage: '/task 明天交报告' },
    { cmd: '/remind', desc: '创建提醒',      usage: '/remind 下午3点开会' },
    { cmd: '/todo',   desc: '今日任务',      usage: '/todo' },
    { cmd: '/help',   desc: '帮助',          usage: '/help' },
];

function parseCommand(text: string): { command: string; args: string } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return null;
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return { command: trimmed.toLowerCase(), args: '' };
    return {
        command: trimmed.slice(0, spaceIdx).toLowerCase(),
        args: trimmed.slice(spaceIdx + 1).trim()
    };
}

/** 4 行高度（14px * 1.5 * 4 + padding） */
const MAX_HEIGHT = 100;

export default function ChatInput({
    visible, onClose, onCommand, onBubble, onBubbleStream, getHistory, addToHistory,
}: ChatInputProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible) {
            setText('');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [visible]);

    // 点击外部关闭
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

    // 自动调整高度
    const autoResize = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        setText('');
        setLoading(true);

        try {
            const cmd = parseCommand(trimmed);
            if (cmd) {
                // 保存命令到历史
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

            const history = getHistory?.() || [];
            const userMsg: ChatMessage = { role: 'user', content: trimmed };
            addToHistory?.(userMsg);

            // 保存用户消息到历史 store
            useChatStore.getState().addMessage({
                role: 'user', content: trimmed, source: 'ai',
            });

            const aiConfig = loadAIConfig();
            if (aiConfig.enabled) {
                const aiService = getAIChatService();
                aiService.setConfig(aiConfig);
                // 先显示等待状态
                onBubble('🤔', 'emotion');
                try {
                    const result = await aiService.chatStream([...history, userMsg], (chunk) => {
                        onBubbleStream?.(chunk);
                    });
                    if (result) {
                        addToHistory?.({ role: 'assistant', content: result });
                        // 保存 AI 回复到历史 store
                        useChatStore.getState().addMessage({
                            role: 'assistant', content: result, source: 'ai',
                        });
                    } else {
                        // AI 返回空内容
                        const phrase = getRandomDialogue('idle') || '唔...不知道该说什么';
                        onBubble(`🤔 ${phrase}`, 'emotion');
                        useChatStore.getState().addMessage({
                            role: 'pet', content: phrase, source: 'phrase',
                        });
                    }
                } catch (aiErr) {
                    // AI 连接/响应失败 → 显示具体原因 + 回退短语
                    const reason = (aiErr as Error).message || '连接失败';
                    console.error('[ChatInput] AI 失败:', reason);
                    const phrase = getRandomDialogue('idle') || '嘛，说点什么好呢...';
                    onBubble(`${phrase}\n（${reason}）`, 'system');
                    useChatStore.getState().addMessage({
                        role: 'pet', content: `${phrase}（${reason}）`, source: 'system',
                    });
                }
            } else {
                const phrase = getRandomDialogue('idle') || '嗯嗯...';
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
    }, [text, loading, onCommand, onBubble, onBubbleStream, getHistory, addToHistory]);

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
            {/* 指令提示 */}
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
            </div>

            {/* 输入行 */}
            <div className="chatinput-input-row">
                <textarea
                    ref={inputRef}
                    className="chatinput-textarea"
                    value={text}
                    onChange={e => { setText(e.target.value); autoResize(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="说点什么... Enter 发送"
                    rows={1}
                    disabled={loading}
                />
                <button
                    className={`chatinput-send ${loading ? 'loading' : ''}`}
                    onClick={handleSend}
                    disabled={loading || !text.trim()}
                >
                    {loading ? '…' : '↑'}
                </button>
            </div>
        </div>
    );
}
