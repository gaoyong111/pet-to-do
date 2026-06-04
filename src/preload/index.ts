import { contextBridge, ipcRenderer } from 'electron';

/**
 * 通过 contextBridge 向渲染进程暴露安全的 API
 * 使用 contextIsolation 确保安全性
 */
contextBridge.exposeInMainWorld('petAPI', {
    /**
     * 获取当前桌宠状态
     * @returns 当前状态的字符串
     */
    getPetState: (): Promise<string> => {
        return ipcRenderer.invoke('get-pet-state');
    },

    /**
     * 手动设置桌宠状态
     * @param state - 目标状态
     * @returns 设置后的状态字符串
     */
    setPetState: (state: string): Promise<string> => {
        return ipcRenderer.invoke('set-pet-state', state);
    },

    /**
     * 触发宠物交互
     * @param action - 交互类型：'pat'（摸头）或 'poke'（戳）
     */
    petInteract: (action: string): Promise<void> => {
        return ipcRenderer.invoke('pet-interact', action);
    },

    /**
     * 移动窗口位置
     * @param deltaX - X 轴移动像素
     * @param deltaY - Y 轴移动像素
     */
    moveWindow: (deltaX: number, deltaY: number): Promise<void> => {
        return ipcRenderer.invoke('move-window', { deltaX, deltaY });
    },

    /**
     * 设置窗口大小
     * @param width - 窗口宽度
     * @param height - 窗口高度
     */
    setWindowSize: (width: number, height: number): Promise<void> => {
        return ipcRenderer.invoke('set-window-size', { width, height });
    },

    /**
     * 退出应用
     */
    quitApp: (): Promise<void> => {
        return ipcRenderer.invoke('quit-app');
    },

    /**
     * 设置桌宠情绪
     * @param emotion - 目标情绪
     * @returns 是否设置成功
     */
    setPetEmotion: (emotion: string): Promise<boolean> => {
        return ipcRenderer.invoke('set-pet-emotion', emotion);
    },

    /**
     * 获取当前桌宠情绪
     * @returns 当前情绪的字符串
     */
    getPetEmotion: (): Promise<string> => {
        return ipcRenderer.invoke('get-pet-emotion');
    },

    /**
     * 切换皮肤
     * @param skinId - 皮肤ID
     * @returns 是否切换成功
     */
    switchSkin: (skinId: string): Promise<boolean> => {
        return ipcRenderer.invoke('switch-skin', skinId);
    },

    /**
     * 开始番茄钟
     */
    pomodoroStart: (): Promise<{ state: string; remainingTime: number }> => {
        return ipcRenderer.invoke('pomodoro-start');
    },

    /**
     * 暂停番茄钟
     */
    pomodoroPause: (): Promise<{ state: string; remainingTime: number }> => {
        return ipcRenderer.invoke('pomodoro-pause');
    },

    /**
     * 停止番茄钟
     */
    pomodoroStop: (): Promise<{ state: string; remainingTime: number }> => {
        return ipcRenderer.invoke('pomodoro-stop');
    },

    /**
     * 恢复番茄钟
     */
    pomodoroResume: (): Promise<{ state: string; remainingTime: number }> => {
        return ipcRenderer.invoke('pomodoro-resume');
    },

    /**
     * 获取番茄钟状态
     */
    pomodoroGetState: (): Promise<{ state: string; remainingTime: number }> => {
        return ipcRenderer.invoke('pomodoro-get-state');
    },

    /**
     * 设置番茄钟配置
     */
    pomodoroSetConfig: (config: any): Promise<boolean> => {
      return ipcRenderer.invoke('pomodoro-set-config', config);
    },

    /**
     * 获取所有提醒
     */
    reminderGetAll: (): Promise<any[]> => {
      return ipcRenderer.invoke('reminder-get-all');
    },

    /**
     * 添加提醒
     */
    reminderAdd: (reminder: any): Promise<any> => {
      return ipcRenderer.invoke('reminder-add', reminder);
    },

    /**
     * 更新提醒
     */
    reminderUpdate: (id: string, updates: any): Promise<any> => {
      return ipcRenderer.invoke('reminder-update', id, updates);
    },

    /**
     * 删除提醒
     */
    reminderDelete: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke('reminder-delete', id);
    },

    /**
     * 切换提醒启用状态
     */
    reminderToggle: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke('reminder-toggle', id);
    },

    /**
     * 获取所有任务
     */
    taskGetAll: (filters?: any): Promise<any[]> => {
      return ipcRenderer.invoke('task-get-all', filters);
    },

    /**
     * 批量替换所有任务（用于 MS 同步后写入）
     */
    taskSetAll: (tasks: any[]): Promise<boolean> => {
      return ipcRenderer.invoke('task-set-all', tasks);
    },

    /**
     * 获取单个任务
     */
    taskGet: (id: string): Promise<any> => {
      return ipcRenderer.invoke('task-get', id);
    },

    /**
     * 添加任务
     */
    taskAdd: (task: any): Promise<any> => {
      return ipcRenderer.invoke('task-add', task);
    },

    /**
     * 更新任务
     */
    taskUpdate: (id: string, updates: any): Promise<any> => {
      return ipcRenderer.invoke('task-update', id, updates);
    },

    /**
     * 删除任务
     */
    taskDelete: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke('task-delete', id);
    },

    /**
     * 切换任务状态
     */
    taskToggleStatus: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke('task-toggle-status', id);
    },

    /**
     * 设置任务优先级
     */
    taskSetPriority: (id: string, priority: string): Promise<boolean> => {
      return ipcRenderer.invoke('task-set-priority', id, priority);
    },

    /**
     * 为任务创建提醒
     */
    taskCreateReminder: (taskId: string, reminderConfig?: any): Promise<string | null> => {
      return ipcRenderer.invoke('task-create-reminder', taskId, reminderConfig);
    },

    /**
     * 获取任务关联的提醒
     */
    taskGetReminder: (taskId: string): Promise<any> => {
      return ipcRenderer.invoke('task-get-reminder', taskId);
    },

    /**
     * 快速添加任务（桌宠侧快捷入口）
     */
    taskQuickAdd: (title: string): Promise<any> => {
      return ipcRenderer.invoke('task-quick-add', title);
    },

    /**
     * 清空所有任务
     */
    taskClearAll: (): Promise<boolean> => {
      return ipcRenderer.invoke('task-clear-all');
    },

    /**
     * 清空所有提醒
     */
    reminderClearAll: (): Promise<boolean> => {
      return ipcRenderer.invoke('reminder-clear-all');
    },

    /**
     * 稍后提醒（snooze）
     */
    reminderSnooze: (reminderId: string, minutes: number): Promise<boolean> => {
      return ipcRenderer.invoke('reminder-snooze', reminderId, minutes);
    },

    /**
     * 打开任务管理窗口（独立窗口）
     */
    openTodoWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('open-todo-window');
    },

    /**
     * 切换任务管理窗口（开→关、关→开）
     */
    toggleTodoWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('toggle-todo-window');
    },

    /**
     * 打开设置窗口（独立窗口）
     */
    openSettingsWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('open-settings-window');
    },

    /**
     * 切换设置窗口（开→关、关→开）
     */
    toggleSettingsWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('toggle-settings-window');
    },

    /**
     * 打开提醒窗口（独立窗口）
     */
    openReminderWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('open-reminder-window');
    },

    /**
     * 切换提醒窗口（开→关、关→开）
     */
    toggleReminderWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('toggle-reminder-window');
    },

    openChatHistoryWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('open-chat-history-window');
    },

    toggleChatHistoryWindow: (): Promise<boolean> => {
      return ipcRenderer.invoke('toggle-chat-history-window');
    },

    /**
     * 中转消息到主窗口
     */
    relayToMain: (channel: string, ...args: any[]): Promise<boolean> => {
      return ipcRenderer.invoke('relay-to-main', channel, ...args);
    },

    // === Microsoft To Do 同步 ===
    msTodoStatus: (): Promise<{ authorized: boolean; configured: boolean }> => {
      return ipcRenderer.invoke('ms-todo-status');
    },
    msTodoAuthorize: (clientId?: string): Promise<{ success: boolean; error?: string; deviceCode?: string; verificationUri?: string }> => {
      return ipcRenderer.invoke('ms-todo-authorize', clientId);
    },
    msTodoCompleteAuth: (deviceCode?: string, clientId?: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('ms-todo-complete-auth', deviceCode, clientId);
    },
    msTodoLogout: (): Promise<boolean> => {
      return ipcRenderer.invoke('ms-todo-logout');
    },
    msTodoPull: (): Promise<{ lists?: any[]; tasks?: any[]; error?: string }> => {
      return ipcRenderer.invoke('ms-todo-pull');
    },
    msTodoPush: (task: any, msListId: string): Promise<{ success: boolean; microsoftToDoId?: string; error?: string }> => {
      return ipcRenderer.invoke('ms-todo-push', task, msListId);
    },
    msTodoDelete: (msListId: string, msTaskId: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('ms-todo-delete', msListId, msTaskId);
    },
    msTodoPushLocal: (localTasks: any[], msListId: string): Promise<{ success: number; failed: number; results: any[]; error?: string }> => {
      return ipcRenderer.invoke('ms-todo-push-local', localTasks, msListId);
    },

    // === 事件监听（主进程 → 渲染进程） ===

    /**
     * 监听状态变化
     * @param callback - 状态变化回调
     * @returns 取消监听函数
     */
    onStateChange: (callback: (newState: string) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, newState: string) => {
            callback(newState);
        };
        ipcRenderer.on('pet:state-change', handler);
        return () => ipcRenderer.removeListener('pet:state-change', handler);
    },

    /**
     * 监听情绪变化
     * @param callback - 情绪变化回调
     * @returns 取消监听函数
     */
    onEmotionChange: (callback: (newEmotion: string) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, newEmotion: string) => {
            callback(newEmotion);
        };
        ipcRenderer.on('pet:emotion-change', handler);
        return () => ipcRenderer.removeListener('pet:emotion-change', handler);
    },

    /**
     * 监听气泡显示
     * @param callback - 气泡消息回调
     * @returns 取消监听函数
     */
    onShowBubble: (callback: (message: { text: string; duration: number; type: string }) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, message: { text: string; duration: number; type: string }) => {
            callback(message);
        };
        ipcRenderer.on('pet:show-bubble', handler);
        return () => ipcRenderer.removeListener('pet:show-bubble', handler);
    },

    /**
     * 监听气泡隐藏
     * @param callback - 隐藏回调
     * @returns 取消监听函数
     */
    onHideBubble: (callback: () => void): (() => void) => {
        const handler = () => { callback(); };
        ipcRenderer.on('pet:hide-bubble', handler);
        return () => ipcRenderer.removeListener('pet:hide-bubble', handler);
    },

    /**
     * 监听交互反应
     * @param callback - 反应名称回调
     * @returns 取消监听函数
     */
    onPlayReaction: (callback: (reaction: string) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, reaction: string) => {
            callback(reaction);
        };
        ipcRenderer.on('pet:play-reaction', handler);
        return () => ipcRenderer.removeListener('pet:play-reaction', handler);
    },

    /**
     * 监听皮肤切换
     * @param callback - 皮肤ID回调
     * @returns 取消监听函数
     */
    onSkinSwitch: (callback: (skinId: string) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, skinId: string) => {
            callback(skinId);
        };
        ipcRenderer.on('switch-skin', handler);
        return () => ipcRenderer.removeListener('switch-skin', handler);
    },

    /**
     * 通用事件监听
     */
    on: (channel: string, callback: (...args: any[]) => void): void => {
        ipcRenderer.on(channel, (_event: Electron.IpcRendererEvent, ...args: any[]) => {
            callback(...args);
        });
    },

    /**
     * 通用事件移除
     */
    removeListener: (channel: string, callback: (...args: any[]) => void): void => {
        ipcRenderer.removeListener(channel, callback);
    },

    // === Claude CLI 对话 ===
    claudeChat: (prompt: string, cliPath: string, onChunk?: (text: string) => void): Promise<string> => {
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                clearTimeout(timer);
                ipcRenderer.removeListener('claude-chat-chunk', chunkHandler);
                ipcRenderer.removeListener('claude-chat-done', doneHandler);
                ipcRenderer.removeListener('claude-chat-error', errorHandler);
            };
            const timer = setTimeout(() => {
                if (!settled) { settled = true; cleanup(); reject(new Error('Claude CLI 无响应（35秒超时），请确认已重启应用')); }
            }, 35000);
            const chunkHandler = (_event: Electron.IpcRendererEvent, text: string) => {
                onChunk?.(text);
            };
            const doneHandler = (_event: Electron.IpcRendererEvent, text: string) => {
                if (!settled) { settled = true; cleanup(); resolve(text); }
            };
            const errorHandler = (_event: Electron.IpcRendererEvent, msg: string) => {
                if (!settled) { settled = true; cleanup(); reject(new Error(msg)); }
            };
            if (onChunk) ipcRenderer.on('claude-chat-chunk', chunkHandler);
            ipcRenderer.once('claude-chat-done', doneHandler);
            ipcRenderer.once('claude-chat-error', errorHandler);
            ipcRenderer.send('claude-chat', prompt, cliPath || 'claude');
        });
    },
  });
