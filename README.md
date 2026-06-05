# 虚拟桌宠 (Desktop Pet)

基于 Electron + React + Live2D 的桌面虚拟宠物应用，集成了 AI 对话、番茄钟、提醒、任务管理等效率工具。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 33 + electron-vite |
| 前端 | React 18 + TypeScript + Zustand |
| 宠物业态 | pixi-live2d-display + pixi.js |
| 构建 | Vite 5 |

## 功能概览

- **Live2D 桌宠** — Cubism / 少女前线皮肤，多状态动作、鼠标视线追踪、皮肤热切换；按 manifest 自动适配尺寸，支持窗口拖拽缩放
- **视图自定义** — 设置内可调模型大小/偏移/窗口基准尺寸，按皮肤独立保存
- **聊天气泡** — 5 种主题预设 + 全参数自定义；位置跟随角色头顶动态锚定，按皮肤微调
- **AI 对话** — Ollama / OpenAI 兼容 API / Claude CLI，流式输出到气泡；自然语言意图识别；未配置时回退短语池
- **角色人格** — 支持 `.local/natori.modelfile` 角色卡驱动 system prompt 与短语池（示例见 `config/character/`）
- **命令输入** — 右键打开对话栏，支持 `/task`、`/remind`、`/todo`、`/help`
- **对话历史** — 独立窗口回看，Zustand + localStorage 持久化（最多 200 条），跨窗口同步；💬 图标未读徽标
- **番茄钟** — 图标栏可折叠面板，工作时桌宠切 `working` 状态
- **提醒系统** — 独立窗口管理，支持 once / daily / weekly / monthly，气泡触发 + snooze
- **任务管理** — 完整 Todo App（独立窗口），分组 / 星标 / 搜索 / Microsoft To Do 双向同步
- **图标栏** — 右侧统一入口（⚙ 🍅 🔔 📋 💬），显隐可在设置中开关
- **多语言** — 中 / 英 / 日（i18n）

## 当前可用皮肤

| 分组 | 皮肤 |
|---|---|
| Cubism SDK | Hiyori |
| 少女前线 | Command1、Golden1、Shield1、Target1 |

皮肤偏好保存在 localStorage（`pet-skin-id`），设置与主窗口切换后同步。

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 窗口管理（主窗口最大 800×1000）
│   ├── ipc.ts               # IPC 通道注册
│   ├── eventBus.ts          # 宠物事件总线
│   ├── character/           # 角色卡加载（.local/natori.*）
│   ├── tools/               # 番茄钟、提醒、任务、MS To Do 同步
│   ├── skins/               # 皮肤目录解析与加载
│   └── sensors/             # 时间感知（默认关闭）
├── preload/                 # 预加载脚本，暴露 window.petAPI
├── renderer/
│   ├── public/skins/        # Live2D 皮肤资源（manifest + 模型）
│   └── src/
│       ├── App.tsx          # hash 路由、主窗口、图标栏
│       ├── components/      # Pet、Live2DPet、Bubble、ChatInput、TodoApp、SettingsApp 等
│       ├── store/           # useChatStore（对话历史 + 未读）
│       ├── utils/           # aiChatService、skinLayout、bubbleStyle、petInteract 等
│       ├── character/       # 角色短语 / system prompt 渲染端
│       ├── constants/       # skinGroups
│       ├── i18n/
│       └── state/           # 状态机
├── shared/                  # 共享类型
└── config/character/        # 角色卡配置示例（复制到 .local/ 使用）

Live2d-model/                # 原始模型资源（大部分未接入 public/skins）
.local/                        # 本地角色卡（gitignore，见 config/character 示例）
```

## 开发

```bash
pnpm install
pnpm dev
pnpm build
```

Microsoft To Do 同步需配置 Azure 应用 Client ID：环境变量 `MS_TODO_CLIENT_ID`，或在 Todo 窗口侧边栏手动输入。

本地 Ollama 默认地址 `http://127.0.0.1:11434`；首次加载模型较慢，对话超时已单独放宽。

## 窗口架构

同一 React 应用通过 hash 路由区分窗口：

| 路由 | 窗口 |
|---|---|
| `#`（默认） | 主窗口：透明桌宠 + 图标栏 |
| `#todo` | 任务管理 |
| `#settings` | 设置 |
| `#reminder` | 提醒管理 |
| `#chat-history` | 对话历史 |

跨窗口状态同步通过 IPC `relay-to-main` 中转（皮肤切换、语言、布局/气泡样式等），部分数据另用 `localStorage` + `storage` 事件双窗口同步。

## 交互

| 操作 | 行为 |
|---|---|
| 左键桌宠 | 随机 pat/poke 动作 + manifest 气泡文案，800ms 冷却 |
| 双击桌宠 | 弹出今日任务面板 |
| 右键桌宠 | 打开对话输入框（AI / 命令） |
| 左键 📋 | 打开 / 关闭任务窗口 |
| 右键 📋 | 切换待办计数模式（全部 / 今日 / 隐藏）；菜单向左展开避免被 💬 遮挡 |
| 左键 💬 | 打开 / 关闭对话历史窗口 |
| 左键 ⚙ | 打开 / 关闭设置窗口 |
| 拖拽 ☰ | 移动窗口 |
| 拖拽四角 | 缩放窗口（比例写入 `pet-window-scale`） |

