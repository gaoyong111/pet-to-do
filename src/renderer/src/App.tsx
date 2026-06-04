import { useState, useEffect, useCallback, useRef } from 'react';
import { PetState, ReminderType } from './types';
import { StateMachine } from './state/stateMachine';
import Pet from './components/Pet';
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
import { ChatMessage } from './utils/aiChatService';
import { mergeMsTasks } from './components/TodoApp/utils/msSync';
import { isInTodayView } from './components/TodoApp/utils/taskFilter';
import { useTodoStore } from './components/TodoApp/store/useTodoStore';
import { useChatStore } from './store/useChatStore';
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
    const [currentGroup, setCurrentGroup] = useState('cubism');
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
    const [windowSize, setWindowSize] = useState({ width: 640, height: 800 });
    const [currentRoute, setCurrentRoute] = useState(window.location.hash.slice(1) || '');
    /** 任务数量（用于设置面板显示） */
    const [taskCount, setTaskCount] = useState(0);
    /** 右键对话输入框状态 */
    const [showChatInput, setShowChatInput] = useState(false);
    /** AI 对话历史 */
    const chatHistoryRef = useRef<ChatMessage[]>([]);
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
     * 加载对话历史
     */
    useEffect(() => {
        useChatStore.getState().loadFromStorage();
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

            const handleChatHistoryVisibility = (visible: boolean) => {
                setShowChatHistoryLauncher(visible);
            };
            window.petAPI.on('chat-history-visibility', handleChatHistoryVisibility);

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
/** 提醒自然语言解析结果 */
function parseReminderArgs(args: string): {
    title: string;
    type: ReminderType;
    time: string;
    date?: string;
} {
    const now = new Date();
    let type: ReminderType = 'once';
    let time = '09:00';
    let date: string | undefined = undefined;
    let title = args;

    // 每天 → daily
    if (/每天/.test(title)) { type = 'daily'; title = title.replace(/每天/, '') }
    // 每周 → weekly（默认今天开始）
    if (/每周/.test(title)) { type = 'weekly'; title = title.replace(/每周/, '') }
    // 每月 → monthly
    if (/每月/.test(title)) { type = 'monthly'; title = title.replace(/每月/, '') }

    // 日期：明天 / 今天
    if (/明天/.test(title)) {
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().slice(0, 10);
        title = title.replace(/明天/, '');
    }
    if (/今天/.test(title)) {
        date = now.toISOString().slice(0, 10);
        title = title.replace(/今天/, '');
    }

    // 时间：下午3点 / 上午9点 / 3点半 / 15:00
    const timeMatch = title.match(/(下午|上午|中午)?(\d{1,2})[点:：](\d{1,2})?(半)?/);
    if (timeMatch) {
        let hour = parseInt(timeMatch[2]);
        const period = timeMatch[1];
        let minute = timeMatch[3] ? parseInt(timeMatch[3]) : (timeMatch[4] === '半' ? 30 : 0);

        if (period === '下午' && hour < 12) hour += 12;
        if (period === '中午' && hour < 12) hour += 12;
        if (period === '上午' && hour === 12) hour = 0;
        // 无前缀且 <= 6 → 假定下午（如"3点" → 15:00）
        if (!period && hour <= 6 && hour >= 1) hour += 12;

        time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        title = title.replace(timeMatch[0], '');
    }

    // 清理多余空白和连接词
    title = title.replace(/^[\s,，、]+|[\s,，、]+$/g, '');

    return {
        title: title || args.replace(/[每天每周每月今天明天]/g, '').trim() || args,
        type,
        time,
        date: type === 'once' ? date : undefined,
    };
}

    const handleChatCommand = useCallback(async (command: string, args: string) => {
        if (!window.petAPI) return;
        if (command === '/todo') {
            // 复用双击的任务面板逻辑
            try {
                const tasks = await window.petAPI.taskGetAll();
                const todayTasks = tasks.filter((t: any) => isInTodayView(t));
                const bubbleTasks = todayTasks.slice(0, 6).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority
                }));
                bubbleRef.current?.showTodoPanel(bubbleTasks);
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
    }, []);

    /**
     * 对话气泡显示（普通文本）
     */
    const handleChatBubble = useCallback((text: string, type: 'emotion' | 'info' | 'system' = 'emotion') => {
        bubbleRef.current?.hideMessage();  // 先关旧气泡
        bubbleRef.current?.showMessage({ text, type, duration: type === 'system' ? 4000 : 6000 });
    }, []);

    /**
     * 流式气泡更新（AI streaming 实时更新文本）
     */
    const handleChatBubbleStream = useCallback((text: string) => {
        bubbleRef.current?.updateStreamText(text);
    }, []);

    /**
     * 获取对话历史
     */
    const getChatHistory = useCallback((): ChatMessage[] => {
        const systemMsg: ChatMessage = {
            role: 'system',
            content: '你是一个桌面宠物伙伴。说话可爱、元气、充满活力。回复简洁（不超过2句话），使用颜文字。当用户让你执行操作时，不需要回复"好的"之类的确认词，直接执行即可。'
        };
        return [systemMsg, ...chatHistoryRef.current.slice(-8)];
    }, []);

    /**
     * 添加到对话历史
     */
    const addToChatHistory = useCallback((msg: ChatMessage) => {
        chatHistoryRef.current = [...chatHistoryRef.current.slice(-20), msg];
    }, []);

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

                    {/* 右键对话输入框 */}
                    <ChatInput
                        visible={showChatInput}
                        onClose={() => setShowChatInput(false)}
                        onCommand={handleChatCommand}
                        onBubble={handleChatBubble}
                        onBubbleStream={handleChatBubbleStream}
                        getHistory={getChatHistory}
                        addToHistory={addToChatHistory}
                    />
        </div>
    );
}

export default App;
