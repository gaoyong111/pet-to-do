import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn } from 'child_process';
import { petEventBus, PetState, PetEmotion, BubbleMessage } from './eventBus';
import { pomodoroTimer, PomodoroConfig } from './tools/pomodoro';
import { reminderSystem, Reminder } from './tools/reminder';
import { todoSystem, TodoTask, TaskFilter, TaskPriority } from './tools/todo';

/** 是否已注册过 IPC handler */
let handlersRegistered = false;

/** 事件总线到渲染进程的 IPC channel 映射 */
const IPC_CHANNELS = {
    'state-change': 'pet:state-change',
    'emotion-change': 'pet:emotion-change',
    'show-bubble': 'pet:show-bubble',
    'hide-bubble': 'pet:hide-bubble',
    'play-reaction': 'pet:play-reaction'
};

/**
 * 注册所有 IPC 通信处理器
 * 将事件总线的事件转发到渲染进程
 * @param mainWindow - 主窗口实例
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
    if (handlersRegistered) return;
    handlersRegistered = true;

    /**
     * 获取当前桌宠状态
     */
    ipcMain.handle('get-pet-state', () => {
        return petEventBus.getState();
    });

    /**
     * 手动设置桌宠状态
     */
    ipcMain.handle('set-pet-state', (_event, newState: string) => {
        petEventBus.setState(newState as PetState);
        return petEventBus.getState();
    });

    /**
     * 获取当前桌宠情绪
     */
    ipcMain.handle('get-pet-emotion', () => {
        return petEventBus.getEmotion();
    });

    /**
     * 手动设置桌宠情绪
     */
    ipcMain.handle('set-pet-emotion', (_event, newEmotion: string) => {
        petEventBus.setEmotion(newEmotion as PetEmotion);
        return true;
    });

    /**
     * 切换皮肤
     */
    ipcMain.handle('switch-skin', (_event, skinId: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('switch-skin', skinId);
        }
        return true;
    });

    /**
     * 触发交互反应（点击宠物时调用）
     */
    ipcMain.handle('pet-interact', (_event, action: string) => {
        switch (action) {
            case 'pat':
                petEventBus.playReaction('pat');
                petEventBus.showBubble('嘿嘿~', 2000, 'emotion');
                petEventBus.setState('happy');
                // 3 秒后恢复原状态
                setTimeout(() => {
                    petEventBus.setState('idle');
                }, 3000);
                break;
            case 'poke':
                petEventBus.playReaction('poke');
                const pokes = ['干嘛！', '别戳我！', '疼！', '哼！'];
                const msg = pokes[Math.floor(Math.random() * pokes.length)];
                petEventBus.showBubble(msg, 2000, 'emotion');
                petEventBus.setState('sad');
                setTimeout(() => {
                    petEventBus.setState('idle');
                }, 3000);
                break;
            case 'doubleClick':
                petEventBus.playReaction('happy');
                petEventBus.showBubble('主人好喜欢我呀！', 2000, 'emotion');
                petEventBus.setState('happy');
                setTimeout(() => {
                    petEventBus.setState('idle');
                }, 3000);
                break;
            case 'dragStart':
                petEventBus.playReaction('drag');
                petEventBus.showBubble('主人要带我去哪里？', 1500, 'emotion');
                break;
            case 'dragEnd':
                petEventBus.playReaction('happy');
                petEventBus.showBubble('这里好舒服！', 1500, 'emotion');
                break;
            default:
                break;
        }
    });

    /**
     * 移动窗口位置
     */
    ipcMain.handle('move-window', (_event, delta: { deltaX: number; deltaY: number }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const [x, y] = mainWindow.getPosition();
            mainWindow.setPosition(x + delta.deltaX, y + delta.deltaY);
        }
    });

    /**
     * 设置窗口大小
     */
    ipcMain.handle('set-window-size', (_event, size: { width: number; height: number }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSize(size.width, size.height);
        }
    });

    /**
     * 退出应用
     * 直接调用 app.quit() 触发 before-quit 事件，绕过 close 的 preventDefault
     */
    ipcMain.handle('quit-app', () => {
        app.quit();
    });

    /**
     * 番茄钟相关 IPC 处理
     */
    ipcMain.handle('pomodoro-start', () => {
        pomodoroTimer.start();
        return {
            state: pomodoroTimer.getState(),
            remainingTime: pomodoroTimer.getRemainingTime()
        };
    });

    ipcMain.handle('pomodoro-pause', () => {
        pomodoroTimer.pause();
        return {
            state: pomodoroTimer.getState(),
            remainingTime: pomodoroTimer.getRemainingTime()
        };
    });

    ipcMain.handle('pomodoro-stop', () => {
        pomodoroTimer.stop();
        return {
            state: pomodoroTimer.getState(),
            remainingTime: pomodoroTimer.getRemainingTime()
        };
    });

    ipcMain.handle('pomodoro-resume', () => {
        pomodoroTimer.resume();
        return {
            state: pomodoroTimer.getState(),
            remainingTime: pomodoroTimer.getRemainingTime()
        };
    });

    ipcMain.handle('pomodoro-get-state', () => {
        return {
            state: pomodoroTimer.getState(),
            remainingTime: pomodoroTimer.getRemainingTime()
        };
    });

    ipcMain.handle('pomodoro-set-config', (_event, config: PomodoroConfig) => {
        pomodoroTimer.setConfig(config);
        return true;
    });

    /**
     * 提醒系统相关 IPC 处理
     */
    ipcMain.handle('reminder-get-all', () => {
        return reminderSystem.getReminders();
    });

    ipcMain.handle('reminder-add', (_event, reminder: Omit<Reminder, 'id' | 'lastTriggered'>) => {
        return reminderSystem.addReminder(reminder);
    });

    ipcMain.handle('reminder-update', (_event, id: string, updates: Partial<Omit<Reminder, 'id'>>) => {
        return reminderSystem.updateReminder(id, updates);
    });

    ipcMain.handle('reminder-delete', (_event, id: string) => {
        return reminderSystem.deleteReminder(id);
    });

    ipcMain.handle('reminder-toggle', (_event, id: string) => {
        return reminderSystem.toggleReminder(id);
    });

    /**
     * 任务系统相关 IPC 处理
     */
    ipcMain.handle('task-get-all', (_event, filters?: TaskFilter) => {
        return todoSystem.getTasks(filters);
    });

    ipcMain.handle('task-get', (_event, id: string) => {
        return todoSystem.getTask(id);
    });

    ipcMain.handle('task-add', (_event, task: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>) => {
        return todoSystem.addTask(task);
    });

    ipcMain.handle('task-update', (_event, id: string, updates: Partial<Omit<TodoTask, 'id' | 'createdAt'>>) => {
        return todoSystem.updateTask(id, updates);
    });

    ipcMain.handle('task-delete', (_event, id: string) => {
        return todoSystem.deleteTask(id);
    });

    ipcMain.handle('task-toggle-status', (_event, id: string) => {
        return todoSystem.toggleTaskStatus(id);
    });

    ipcMain.handle('task-set-priority', (_event, id: string, priority: TaskPriority) => {
        return todoSystem.setTaskPriority(id, priority);
    });

    ipcMain.handle('task-create-reminder', (_event, taskId: string, reminderConfig?: Partial<Reminder>) => {
        return todoSystem.createReminderForTask(taskId, reminderConfig);
    });

    ipcMain.handle('task-get-reminder', (_event, taskId: string) => {
        return todoSystem.getTaskReminder(taskId);
    });

    ipcMain.handle('task-clear-all', () => {
        todoSystem.clearAllTasks();
        return true;
    });

    ipcMain.handle('task-set-all', (_event, tasks: TodoTask[]) => {
        todoSystem.setAllTasks(tasks);
        return true;
    });

    ipcMain.handle('reminder-clear-all', () => {
        reminderSystem.clearAllReminders();
        return true;
    });

    /**
     * 快速添加任务（桌宠侧入口）
     */
    ipcMain.handle('task-quick-add', (_event, title: string) => {
        const task = todoSystem.addTask({
            listId: 'tasks',
            title: title.trim(),
            status: 'todo',
            priority: 'medium',
            isImportant: false
        });
        petEventBus.showBubble(`✅ 已添加：${title}`, 2500, 'emotion');
        return task;
    });

    /**
     * 稍后提醒（snooze）
     * 将提醒延后 N 分钟
     */
    ipcMain.handle('reminder-snooze', (_event, reminderId: string, minutes: number) => {
        const reminders = reminderSystem.getReminders();
        const reminder = reminders.find(r => r.id === reminderId);
        if (!reminder) return false;

        const now = new Date();
        now.setMinutes(now.getMinutes() + minutes);
        const newHours = now.getHours().toString().padStart(2, '0');
        const newMinutes = now.getMinutes().toString().padStart(2, '0');
        const newTime = `${newHours}:${newMinutes}`;
        const newDate = now.toISOString().slice(0, 10);

        reminderSystem.updateReminder(reminderId, {
            time: newTime,
            date: newDate,
            type: 'once',
            enabled: true,
            lastTriggered: undefined
        });

        petEventBus.showBubble(`好的，${minutes} 分钟后再提醒你 ⏰`, 2500, 'emotion');
        return true;
    });

    // === Claude CLI 对话 ===

    ipcMain.on('claude-chat', (event, prompt: string, cliPath: string) => {
        const proc = spawn(cliPath || 'claude', ['-p', '--print', prompt], {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30000
        });

        let fullText = '';

        proc.stdout.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf-8');
            fullText += text;
            event.sender.send('claude-chat-chunk', fullText);
        });

        proc.on('close', (code: number | null) => {
            if (code === 0) {
                event.sender.send('claude-chat-done', fullText.trim());
            } else {
                event.sender.send('claude-chat-error', `Claude CLI 退出 code=${code}`);
            }
        });

        proc.on('error', (err: Error) => {
            event.sender.send('claude-chat-error', `Claude CLI 启动失败: ${err.message}`);
        });

        proc.stderr.on('data', (chunk: Buffer) => {
            console.error('[Claude CLI stderr]', chunk.toString('utf-8'));
        });
    });

    // === 事件总线 → 渲染进程转发 ===

    /**
     * 转发状态变化事件
     */
    petEventBus.on('state-change', (newState: PetState) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS['state-change'], newState);
        }
    });

    /**
     * 转发情绪变化事件
     */
    petEventBus.on('emotion-change', (newEmotion: PetEmotion) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS['emotion-change'], newEmotion);
        }
    });

    /**
     * 转发气泡显示事件
     */
    petEventBus.on('show-bubble', (message: BubbleMessage) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS['show-bubble'], message);
        }
    });

    /**
     * 转发气泡隐藏事件
     */
    petEventBus.on('hide-bubble', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS['hide-bubble']);
        }
    });

    /**
     * 转发交互反应事件
     */
    petEventBus.on('play-reaction', (reaction: string) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS['play-reaction'], reaction);
        }
    });
}
