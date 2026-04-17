import { app, BrowserWindow, Menu, MenuItem, ipcMain } from 'electron';
import { join } from 'path';
import { readdirSync } from 'fs';
import { registerIpcHandlers } from './ipc';
import { registerMsTodoIpc } from './tools/msToDoSync';
import { TimeSensor, TimePeriod } from './sensors/timeSensor';
import { createSkinLoader } from './skins/skinLoader';
import { todoSystem } from './tools/todo';
import { reminderSystem } from './tools/reminder';

/** 桌宠窗口实例 */
let mainWindow: BrowserWindow | null = null;

/** Todo窗口实例 */
let todoWindow: BrowserWindow | null = null;

/**
 * 获取Todo窗口实例（供IPC使用）
 */
export function getTodoWindow(): BrowserWindow | null {
    return todoWindow;
}

/** 正在退出标志，防止重复退出 */
let isQuitting = false;

/** 时间感知模块 */
let timeSensor: TimeSensor | null = null;

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
        maxWidth: 480,
        maxHeight: 600,
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

    // 加载皮肤
    const skinsDir = join(__dirname, '../renderer/skins');
    const skinLoader = createSkinLoader(skinsDir);
    const defaultSkin = skinLoader.getDefaultSkin();
    
    // 启动时间感知（昼夜节律）
    let timePeriods: TimePeriod[] | undefined;
    if (defaultSkin && defaultSkin.config.timePeriods) {
      timePeriods = defaultSkin.config.timePeriods;
    }
    timeSensor = new TimeSensor(timePeriods);
    timeSensor.start();

    // 创建右键菜单
    const contextMenu = new Menu();
    
    // 设置菜单项
    contextMenu.append(new MenuItem({
      label: '设置',
      click: () => {
        // 将来实现设置窗口
        console.log('打开设置');
      }
    }));
    
    // 任务管理菜单项
    contextMenu.append(new MenuItem({
      label: '任务管理',
      click: () => {
        createTodoWindow();
      }
    }));
    
    // 皮肤菜单项
    const skinSubmenu = [];
    
    // 加载所有可用皮肤
    try {
      const skinGroups = skinLoader.loadSkinGroups();
      
      skinGroups.forEach(group => {
        const groupSubmenu = group.skins.map((skin, index) => ({
          label: skin.manifest.description,
          checked: index === 0 && group.id === 'default',
          type: 'radio',
          click: () => {
            console.log(`切换到皮肤: ${skin.id}`);
            // 发送IPC消息到渲染进程切换皮肤
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('switch-skin', skin.id);
            }
          }
        }));
        
        skinSubmenu.push({
          label: group.name,
          submenu: groupSubmenu
        });
      });
    } catch (error) {
      console.error('加载皮肤列表失败:', error);
    }
    
    contextMenu.append(new MenuItem({
      label: '皮肤',
      submenu: skinSubmenu
    }));
    
    // 分隔线
    contextMenu.append(new MenuItem({ type: 'separator' }));
    
    // 退出菜单项
    contextMenu.append(new MenuItem({
      label: '退出',
      click: () => {
        app.quit();
      }
    }));
    
    // 监听右键点击事件
    mainWindow.webContents.on('context-menu', (e, params) => {
      contextMenu.popup({
        window: mainWindow,
        x: params.x,
        y: params.y
      });
    });

    // 监听窗口关闭事件
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
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
    isQuitting = true;
    if (timeSensor) {
        timeSensor.stop();
    }
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
