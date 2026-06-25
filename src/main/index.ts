import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipc';
import { registerMsTodoIpc } from './tools/msToDoSync';
import { todoSystem } from './tools/todo';
import { reminderSystem } from './tools/reminder';
import { isAppQuitting, markAppQuitting } from './appLifecycle';

/** 桌宠窗口实例 */
let mainWindow: BrowserWindow | null = null;

/** Todo窗口实例 */
let todoWindow: BrowserWindow | null = null;

/** 设置窗口实例 */
let settingsWindow: BrowserWindow | null = null;

/** 提醒窗口实例 */
let reminderWindow: BrowserWindow | null = null;

/** 对话历史窗口实例 */
let chatHistoryWindow: BrowserWindow | null = null;

/**
 * 获取Todo窗口实例（供IPC使用）
 */
export function getTodoWindow(): BrowserWindow | null {
    return todoWindow;
}

/**
 * 获取设置窗口实例（供IPC使用）
 */
export function getSettingsWindow(): BrowserWindow | null {
    return settingsWindow;
}

/**
 * 获取提醒窗口实例（供IPC使用）
 */
export function getReminderWindow(): BrowserWindow | null {
    return reminderWindow;
}

export function getChatHistoryWindow(): BrowserWindow | null {
    return chatHistoryWindow;
}

/** 正在退出标志见 appLifecycle.ts */

/**
 * 创建Todo窗口
 * 独立的任务管理窗口，不会被角色窗口盖住
 */
function createTodoWindow(): void {
    // 如果Todo窗口已经存在，聚焦并返回
    if (todoWindow) {
        if (todoWindow.isMinimized()) todoWindow.restore();
        todoWindow.focus();
        return;
    }

    // 创建Todo窗口
    todoWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: '任务管理',
        frame: true,
        resizable: true,
        alwaysOnTop: false, // 不总是在最前面，但可以通过任务栏访问
        skipTaskbar: false, // 显示在任务栏
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 加载Todo应用
    if (process.env.ELECTRON_RENDERER_URL) {
        todoWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#todo`);
    } else {
        todoWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '#todo'
        });
    }

    // 窗口关闭事件
    todoWindow.on('closed', () => {
        todoWindow = null;
    });
}

/**
 * 创建设置窗口
 */
function createSettingsWindow(): void {
    if (settingsWindow) {
        if (settingsWindow.isMinimized()) settingsWindow.restore();
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: '设置',
        frame: true,
        resizable: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#settings`);
    } else {
        settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '#settings'
        });
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

/**
 * 创建提醒窗口
 */
function createReminderWindow(): void {
    if (reminderWindow) {
        if (reminderWindow.isMinimized()) reminderWindow.restore();
        reminderWindow.focus();
        return;
    }

    reminderWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: '提醒',
        frame: true,
        resizable: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        reminderWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#reminder`);
    } else {
        reminderWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '#reminder'
        });
    }

    reminderWindow.on('closed', () => {
        reminderWindow = null;
    });
}

/**
 * 创建对话历史窗口
 */
function createChatHistoryWindow(): void {
    if (chatHistoryWindow) {
        if (chatHistoryWindow.isMinimized()) chatHistoryWindow.restore();
        chatHistoryWindow.focus();
        return;
    }

    chatHistoryWindow = new BrowserWindow({
        width: 450,
        height: 600,
        title: '对话历史',
        frame: true,
        resizable: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        chatHistoryWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#chat-history`);
    } else {
        chatHistoryWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '#chat-history'
        });
    }

    chatHistoryWindow.on('closed', () => {
        chatHistoryWindow = null;
    });
}

/**
 * 创建桌宠主窗口
 * 设置透明、无边框、置顶等属性
 */
function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 480,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: true,
        minWidth: 300,
        minHeight: 400,
        maxWidth: 800,
        maxHeight: 1000,
        skipTaskbar: true,
        hasShadow: false,
        show: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 开发环境加载 dev server，生产环境加载打包文件
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // 注册 IPC 通信处理
    registerIpcHandlers(mainWindow);
    registerMsTodoIpc();

    // 注册打开Todo窗口的IPC处理器
    ipcMain.handle('open-todo-window', () => {
        createTodoWindow();
        return true;
    });

    // 注册切换Todo窗口的IPC处理器（开→关、关→开）
    ipcMain.handle('toggle-todo-window', () => {
        if (todoWindow && !todoWindow.isDestroyed()) {
            todoWindow.close();
            todoWindow = null;
        } else {
            createTodoWindow();
        }
        return true;
    });

    // 注册打开设置窗口的IPC处理器
    ipcMain.handle('open-settings-window', () => {
        createSettingsWindow();
        return true;
    });

    // 注册切换设置窗口的IPC处理器
    ipcMain.handle('toggle-settings-window', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
            settingsWindow = null;
        } else {
            createSettingsWindow();
        }
        return true;
    });

    // 注册打开提醒窗口的IPC处理器
    ipcMain.handle('open-reminder-window', () => {
        createReminderWindow();
        return true;
    });

    // 注册切换提醒窗口的IPC处理器
    ipcMain.handle('toggle-reminder-window', () => {
        if (reminderWindow && !reminderWindow.isDestroyed()) {
            reminderWindow.close();
            reminderWindow = null;
        } else {
            createReminderWindow();
        }
        return true;
    });

    // 注册对话历史窗口的IPC处理器
    ipcMain.handle('open-chat-history-window', () => {
        createChatHistoryWindow();
        return true;
    });

    ipcMain.handle('toggle-chat-history-window', () => {
        if (chatHistoryWindow && !chatHistoryWindow.isDestroyed()) {
            chatHistoryWindow.close();
            chatHistoryWindow = null;
        } else {
            createChatHistoryWindow();
        }
        return true;
    });

    // 注册中转IPC：设置/提醒窗口发消息给主窗口
    ipcMain.handle('relay-to-main', (_event, channel: string, ...args: any[]) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, ...args);
        }
        return true;
    });

    // 时段状态/气泡：TimeSensor 默认关闭，见 sensors/timeSensor.ts TIME_SENSOR_ENABLED

    // 监听窗口关闭事件
    mainWindow.on('close', (event) => {
        if (!isAppQuitting()) {
            // 阻止默认关闭行为，改为隐藏窗口（macOS 风格）
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * 应用就绪后创建窗口
 */
app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
        // macOS 上点击 Dock 图标时显示窗口
        if (mainWindow) {
            mainWindow.show();
        } else {
            createMainWindow();
        }
    });
});

/**
 * 应用退出前清理
 */
app.on('before-quit', () => {
    markAppQuitting();
});

/**
 * 所有窗口关闭时退出应用（macOS 除外）
 * macOS 上通过 Dock 菜单或 Cmd+Q 退出
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
