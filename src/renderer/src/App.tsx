import { useState, useEffect, useCallback, useRef } from 'react';
import { PetState } from './types';
import { StateMachine } from './state/stateMachine';
import Pet from './components/Pet';
import type { PetSizeChangePayload } from './components/Live2DPet';
import Pomodoro from './components/Pomodoro';
import ReminderApp from './components/ReminderApp';
import SettingsApp from './components/SettingsApp';
import Bubble, { BubbleRef } from './components/Bubble';
import ChatInput from './components/ChatInput';
import ChatHistory from './components/ChatHistory';
import { ChatHistoryLauncher } from './components/ChatHistoryLauncher';
import TodoApp from './components/TodoApp';
import ErrorBoundary from './components/TodoApp/ErrorBoundary';
import { TodoLauncher } from './components/TodoLauncher';
import { mergeMsTasks } from './components/TodoApp/utils/msSync';
import { isInTodayView } from './components/TodoApp/utils/taskFilter';
import { useTodoStore } from './components/TodoApp/store/useTodoStore';
import { useChatStore, initChatStorageSync } from './store/useChatStore';
import { parseReminderArgs } from './utils/reminderParse';
import usePetEvents from './hooks/usePetEvents';
import { getLocale, setLocale, subscribeLocaleChange, Locale, t } from './i18n';
import { getDialogueManager } from './utils/dialogueSystem';
import { SKIN_GROUPS } from './constants/skinGroups';
import { loadSkinPreference, saveSkinPreference, findGroupForSkin } from './utils/skinPreference';
import { initSkinLayoutSync } from './utils/skinLayoutOverride';
import { initBubbleStyleSync } from './utils/bubbleStyle';
import { setWindowScale } from './utils/skinLayout';
import type { PetVisualBounds } from './utils/skinLayout';
import './App.css';

function getStateLabels(): Record<string, string> {
    return {
        idle: t('state.idle'),
        working: t('state.working'),
        happy: t('state.happy'),
        sad: t('state.sad'),
        sleeping: t('state.sleeping'),
        tap: t('state.tap'),
        angry: t('state.angry'),
        shy: t('state.shy'),
        surprised: t('state.surprised')
    };
}

