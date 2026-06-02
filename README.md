# 虚拟桌宠 (Desktop Pet)

基于 Electron + React + Live2D 的桌面虚拟宠物应用，集成了番茄钟、提醒、任务管理等效率工具。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 33 + electron-vite |
| 前端 | React 18 + TypeScript + Zustand |
| 宠物业态 | pixi-live2d-display / Lottie (Web) |
| 构建 | Vite 5 |

## 功能概览

- **Live2D 桌宠** — 支持多皮肤 / 多状态（idle、happy、working 等），点击互动对话
- **番茄钟** — 可折叠面板，默认隐藏，设置中可开关
- **提醒系统** — 独立窗口，支持定时提醒，图标显示激活数量徽标
- **任务管理** — 完整 Todo App（独立窗口），分组 / 星标 / 搜索 / Microsoft To Do 同步
- **图标栏** — 右侧统一图标栏，平滑过渡动画，间距 8px
- **多语言** — 中 / 英 / 日（i18n）

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 窗口管理、IPC handlers
│   ├── ipc.ts               # IPC 通道注册
│   ├── eventBus.ts          # 跨窗口事件总线
│   ├── tools/               # 工具模块（番茄钟、提醒、任务、MS To Do 同步）
│   ├── skins/               # 皮肤加载器
│   └── sensors/             # 时间传感器
├── preload/                 # 预加载脚本
│   └── index.ts             # 暴露 window.petAPI
├── renderer/src/            # 渲染进程
│   ├── App.tsx              # 路由入口、图标栏、状态管理
│   ├── App.css              # 全局样式 + 图标栏样式
│   ├── components/
│   │   ├── Pet.tsx          # 桌宠主体
│   │   ├── Pomodoro.tsx     # 番茄钟组件
│   │   ├── Reminder.tsx     # 提醒气泡
│   │   ├── ReminderApp.tsx  # 提醒管理窗口
│   │   ├── SettingsApp.tsx  # 设置窗口
│   │   ├── TodoLauncher.tsx # 任务启动器图标
│   │   ├── TodoApp/         # 完整任务管理应用
│   │   └── Bubble.tsx       # 对话气泡
│   ├── i18n/                # 国际化
│   └── state/               # 状态机
└── shared/                  # 共享类型
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建
pnpm build
```

## 窗口架构

应用通过 hash 路由 (`#todo`, `#settings`, `#reminder`) 区分独立窗口与主窗口：

- 主窗口 (`#`): 桌宠 + 图标栏
- 任务 (`#todo`): TodoApp 独立 BrowserWindow
- 设置 (`#settings`): SettingsApp 独立 BrowserWindow
- 提醒 (`#reminder`): ReminderApp 独立 BrowserWindow

跨窗口状态同步通过 IPC `relay-to-main` 通道中转。

## 图标栏动画

图标栏位于主窗口右侧，使用 flex 列布局。图标显隐通过 CSS class 切换实现平滑过渡：

- 显示: `opacity: 1`, `max-height: 60px`, `translateY(0) scale(1)`
- 隐藏: `opacity: 0`, `max-height: 0`, `translateY(-6px) scale(0.85)`, `pointer-events: none`

过渡时长 0.3s，隐藏时图标向上收缩并淡出，下方图标自然上滑填补空间。

## 提醒徽标

提醒图标 🔔 右上角显示红色徽标，数字为当前启用的提醒数量。每 30 秒自动刷新。徽标显示可在提醒面板中开关（localStorage: `pet-show-reminder-badge`）。

## 快捷键 / 交互

- 左键桌宠: 互动对话
- 右键桌宠: 快速添加任务
- 右键任务图标: 任务管理菜单
- 拖拽 ☰: 移动窗口
