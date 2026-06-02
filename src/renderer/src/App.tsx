import { useState, useEffect, useCallback, useRef } from 'react';
import { PetState } from './types';
import { StateMachine } from './state/stateMachine';
import Pet from './components/Pet';
import Pomodoro from './components/Pomodoro';
import ReminderApp from './components/ReminderApp';
import SettingsApp from './components/SettingsApp';
import Bubble, { BubbleRef } from './components/Bubble';
import TodoApp from './components/TodoApp';
import ErrorBoundary from './components/TodoApp/ErrorBoundary';
import { TodoLauncher } from './components/TodoLauncher';
import { mergeMsTasks } from './components/TodoApp/utils/msSync';
import { isInTodayView } from './components/TodoApp/utils/taskFilter';
import { useTodoStore } from './components/TodoApp/store/useTodoStore';
import usePetEvents from './hooks/usePetEvents';
import { getLocale, setLocale, subscribeLocaleChange, Locale, t } from './i18n';
import { getDialogueManager } from './utils/dialogueSystem';
import './App.css';

interface SkinGroup {
    id: string;
    name: string;
    skins: Array<{ id: string; name: string }>;
}

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

const SKIN_GROUPS: SkinGroup[] = [
    {
        id: 'default',
        name: '默认',
        skins: [
            { id: 'default', name: '默认皮肤' }
        ]
    },
    {
        id: 'cubism',
        name: 'Cubism SDK',
        skins: [
            { id: 'cubism-Hiyori', name: 'Hiyori' },
            { id: 'cubism-Mao', name: 'Mao' },
            { id: 'cubism-Mark', name: 'Mark' },
            { id: 'cubism-Natori', name: 'Natori' },
            { id: 'cubism-Ren', name: 'Ren' },
            { id: 'cubism-Rice', name: 'Rice' },
            { id: 'cubism-Wanko', name: 'Wanko' },
            { id: 'cubism-haru', name: 'Haru' }
        ]
    },

    {
        id: 'azurlane',
        name: '碧蓝航线',
        skins: [
            { id: 'azurlane-z23', name: 'Z23' },
            { id: 'azurlane-z46', name: 'Z46' },
            { id: 'azurlane-lafei', name: '拉菲' },
            { id: 'azurlane-lingbo', name: '凌波' },
            { id: 'azurlane-mingshi', name: '明石' },
            { id: 'azurlane-jian3', name: '剑三' },
            { id: 'azurlane-z13', name: 'Z13' }
        ]
    },
    {
        id: 'girlsfrontline',
        name: '少女前线',
        skins: [
            { id: 'girlsfrontline-armor1', name: 'Armor1' },
            { id: 'girlsfrontline-command1', name: 'Command1' },
            { id: 'girlsfrontline-golden1', name: 'Golden1' },
            { id: 'girlsfrontline-shield1', name: 'Shield1' },
            { id: 'girlsfrontline-target1', name: 'Target1' }
        ]
    },
];

function App(): JSX.Element {
    const [stateMachine] = useState(() => new StateMachine('idle'));
    const [currentState, setCurrentState] = useState<PetState>('idle');
    const [currentGroup, setCurrentGroup] = useState('default');
    const [currentSkin, setCurrentSkin] = useState('cubism-Hiyori');
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
    /** 激活的提醒数量 */
    const [reminderCount, setReminderCount] = useState(0);
    /** 是否在图标上显示提醒数量 */
    const [showReminderBadge, setShowReminderBadge] = useState(() => {
        const saved = localStorage.getItem('pet-show-reminder-badge');
        return saved !== null ? saved === 'true' : true;
    });
    const [windowSize, setWindowSize] = useState({ width: 640, height: 800 });
    const [currentRoute, setCurrentRoute] = useState(window.location.hash.slice(1) || '');
    /** 任务数量（用于设置面板显示） */
    const [taskCount, setTaskCount] = useState(0);
    /** 右键快速添加状态 */
    const [showContextQuickAdd, setShowContextQuickAdd] = useState(false);
    const [contextQuickText, setContextQuickText] = useState('');
    const contextQuickRef = useRef<HTMLInputElement>(null);
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
        
        dialogueManager.startAutoDialogue();
        dialogueManager.startHealthReminders();
        
        return () => {
            dialogueManager.destroy();
        };
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
            const group = SKIN_GROUPS.find(g => g.skins.some(s => s.id === skinId));
            if (group) {
                setCurrentGroup(group.id);
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

            const handleReminderBadgeVisibility = (visible: boolean) => {
                setShowReminderBadge(visible);
            };
            window.petAPI.on('reminder-badge-visibility', handleReminderBadgeVisibility);

            return () => {
                unsubscribe();
                unsubscribeSkinSwitch();
                window.petAPI.removeListener('set-pet-state', handleSetPetState);
                window.petAPI.removeListener('set-locale', handleSetLocale);
                window.petAPI.removeListener('pomodoro-visibility', handlePomodoroVisibility);
                window.petAPI.removeListener('reminder-visibility', handleReminderVisibility);
                window.petAPI.removeListener('todolauncher-visibility', handleTodoLauncherVisibility);
                window.petAPI.removeListener('reminder-badge-visibility', handleReminderBadgeVisibility);
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
     * 单击桌宠时触发互动对话
     */
    const handlePetClick = useCallback(() => {
        const dialogueManager = getDialogueManager();
        dialogueManager.showTapDialogue();
    }, []);

    /**
     * 双击桌宠：展示今日任务气泡面板
     */
    const handlePetDoubleClick = useCallback(async () => {
        if (!window.petAPI || !bubbleRef.current) return;
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
        } catch (e) {
            console.error('获取今日任务失败', e);
        }
    }, []);

    /**
     * 右键桌宠：显示快捷添加输入框
     */
    const handlePetContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowContextQuickAdd(true);
        setSettingsOpen(false);
        setTimeout(() => contextQuickRef.current?.focus(), 50);
    }, []);

    /**
     * 右键快速添加确认
     */
    const handleContextQuickAdd = useCallback(async () => {
        if (!contextQuickText.trim() || !window.petAPI) return;
        await window.petAPI.taskQuickAdd(contextQuickText.trim());
        setContextQuickText('');
        setShowContextQuickAdd(false);
    }, [contextQuickText]);

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
            }
        };

        const handleResizeEnd = () => {
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
    const adjustWindowSize = useCallback((width: number, height: number) => {
        setWindowSize({ width, height });
        if (window.petAPI) {
            window.petAPI.setWindowSize(width, height);
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
                    </div>

                    <Bubble ref={bubbleRef} />
                    
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
                            onSizeChange={adjustWindowSize}
                            onClick={handlePetClick}
                            onDoubleClick={handlePetDoubleClick}
                        />
                    </div>

                    {/* 右键快速添加任务浮层 */}
                    {showContextQuickAdd && (
                        <div
                            className="context-quick-add"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="context-quick-label">✏️ 快速记一条任务</div>
                            <div className="context-quick-row">
                                <input
                                    ref={contextQuickRef}
                                    className="context-quick-input"
                                    placeholder="任务标题，回车确认..."
                                    value={contextQuickText}
                                    onChange={e => setContextQuickText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleContextQuickAdd();
                                        if (e.key === 'Escape') { setShowContextQuickAdd(false); setContextQuickText(''); }
                                    }}
                                />
                                <button className="context-quick-submit" onClick={handleContextQuickAdd}>添加</button>
                                <button className="context-quick-cancel" onClick={() => { setShowContextQuickAdd(false); setContextQuickText(''); }}>✕</button>
                            </div>
                        </div>
                    )}
        </div>
    );
}

export default App;
