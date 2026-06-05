import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { BubbleMessage, BubbleTaskItem } from '../types';
import { bubbleStyleToCssVars, loadBubbleStyle } from '../utils/bubbleStyle';
import { getSkinBubblePositionAdjust } from '../utils/skinLayoutOverride';
import type { PetVisualBounds } from '../utils/skinLayout';
import './Bubble.css';

export interface BubbleProps {
    /** 角色可视区域（画布坐标），用于动态定位 */
    petAnchor?: PetVisualBounds | null;
    skinId?: string;
    styleVersion?: number;
}

/**
 * 气泡组件暴露的方法
 */
export interface BubbleRef {
    showMessage: (message: BubbleMessage) => void;
    hideMessage: () => void;
    showTodoPanel: (tasks: BubbleTaskItem[]) => void;
    /** 开始 AI 流式气泡（duration=0，不自动消失） */
    startStream: (type?: BubbleMessage['type']) => void;
    /** 流式更新当前气泡文本（不重建气泡） */
    updateStreamText: (text: string) => void;
    /** 结束流式并设置自动消失时长（默认 8 秒） */
    finalizeStream: (finalText: string, duration?: number) => void;
}

/**
 * 气泡组件
 * 支持：普通文字气泡、提醒气泡（带操作按钮）、今日任务卡片气泡
 */