function App(): JSX.Element {
    const initialSkin = loadSkinPreference();
    const [stateMachine] = useState(() => new StateMachine('idle'));
    const [currentState, setCurrentState] = useState<PetState>('idle');
    const [currentGroup, setCurrentGroup] = useState(initialSkin.groupId);
    const [currentSkin, setCurrentSkin] = useState(initialSkin.skinId);
    const [supportedStates, setSupportedStates] = useState<string[]>(['idle', 'working', 'happy', 'sad', 'sleeping', 'shy', 'angry', 'surprised']);
    const [stateLabels, setStateLabels] = useState<Record<string, string>>(getStateLabels());
    const [currentLocale, setCurrentLocale] = useState<Locale>(getLocale());
    const [showPomodoro, setShowPomodoro] = useState(() => {
        const saved = localStorage.getItem('pet-show-pomodoro');
        return saved !== null ? saved === 'true' : true;
    });
    const [showReminder, setShowReminder] = useState(() => {
        const saved = localStorage.getItem('pet-show-reminder');
        return saved !== null ? saved === 'true' : true;
    });
    const [showTodoLauncher, setShowTodoLauncher] = useState(() => {
        const saved = localStorage.getItem('pet-show-todolauncher');
        return saved !== null ? saved === 'true' : true;
    });
    const [showChatHistoryLauncher, setShowChatHistoryLauncher] = useState(() => {
        const saved = localStorage.getItem('pet-show-chathistory');
        return saved !== null ? saved === 'true' : true;
    });
    /** 激活的提醒数量 */
    const [reminderCount, setReminderCount] = useState(0);
    /** 是否在图标上显示提醒数量 */
    const [showReminderBadge, setShowReminderBadge] = useState(() => {
        const saved = localStorage.getItem('pet-show-reminder-badge');
        return saved !== null ? saved === 'true' : true;
    });
    const [windowSize, setWindowSize] = useState({ width: 400, height: 520 });
    const windowSizeRef = useRef({ width: 400, height: 520 });
    const skinBaseSizeRef = useRef({ width: 400, height: 520 });
    const [layoutVersion, setLayoutVersion] = useState(0);
    const [bubbleStyleVersion, setBubbleStyleVersion] = useState(0);
    const [petAnchor, setPetAnchor] = useState<PetVisualBounds | null>(null);
    const [currentRoute, setCurrentRoute] = useState(window.location.hash.slice(1) || '');
    /** 任务数量（用于设置面板显示） */
    const [taskCount, setTaskCount] = useState(0);
    /** 右键对话输入框状态 */
    const [showChatInput, setShowChatInput] = useState(false);
    const hasShownGreeting = useRef(false);
    const bubbleRef = useRef<BubbleRef>(null);
    const appRef = useRef<HTMLDivElement>(null);
    const resizeState = useRef({
        isResizing: false,
        resizeType: '',
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startLeft: 0,
        startTop: 0
    });

    const currentGroupData = SKIN_GROUPS.find(group => group.id === currentGroup);
    const currentSkins = currentGroupData?.skins || [];

    const loadSkinStates = useCallback(async (skinId: string) => {
        try {
            const manifestPath = `/skins/${skinId}/manifest.json`;
            const response = await fetch(manifestPath);
            if (response.ok) {
                const manifest = await response.json();
                const states = manifest.supportedStates || ['idle'];
                setSupportedStates(states);
                
                const labels = manifest.stateLabels || getStateLabels();
                setStateLabels(labels);
            }
        } catch (error) {
            console.error('加载皮肤状态失败:', error);
        }
    }, []);

    usePetEvents(stateMachine);

    /**
     * 初始化对话系统
     */
    useEffect(() => {
        const dialogueManager = getDialogueManager();
        
        dialogueManager.setShowBubbleCallback((text, type, duration) => {
            if (bubbleRef.current) {
                bubbleRef.current.showMessage({ text, type, duration });
            }
        });
        
        dialogueManager.startScheduledDialogues();
        
        return () => {
            dialogueManager.destroy();
        };
    }, []);

    /**
     * 加载对话历史 + 跨窗口同步（历史窗口清空后主窗口也能感知）
     */
    useEffect(() => {
        useChatStore.getState().loadFromStorage();
        return initChatStorageSync();
    }, []);

    /** 视图布局覆盖：设置窗口修改后主窗口热更新 */
    useEffect(() => {
        return initSkinLayoutSync(() => {
            setLayoutVersion(v => v + 1);
            setBubbleStyleVersion(v => v + 1);
        });
    }, []);

    /** 气泡样式：设置窗口修改后主窗口热更新 */
    useEffect(() => {
        return initBubbleStyleSync(() => {
            setBubbleStyleVersion(v => v + 1);
        });
    }, []);

    const handlePetBoundsChange = useCallback((bounds: PetVisualBounds | null) => {
        setPetAnchor(bounds);
    }, []);

    /**
     * 显示问候语（仅一次）
     */
    useEffect(() => {
        if (!hasShownGreeting.current) {
            hasShownGreeting.current = true;
            setTimeout(() => {
                const dialogueManager = getDialogueManager();
                dialogueManager.showGreeting();
            }, 1000);
        }
    }, []);

    /**
     * 监听状态变化并更新对话系统
     */
    useEffect(() => {
        const dialogueManager = getDialogueManager();
        dialogueManager.setCurrentState(currentState);
    }, [currentState]);

    /**
     * 订阅语言变化
     */
    useEffect(() => {
        const unsubscribe = subscribeLocaleChange((locale) => {
            setCurrentLocale(locale);
            setStateLabels(getStateLabels());
        });
        return unsubscribe;
    }, []);

    /**
     * 监听路由变化
     */
    useEffect(() => {
        const handleHashChange = () => {
            setCurrentRoute(window.location.hash.slice(1) || '');
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    /**
     * 获取任务数量
     */
    useEffect(() => {
        const fetchTaskCount = async () => {
            if (!window.petAPI) return;
            try {
                const tasks = await window.petAPI.taskGetAll();
                const pendingCount = tasks.filter((t: any) => t.status === 'pending').length;
                setTaskCount(pendingCount);
            } catch (e) {
                console.error('获取任务数量失败', e);
            }
        };
        fetchTaskCount();
        // 每30秒刷新一次任务数量
        const timer = setInterval(fetchTaskCount, 30000);
        return () => clearInterval(timer);
    }, []);

    /**
     * 启动时自动同步 MS To Do
     */
    useEffect(() => {
        const autoSync = async () => {
            if (!window.petAPI?.msTodoStatus || !window.petAPI?.msTodoPull || !window.petAPI?.taskGetAll || !window.petAPI?.taskSetAll) return;

            try {
                const status = await window.petAPI.msTodoStatus();
                if (!status.authorized) return;

                const result = await window.petAPI.msTodoPull();
                if (result.error || !result.tasks?.length) return;

                // 获取本地现有任务
                const localTasks = await window.petAPI.taskGetAll();

                // 合并 MS 任务与本地任务
                const merged = mergeMsTasks(localTasks, result.tasks);

                // 写回主进程持久化
                await window.petAPI.taskSetAll(merged);

                // 同步到 store（如果 Todo 窗口后续打开，能拿到最新数据）
                useTodoStore.getState().setTasks(merged);

                if (result.lists?.length) {
                    useTodoStore.getState().setLists(result.lists);
                    const msList = result.lists.find((l: any) => l.microsoftToDoId);
                    if (msList) {
                        useTodoStore.getState().setDefaultMsListId(msList.id);
                    }
                }

                console.log(`[AutoSync] 同步完成，${merged.length} 条任务`);
            } catch (e) {
                console.error('[AutoSync] 同步失败:', e);
            }
        };

        autoSync();
    }, []);

    useEffect(() => {
        loadSkinStates(currentSkin);
    }, [loadSkinStates, currentSkin]);

    useEffect(() => {
        const unsubscribe = stateMachine.subscribeState((newState: PetState) => {
            setCurrentState(newState);
        });

        const handleSkinSwitch = (skinId: string) => {
            setCurrentSkin(skinId);
            const groupId = findGroupForSkin(skinId);
            if (groupId) {
                setCurrentGroup(groupId);
                saveSkinPreference(groupId, skinId);
            }
            loadSkinStates(skinId);
        };

        const unsubscribeSkinSwitch = window.petAPI.onSkinSwitch(handleSkinSwitch);

        // 监听来自设置窗口的状态变更
        if (window.petAPI) {
            const handleSetPetState = (state: PetState) => {
                stateMachine.transition(state);
            };
            window.petAPI.on('set-pet-state', handleSetPetState);

            const handleSetLocale = (locale: Locale) => {
                setLocale(locale);
            };
            window.petAPI.on('set-locale', handleSetLocale);

            const handlePomodoroVisibility = (visible: boolean) => {
                setShowPomodoro(visible);
            };
            window.petAPI.on('pomodoro-visibility', handlePomodoroVisibility);

            const handleReminderVisibility = (visible: boolean) => {
                setShowReminder(visible);
            };
            window.petAPI.on('reminder-visibility', handleReminderVisibility);

            const handleTodoLauncherVisibility = (visible: boolean) => {
                setShowTodoLauncher(visible);
            };
            window.petAPI.on('todolauncher-visibility', handleTodoLauncherVisibility);

            const handleChatHistoryVisibility = (visible: boolean) => {
                setShowChatHistoryLauncher(visible);
            };
            window.petAPI.on('chat-history-visibility', handleChatHistoryVisibility);

            const handleReminderBadgeVisibility = (visible: boolean) => {
                setShowReminderBadge(visible);
            };
            window.petAPI.on('reminder-badge-visibility', handleReminderBadgeVisibility);

            const handleSkinLayoutChange = () => {
                setLayoutVersion(v => v + 1);
                setBubbleStyleVersion(v => v + 1);
            };
            window.petAPI.on('skin-layout-change', handleSkinLayoutChange);

            const handleBubbleStyleChange = () => {
                setBubbleStyleVersion(v => v + 1);
            };
            window.petAPI.on('bubble-style-change', handleBubbleStyleChange);

            return () => {
                unsubscribe();
                unsubscribeSkinSwitch();
                window.petAPI.removeListener('set-pet-state', handleSetPetState);
                window.petAPI.removeListener('set-locale', handleSetLocale);
                window.petAPI.removeListener('pomodoro-visibility', handlePomodoroVisibility);
                window.petAPI.removeListener('reminder-visibility', handleReminderVisibility);
                window.petAPI.removeListener('todolauncher-visibility', handleTodoLauncherVisibility);
                window.petAPI.removeListener('chat-history-visibility', handleChatHistoryVisibility);
                window.petAPI.removeListener('reminder-badge-visibility', handleReminderBadgeVisibility);
                window.petAPI.removeListener('skin-layout-change', handleSkinLayoutChange);
                window.petAPI.removeListener('bubble-style-change', handleBubbleStyleChange);
            };
        }

        return () => {
            unsubscribe();
            unsubscribeSkinSwitch();
        };
    }, [stateMachine, loadSkinStates]);

    /**
     * 定时获取激活提醒数量，显示在图标徽标上
     */
    useEffect(() => {
        const fetchReminderCount = async () => {
            if (!window.petAPI) return;
            try {
                const reminders = await window.petAPI.reminderGetAll();
                const active = reminders.filter((r: any) => r.enabled).length;
                setReminderCount(active);
            } catch {
                // 静默失败
            }
        };

        fetchReminderCount();
        const interval = setInterval(fetchReminderCount, 30000);
        return () => clearInterval(interval);
    }, []);

    /**
     * 左键桌宠：manifest 驱动动作 + 气泡（manifest 文案优先，否则 i18n tap 池）
     */
    const handlePetInteract = useCallback((info: { reaction: string; bubbleText: string }) => {
        if (!info.bubbleText || !bubbleRef.current) return;
        bubbleRef.current.showMessage({ text: info.bubbleText, type: 'emotion', duration: 3200 });
        useChatStore.getState().addMessage({ role: 'pet', content: info.bubbleText, source: 'phrase' });
    }, []);

    /**
     * 展示今日任务气泡（关闭底部输入栏，避免遮挡）
     */
    const openTodoPanel = useCallback(async () => {
        if (!window.petAPI || !bubbleRef.current) return;
        setShowChatInput(false);
        try {
            const tasks = await window.petAPI.taskGetAll();
            const todayTasks = tasks.filter((t: any) => isInTodayView(t));
            const bubbleTasks = todayTasks.slice(0, 6).map((t: any) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority
            }));
            bubbleRef.current.showTodoPanel(bubbleTasks);
            return todayTasks;
        } catch (e) {
            console.error('获取今日任务失败', e);
            return null;
        }
    }, []);

    /**
     * 双击桌宠：展示今日任务气泡面板
     */
    const handlePetDoubleClick = useCallback(async () => {
        await openTodoPanel();
    }, [openTodoPanel]);

    /**
     * 右键桌宠：打开对话输入框
     */
    const handlePetContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowChatInput(true);
    }, []);

    /**
     * 对话命令处理（/task /remind /todo）
     */

    const handleChatCommand = useCallback(async (command: string, args: string) => {
        if (!window.petAPI) return;
        if (command === '/todo') {
            try {
                const todayTasks = await openTodoPanel();
                if (!todayTasks) {
                    bubbleRef.current?.showMessage({ text: '获取任务失败', type: 'system', duration: 3000 });
                    useChatStore.getState().addMessage({
                        role: 'pet', content: '获取任务失败', source: 'system',
                    });
                    return;
                }
                useChatStore.getState().addMessage({
                    role: 'pet', content: todayTasks.length > 0 ? `今日有 ${todayTasks.length} 个待办任务` : '今天没有待办任务', source: 'system',
                });
            } catch (e) {
                bubbleRef.current?.showMessage({ text: '获取任务失败', type: 'system', duration: 3000 });
                useChatStore.getState().addMessage({
                    role: 'pet', content: '获取任务失败', source: 'system',
                });
            }
        } else if (command === '/task') {
            if (!args) {
                bubbleRef.current?.showMessage({ text: '用法: /task 任务标题', type: 'system', duration: 4000 });
                useChatStore.getState().addMessage({
                    role: 'pet', content: '用法: /task 任务标题', source: 'system',
                });
                return;
            }
            await window.petAPI.taskQuickAdd(args);
            const msg = `已创建任务: ${args}`;
            bubbleRef.current?.showMessage({ text: msg, type: 'info', duration: 4000 });
            useChatStore.getState().addMessage({
                role: 'pet', content: msg, source: 'system',
            });
        } else if (command === '/remind') {
            if (!args) {
                bubbleRef.current?.showMessage({
                    text: '用法:\n/remind 下午3点开会\n/remind 明天9点提交报告\n/remind 每天8点半喝水',
                    type: 'system',
                    duration: 5000
                });
                return;
            }
            const parsed = parseReminderArgs(args);
            const reminder: any = {
                title: parsed.title,
                type: parsed.type,
                time: parsed.time,
                enabled: true
            };
            if (parsed.date) reminder.date = parsed.date;
            await window.petAPI.reminderAdd(reminder);
            const typeLabel: Record<string, string> = {
                once: '一次性', daily: '每天', weekly: '每周', monthly: '每月'
            };
            const dateStr = parsed.date ? ` ${parsed.date}` : '';
            const remindMsg = `🔔 已创建提醒: ${parsed.title}\n${typeLabel[parsed.type]} · ${parsed.time}${dateStr}`;
            bubbleRef.current?.showMessage({
                text: remindMsg,
                type: 'reminder',
                duration: 5000,
                actions: [{ label: '知道了', action: 'dismiss', style: 'primary' }]
            });
            useChatStore.getState().addMessage({
                role: 'pet', content: `已创建提醒: ${parsed.title}`, source: 'system',
            });
        }
    }, [openTodoPanel]);

    /**
     * 对话气泡显示（普通文本）
     */
    const handleChatBubble = useCallback((text: string, type: 'emotion' | 'info' | 'system' = 'emotion') => {
        bubbleRef.current?.hideMessage();  // 先关旧气泡
        bubbleRef.current?.showMessage({ text, type, duration: type === 'system' ? 4000 : 6000 });
    }, []);

    /**
     * 流式气泡：开始 / 更新 / 结束（结束后自动消失）
     */
    const handleStreamStart = useCallback(() => {
        bubbleRef.current?.startStream('emotion');
    }, []);

    const handleChatBubbleStream = useCallback((text: string) => {
        bubbleRef.current?.updateStreamText(text);
    }, []);

    const handleStreamEnd = useCallback((text: string, duration = 8000) => {
        bubbleRef.current?.finalizeStream(text, duration);
    }, []);

    /** 历史窗口重答时，通过 relay 在主窗口显示流式气泡 */
    useEffect(() => {
        if (!window.petAPI) return;

        const onStreamStart = () => handleStreamStart();
        const onStreamChunk = (_e: unknown, text: string) => handleChatBubbleStream(text);
        const onStreamEnd = (_e: unknown, text: string) => handleStreamEnd(text);
        const onStreamError = (_e: unknown, reason: string) => {
            handleChatBubble(`${reason}`, 'system');
        };

        window.petAPI.on('chat-stream-start', onStreamStart);
        window.petAPI.on('chat-stream-chunk', onStreamChunk);
        window.petAPI.on('chat-stream-end', onStreamEnd);
        window.petAPI.on('chat-stream-error', onStreamError);

        return () => {
            window.petAPI.removeListener('chat-stream-start', onStreamStart);
            window.petAPI.removeListener('chat-stream-chunk', onStreamChunk);
            window.petAPI.removeListener('chat-stream-end', onStreamEnd);
            window.petAPI.removeListener('chat-stream-error', onStreamError);
        };
    }, [handleStreamStart, handleChatBubbleStream, handleStreamEnd, handleChatBubble]);

    /**
     * 处理调整大小开始
     */
    const handleResizeStart = useCallback((e: React.MouseEvent, type: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        resizeState.current = {
            isResizing: true,
            resizeType: type,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: windowSize.width,
            startHeight: windowSize.height,
            startLeft: window.screenLeft,
            startTop: window.screenTop
        };
    }, [windowSize]);

    /**
     * 处理调整大小移动
     */
    useEffect(() => {
        const handleResizeMove = (e: MouseEvent) => {
            if (!resizeState.current.isResizing) return;
            
            const { resizeType, startX, startY, startWidth, startHeight, startLeft, startTop } = resizeState.current;
            let newWidth = startWidth;
            let newHeight = startHeight;
            let deltaX = e.clientX - startX;
            let deltaY = e.clientY - startY;

            // 最小/最大尺寸限制
            const minWidth = 400;
            const maxWidth = 800;
            const minHeight = 500;
            const maxHeight = 1000;

            switch (resizeType) {
                case 'nw':
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    if (window.petAPI) {
                        window.petAPI.setWindowSize(newWidth, newHeight);
                        window.petAPI.moveWindow(startWidth - newWidth, startHeight - newHeight);
                    }
                    break;
                case 'ne':
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    if (window.petAPI) {
                        window.petAPI.setWindowSize(newWidth, newHeight);
                        window.petAPI.moveWindow(0, startHeight - newHeight);
                    }
                    break;
                case 'sw':
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    if (window.petAPI) {
                        window.petAPI.setWindowSize(newWidth, newHeight);
                        window.petAPI.moveWindow(startWidth - newWidth, 0);
                    }
                    break;
                case 'se':
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    if (window.petAPI) {
                        window.petAPI.setWindowSize(newWidth, newHeight);
                    }
                    break;
            }

            if (newWidth !== startWidth || newHeight !== startHeight) {
                setWindowSize({ width: newWidth, height: newHeight });
                windowSizeRef.current = { width: newWidth, height: newHeight };
            }
        };

        const handleResizeEnd = () => {
            if (resizeState.current.isResizing) {
                const base = skinBaseSizeRef.current;
                if (base.width > 0) {
                    setWindowScale(windowSizeRef.current.width / base.width);
                }
            }
            resizeState.current.isResizing = false;
        };

        if (resizeState.current.isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [resizeState.current.isResizing]);

    /**
     * 调整窗口大小
     */
    const adjustWindowSize = useCallback((payload: PetSizeChangePayload) => {
        skinBaseSizeRef.current = payload.base;
        setWindowSize({ width: payload.width, height: payload.height });
        windowSizeRef.current = { width: payload.width, height: payload.height };
        if (window.petAPI) {
            window.petAPI.setWindowSize(payload.width, payload.height);
        }
    }, []);

    // 如果是 todo 路由，只渲染 TodoApp（独立窗口模式）
    if (currentRoute === 'todo') {
        return (
            <div className="todo-window-container">
                <ErrorBoundary>
                    <TodoApp />
                </ErrorBoundary>
            </div>
        );
    }

    // 如果是 settings 路由，只渲染 SettingsApp（独立窗口模式）
    if (currentRoute === 'settings') {
        return (
            <div className="settings-window-container">
                <SettingsApp />
            </div>
        );
    }

    // 如果是 reminder 路由，只渲染 ReminderApp（独立窗口模式）
    if (currentRoute === 'reminder') {
        return (
            <div className="reminder-window-container">
                <ReminderApp />
            </div>
        );
    }

    // 如果是 chat-history 路由，只渲染 ChatHistory（独立窗口模式）
    if (currentRoute === 'chat-history') {
        return (
            <div className="chathistory-window-container">
                <ChatHistory standalone />
            </div>
        );
    }

    return (
        <div className="app-container" ref={appRef}>
            {/* 四角调整大小手柄 */}
                    <div 
                        className="resize-handle resize-handle-nw"
                        onMouseDown={(e) => handleResizeStart(e, 'nw')}
                    />
                    <div 
                        className="resize-handle resize-handle-ne"
                        onMouseDown={(e) => handleResizeStart(e, 'ne')}
                    />
                    <div 
                        className="resize-handle resize-handle-sw"
                        onMouseDown={(e) => handleResizeStart(e, 'sw')}
                    />
                    <div 
                        className="resize-handle resize-handle-se"
                        onMouseDown={(e) => handleResizeStart(e, 'se')}
                    />
                    
                    {/* 右侧图标栏 */}
                    <div className="icon-bar">
                        <div className="icon-bar-item icon-always-visible" onContextMenu={e => e.preventDefault()}>
                            <button
                                className="settings-toggle"
                                onClick={() => window.petAPI?.toggleSettingsWindow()}
                                title={t('settings.title')}
                            >
                                ⚙
                            </button>
                        </div>
                        <div className={`icon-bar-item ${showPomodoro ? 'icon-visible' : 'icon-hidden'}`} onContextMenu={e => e.preventDefault()}>
                            <Pomodoro />
                        </div>
                        <div className={`icon-bar-item ${showReminder ? 'icon-visible' : 'icon-hidden'}`} onContextMenu={e => e.preventDefault()}>
                            <div className="reminder-container-inner">
                                <button
                                    className="reminder-toggle"
                                    onClick={() => window.petAPI?.toggleReminderWindow()}
                                    title="提醒"
                                >
                                    🔔
                                    {showReminderBadge && reminderCount > 0 && (
                                        <span className="reminder-badge">{reminderCount}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className={`icon-bar-item ${showTodoLauncher ? 'icon-visible' : 'icon-hidden'}`}>
                            <TodoLauncher />
                        </div>
                        <div className={`icon-bar-item ${showChatHistoryLauncher ? 'icon-visible' : 'icon-hidden'}`}>
                            <ChatHistoryLauncher />
                        </div>
                    </div>

                    {/* 拖拽手柄 */}
                    <div 
                        className="drag-handle"
                        title="拖拽移动窗口"
                    >
                        ☰
                    </div>
                    
                    {/* 桌宠 */}
                    <div
                        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                        onContextMenu={handlePetContextMenu}
                    >
                        <Pet
                            stateMachine={stateMachine}
                            skinFolder={currentSkin}
                            layoutVersion={layoutVersion}
                            onSizeChange={adjustWindowSize}
                            onPetBoundsChange={handlePetBoundsChange}
                            onInteract={handlePetInteract}
                            onDoubleClick={handlePetDoubleClick}
                        />
                    </div>

                    {/* 右键对话输入框 */}
                    <ChatInput
                        visible={showChatInput}
                        onClose={() => setShowChatInput(false)}
                        onCommand={handleChatCommand}
                        onBubble={handleChatBubble}
                        onStreamStart={handleStreamStart}
                        onBubbleStream={handleChatBubbleStream}
                        onStreamEnd={handleStreamEnd}
                    />

                    <Bubble
                        ref={bubbleRef}
                        petAnchor={petAnchor}
                        skinId={currentSkin}
                        styleVersion={bubbleStyleVersion}
                    />
        </div>
    );
}

export default App;