## 自定义配置

### 视图布局（设置 → 🎨 视图自定义配置）

按**当前皮肤**保存，覆盖 `manifest.json` 默认值：

| 参数 | 说明 |
|---|---|
| `model.scale` | 模型整体缩放倍率 |
| `layout.fill` | 模型占画布比例 |
| `model.offsetX/Y` | 像素级位移 |
| `size.width/height` | 基准窗口尺寸 |
| 窗口缩放 | 拖拽缩放后的比例（0.75–2×） |

存储键：`pet-skin-layout-overrides`（JSON，按 skinId）。

### 皮肤 manifest 布局字段

每个皮肤 `public/skins/<id>/manifest.json` 可写：

```json
{
  "size": { "width": 400, "height": 520 },
  "layout": { "fill": 0.84 },
  "model": {
    "scale": 0.88,
    "anchor": [0.5, 1],
    "offsetX": 0,
    "offsetY": 6
  }
}
```

加载时用 `internalModel` 可视边界对齐脚底，避免 Live2D 画布留白导致悬空或截脚。

### 聊天气泡（设置 → 💬 聊天气泡样式）

**全局样式**（`pet-bubble-style`）：

- 主题：柔和 / 粉彩 / 毛玻璃 / 漫画风 / 极简 / 自定义配色
- 字号、字重、行高、对齐、圆角、阴影、毛玻璃、浮动动画、小尾巴等

**按皮肤位置微调**（写入 `pet-skin-layout-overrides` 对应项）：

- 气泡相对角色头顶的水平/垂直偏移与间距

气泡锚点由 Live2D 实时上报的角色头顶坐标计算，换皮肤或改视图布局后自动跟随。

### 角色人格（可选）

1. 复制 `config/character/natori.modelfile.example` → `.local/natori.modelfile`
2. 复制 `config/character/natori.phrases.json.example` → `.local/natori.phrases.json`
3. 重启应用；设置里 AI「人格提示词」留空则使用角色卡内容

## AI 对话

| 后端 | 说明 |
|---|---|
| Ollama | 本地，`127.0.0.1:11434`，设置页可检测模型列表 |
| 第三方 API | OpenAI 兼容接口 + API Key |
| Claude CLI | 调用本地 `claude` 命令行 |

- 流式回复写入气泡，支持停止生成
- `chatIntent.ts` 解析自然语言（加任务、设提醒等）
- 历史统一走 `useChatStore`，主窗口与历史窗口共享

## 数据持久化

| 数据 | 存储位置 |
|---|---|
| 任务 | 主进程 `userData/tasks.json` |
| 提醒 | 主进程 `userData/reminders.json` |
| MS To Do Token | 主进程 `userData/ms-todo-token.json` |
| 对话历史 | localStorage `pet-chat-messages` |
| AI 配置 | localStorage `pet-ai-config` |
| 皮肤 / 布局 / 气泡 / UI 偏好 | localStorage（见上各键名） |
| Todo 列表结构 | localStorage `todoLists` |

## 图标栏

位于主窗口右侧，图标显隐通过 CSS class 切换（0.3s 过渡）。

| 图标 | 徽标 |
|---|---|
| 🔔 | 激活提醒数量 |
| 📋 | 待办数量（模式可在右键菜单切换） |
| 💬 | 未读对话条数 |

默认每 30 秒刷新任务/提醒计数。

## 最近更新

### 2026-06-05

**AI 与对话**

- 统一对话历史 Store，跨窗口同步与 💬 未读徽标
- Ollama 连接优化（默认 127.0.0.1、超时策略）
- 流式气泡、停止按钮、自然语言意图识别
- Natori 角色卡（`.local/` + `config/character/` 示例）

**皮肤与布局**

- 精简皮肤列表：Cubism 保留 Hiyori；少女前线 4 款；移除已删 Azur Lane 分组
- 修复皮肤偏好未从 localStorage 读取的问题
- 新增 `skinLayout` / `skinLayoutOverride`：按 manifest 自动适配、窗口缩放比例持久化
- 设置内 **视图自定义** 面板，按皮肤手动微调模型与窗口

**UI 与气泡**

- 修复 Todo 右键菜单被 💬 遮挡、待办气泡层级问题
- 修复模型过小、截脚、底部留白等布局问题（可视边界对齐 + `Pet.css` 贴底）
- 聊天气泡样式大改：5 主题 + 丰富参数自定义
- 气泡位置跟随角色头顶动态锚定，支持按皮肤位置微调

**清理**

- 删除无用代码路径；`petInteract` 统一交互逻辑；`TimeSensor` 默认关闭