const Bubble = forwardRef<BubbleRef, BubbleProps>(({
    petAnchor = null,
    skinId = '',
    styleVersion = 0,
}, ref): JSX.Element => {
    /** 当前显示的消息 */
    const [currentMessage, setCurrentMessage] = useState<BubbleMessage | null>(null);

    /** 消息队列 */
    const queueRef = useRef<BubbleMessage[]>([]);

    /** 是否正在显示 */
    const isShowingRef = useRef(false);

    /** 自动消失定时器 */
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** 任务列表本地状态（用于 todo 气泡内实时勾选） */
    const [localTasks, setLocalTasks] = useState<BubbleTaskItem[]>([]);

    /** 快捷输入框显示状态 */
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddText, setQuickAddText] = useState('');
    const quickAddRef = useRef<HTMLInputElement>(null);

    /** 流式文本状态（打字机效果） */
    const [streamText, setStreamText] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    /**
     * 处理队列中的下一条消息
     */
    const processQueue = useCallback(() => {
        if (queueRef.current.length === 0) {
            isShowingRef.current = false;
            setCurrentMessage(null);
            setLocalTasks([]);
            return;
        }

        const message = queueRef.current.shift()!;
        isShowingRef.current = true;
        setCurrentMessage(message);

        // todo 类型：同步 localTasks
        if (message.tasks) {
            setLocalTasks(message.tasks);
        } else {
            setLocalTasks([]);
        }

        // duration 为 0 表示不自动消失
        if (message.duration > 0) {
            timerRef.current = setTimeout(() => {
                processQueue();
            }, message.duration);
        }
    }, []);

    /**
     * 显示新消息（加入队列）
     */
    const showMessage = useCallback((message: BubbleMessage) => {
        setIsStreaming(false);
        setStreamText(null);
        queueRef.current.push(message);

        if (!isShowingRef.current) {
            processQueue();
        }
    }, [processQueue]);

    /**
     * 立即隐藏当前消息并处理队列
     */
    const hideMessage = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        isShowingRef.current = false;
        setIsStreaming(false);
        setStreamText(null);
        setCurrentMessage(null);
        setLocalTasks([]);
        queueRef.current = [];
        setShowQuickAdd(false);
        setQuickAddText('');
    }, []);

    /**
     * 显示今日任务面板
     */
    const showTodoPanel = useCallback((tasks: BubbleTaskItem[]) => {
        const msg: BubbleMessage = {
            text: tasks.length > 0
                ? `今天还有 ${tasks.filter(t => t.status !== 'completed').length} 件事 📋`
                : '今天没有任务，好好休息~ 🎉',
            duration: 0,
            type: 'todo',
            tasks
        };
        // 清空队列直接展示
        queueRef.current = [];
        if (timerRef.current) clearTimeout(timerRef.current);
        isShowingRef.current = true;
        setIsStreaming(false);
        setStreamText(null);
        setCurrentMessage(msg);
        setLocalTasks(tasks);
    }, []);

    /**
     * 开始 AI 流式气泡
     */
    const startStream = useCallback((type: BubbleMessage['type'] = 'emotion') => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        queueRef.current = [];
        isShowingRef.current = true;
        setIsStreaming(true);
        setStreamText('…');
        setCurrentMessage({ text: '…', duration: 0, type });
    }, []);

    /**
     * 流式更新当前气泡文本（不重建气泡）
     * 用于 AI streaming 实时显示
     */
    const updateStreamText = useCallback((text: string) => {
        if (!isShowingRef.current) return;
        setIsStreaming(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setStreamText(text);
        setCurrentMessage(prev => prev ? { ...prev, text, duration: 0 } : null);
    }, []);

    /**
     * 结束流式输出，并启动自动消失计时
     */
    const finalizeStream = useCallback((finalText: string, duration = 8000) => {
        setIsStreaming(false);
        setStreamText(null);
        setCurrentMessage(prev => prev ? { ...prev, text: finalText, duration } : null);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (duration > 0) {
            timerRef.current = setTimeout(() => {
                processQueue();
            }, duration);
        }
    }, [processQueue]);

    /**
     * 暴露方法给父组件
     */
    useImperativeHandle(ref, () => ({
        showMessage,
        hideMessage,
        showTodoPanel,
        startStream,
        updateStreamText,
        finalizeStream,
    }));

    /**
     * 处理 action 按钮点击
     */
    const handleAction = useCallback(async (action: string) => {
        if (!currentMessage || !window.petAPI) return;

        if (action === 'dismiss') {
            hideMessage();
            return;
        }

        if (action.startsWith('snooze_') && currentMessage.reminderId) {
            const minutes = parseInt(action.replace('snooze_', ''), 10);
            await window.petAPI.reminderSnooze(currentMessage.reminderId, minutes);
            hideMessage();
            return;
        }

        // 处理完成任务（complete_xxxxx 格式）
        if (action.startsWith('complete_') && window.petAPI.taskToggleStatus) {
            const taskId = action.replace('complete_', '');
            await window.petAPI.taskToggleStatus(taskId);
            hideMessage();
            return;
        }

        if (action === 'quick_add') {
            setShowQuickAdd(true);
            setTimeout(() => quickAddRef.current?.focus(), 50);
            return;
        }
    }, [currentMessage, hideMessage]);

    /**
     * 切换任务完成状态（todo 气泡内）
     */
    const handleToggleTask = useCallback(async (taskId: string) => {
        if (!window.petAPI) return;

        // 乐观更新 UI
        setLocalTasks(prev => prev.map(t => {
            if (t.id !== taskId) return t;
            const newStatus = t.status === 'completed' ? 'todo' : 'completed';
            return { ...t, status: newStatus };
        }));

        await window.petAPI.taskToggleStatus(taskId);
    }, []);

    /**
     * 快速添加任务
     */
    const handleQuickAdd = useCallback(async () => {
        if (!quickAddText.trim() || !window.petAPI) return;
        await window.petAPI.taskQuickAdd(quickAddText.trim());
        setQuickAddText('');
        setShowQuickAdd(false);
    }, [quickAddText]);

    /**
     * 监听主进程事件
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsubBubble = window.petAPI.onShowBubble((message) => {
            showMessage(message as BubbleMessage);
        });

        const unsubHide = window.petAPI.onHideBubble(() => {
            hideMessage();
        });

        return () => {
            unsubBubble();
            unsubHide();
        };
    }, [showMessage, hideMessage]);

    /**
     * 清理定时器
     */
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const typeClass = currentMessage ? `bubble-${currentMessage.type}` : '';
    const isElevated = currentMessage?.type === 'todo'
        || !!currentMessage?.tasks?.length
        || !!currentMessage?.actions?.length;

    const bubbleStyle = useMemo(() => loadBubbleStyle(), [styleVersion]);
    const skinPos = useMemo(() => getSkinBubblePositionAdjust(skinId), [skinId, styleVersion]);

    const containerStyle = useMemo(() => {
        const gap = skinPos.gapAboveHead ?? bubbleStyle.gapAboveHead;
        const ox = bubbleStyle.offsetX + skinPos.offsetX;
        const oy = bubbleStyle.offsetY + skinPos.offsetY;

        if (petAnchor) {
            return {
                left: petAnchor.centerX + ox,
                top: petAnchor.headTop - gap + oy,
            } as React.CSSProperties;
        }

        return {
            left: `calc(50% + ${ox}px)`,
            top: 36 + oy,
        } as React.CSSProperties;
    }, [petAnchor, bubbleStyle, skinPos]);

    const cssVars = useMemo(() => bubbleStyleToCssVars(bubbleStyle), [bubbleStyle]);

    const containerClass = [
        'bubble-container',
        currentMessage ? 'bubble-visible' : '',
        isElevated ? 'bubble-elevated' : '',
        bubbleStyle.enableFloat ? 'bubble-float-enabled' : '',
    ].filter(Boolean).join(' ');

    const bubbleClass = [
        'bubble',
        typeClass,
        bubbleStyle.showTail ? '' : 'bubble-no-tail',
    ].filter(Boolean).join(' ');

    /** 普通气泡点击关闭（只对无 actions 且无 tasks 的生效） */
    const handleBubbleClick = useCallback(() => {
        if (!currentMessage) return;
        if (currentMessage.actions || currentMessage.tasks) return; // 有按钮/任务时不关闭
        hideMessage();
    }, [currentMessage, hideMessage]);

    return (
        <div
            className={containerClass}
            style={{ ...containerStyle, ...cssVars }}
        >
            {currentMessage && (
                <div
                    className={bubbleClass}
                    onClick={handleBubbleClick}
                >
                    {/* 关闭按钮（有 actions 或 tasks 时显示） */}
                    {(currentMessage.actions || currentMessage.tasks) && (
                        <button className="bubble-close" onClick={hideMessage}>✕</button>
                    )}

                    {/* 消息文本 */}
                    <div className={`bubble-text ${isStreaming ? 'streaming' : ''}`}>
                        {streamText ?? currentMessage.text}
                        {isStreaming && <span className="stream-cursor" />}
                    </div>

                    {/* 内嵌任务列表（todo 气泡） */}
                    {currentMessage.type === 'todo' && localTasks.length > 0 && (
                        <div className="bubble-task-list">
                            {localTasks.map(task => (
                                <div
                                    key={task.id}
                                    className={`bubble-task-item ${task.status === 'completed' ? 'completed' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}
                                >
                                    <span className={`bubble-task-check ${task.status === 'completed' ? 'checked' : ''}`}>
                                        {task.status === 'completed' ? '✓' : '○'}
                                    </span>
                                    <span className="bubble-task-title">{task.title}</span>
                                    {task.priority === 'high' && (
                                        <span className="bubble-task-priority high">!</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 快速添加输入框 */}
                    {showQuickAdd && (
                        <div className="bubble-quick-add" onClick={e => e.stopPropagation()}>
                            <input
                                ref={quickAddRef}
                                className="bubble-quick-input"
                                placeholder="输入任务标题..."
                                value={quickAddText}
                                onChange={e => setQuickAddText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleQuickAdd();
                                    if (e.key === 'Escape') { setShowQuickAdd(false); setQuickAddText(''); }
                                }}
                            />
                            <button className="bubble-quick-submit" onClick={handleQuickAdd}>添加</button>
                        </div>
                    )}

                    {/* 操作按钮区 */}
                    {currentMessage.actions && currentMessage.actions.length > 0 && (
                        <div className="bubble-actions">
                            {currentMessage.actions.map(a => (
                                <button
                                    key={a.action}
                                    className={`bubble-action-btn bubble-action-${a.style || 'secondary'}`}
                                    onClick={(e) => { e.stopPropagation(); handleAction(a.action); }}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* todo 气泡底部操作 */}
                    {currentMessage.type === 'todo' && (
                        <div className="bubble-actions">
                            <button
                                className="bubble-action-btn bubble-action-primary"
                                onClick={(e) => { e.stopPropagation(); handleAction('quick_add'); }}
                            >
                                + 加一条
                            </button>
                            <button
                                className="bubble-action-btn bubble-action-secondary"
                                onClick={hideMessage}
                            >
                                关闭
                            </button>
                        </div>
                    )}

                    <div className="bubble-tail" />
                </div>
            )}
        </div>
    );
});

Bubble.displayName = 'Bubble';

export default Bubble;
