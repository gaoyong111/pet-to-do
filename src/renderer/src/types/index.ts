/** 桌宠状态类型 — 皮肤自行声明，不硬编码 */
export type PetState = string;

/** 桌宠情绪类型 */
export type PetEmotion = 'normal' | 'confused' | 'surprised' | 'excited' | 'angry' | 'thinking' | 'shy';

/**
 * 气泡操作按钮
 */
export interface BubbleAction {
    /** 按钮标签 */
    label: string;
    /** 按钮动作标识 */
    action: string;
    /** 按钮样式 */
    style?: 'primary' | 'secondary' | 'danger';
}

/**
 * 气泡内嵌任务项
 */
export interface BubbleTaskItem {
    id: string;
    title: string;
    status: 'todo' | 'in-progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
}

/**
 * 气泡消息接口
 */
export interface BubbleMessage {
    /** 消息内容 */
    text: string;
    /** 显示时长（毫秒），0 表示不自动消失 */
    duration: number;
    /** 消息类型，影响气泡样式 */
    type: 'emotion' | 'info' | 'system' | 'reminder' | 'todo';
    /** 操作按钮（可选） */
    actions?: BubbleAction[];
    /** 内嵌任务列表（可选，用于 todo 类型） */
    tasks?: BubbleTaskItem[];
    /** 关联的提醒ID（可选） */
    reminderId?: string;
}

/**
 * 番茄钟状态类型
 */
export type PomodoroState = 'idle' | 'work' | 'break' | 'longBreak' | 'pause';

/**
 * 番茄钟配置接口
 */
export interface PomodoroConfig {
  workDuration: number; // 工作时长（分钟）
  breakDuration: number; // 短休息时长（分钟）
  longBreakDuration: number; // 长休息时长（分钟）
  sessionsBeforeLongBreak: number; // 长休息前的工作次数
}

/**
 * 番茄钟状态接口
 */
export interface PomodoroStateInfo {
  state: PomodoroState;
  remainingTime: number;
}

/**
 * 提醒类型
 */
export type ReminderType = 'once' | 'daily' | 'weekly' | 'monthly';

/**
 * 重复周期（周几）
 */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 提醒接口
 */
export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: ReminderType;
  time: string; // HH:mm 格式
  date?: string; // YYYY-MM-DD 格式（仅一次性提醒）
  weekDays?: WeekDay[]; // 每周几（仅周重复）
  monthDay?: number; // 每月几号（仅月重复）
  enabled: boolean;
  lastTriggered?: string; // 最后触发时间
}

/** 皮肤清单接口
 * 描述一个皮肤的基本信息
 */
export interface SkinManifest {
    /** 皮肤名称 */
    name: string;
    /** 皮肤作者 */
    author: string;
    /** 皮肤版本 */
    version: string;
    /** 皮肤描述 */
    description: string;
    /** 皮肤分组 */
    group: string;
    /** 渲染器类型 */
    renderer: string;
    /** 模型配置 */
    model: {
        entry: string;
        scale: number;
        anchor: [number, number];
    };
    /** 皮肤尺寸 */
    size: {
        width: number;
        height: number;
    };
    /** 默认状态 */
    defaultState: string;
    /** 支持的状态 */
    supportedStates: string[];
    /** 支持的反应 */
    supportedReactions: string[];
    /** 状态中文标签（皮肤自行定义） */
    stateLabels: Record<string, string>;
    /** 状态动作映射 */
    stateMotionMapping: Record<string, {
        motion: string;
        expression: string;
        loop: boolean;
    }>;
    /** 反应映射 */
    reactionMapping: Record<string, {
        motion: string;
        expression: string;
        bubble: string;
    }>;
}

/**
 * 皮肤配置接口
 * 描述皮肤的运行时配置
 */
export interface SkinConfig {
    /** 默认状态 */
    defaultState: PetState;
    /** 状态转换规则 */
    stateTransitions: Record<string, string[]>;
    /** 反应映射 */
    reactionMapping: Record<string, {
        state: string;
        bubble: string;
        duration: number;
    }>;
    /** 时间段配置 */
    timePeriods: Array<{
        startHour: number;
        endHour: number;
        state: string;
        greetings: string[];
    }>;
}

/**
 * 通过 preload 暴露到渲染进程的 API 类型
 */
export interface PetAPI {
    getPetState: () => Promise<string>;
    setPetState: (state: string) => Promise<string>;
    petInteract: (action: string) => Promise<void>;
    moveWindow: (deltaX: number, deltaY: number) => Promise<void>;
    quitApp: () => Promise<void>;
    // 情绪相关方法
    setPetEmotion: (emotion: string) => Promise<boolean>;
    getPetEmotion: () => Promise<string>;
    // 皮肤切换相关方法
    onSkinSwitch: (callback: (skinId: string) => void) => () => void;
    switchSkin: (skinId: string) => Promise<boolean>;
    // 番茄钟相关方法
    pomodoroStart: () => Promise<PomodoroStateInfo>;
    pomodoroPause: () => Promise<PomodoroStateInfo>;
    pomodoroStop: () => Promise<PomodoroStateInfo>;
    pomodoroResume: () => Promise<PomodoroStateInfo>;
    pomodoroGetState: () => Promise<PomodoroStateInfo>;
    pomodoroSetConfig: (config: PomodoroConfig) => Promise<boolean>;
    // 提醒系统相关方法
    reminderGetAll: () => Promise<Reminder[]>;
    reminderAdd: (reminder: Omit<Reminder, 'id' | 'lastTriggered'>) => Promise<Reminder>;
    reminderUpdate: (id: string, updates: Partial<Omit<Reminder, 'id'>>) => Promise<Reminder | null>;
    reminderDelete: (id: string) => Promise<boolean>;
    reminderToggle: (id: string) => Promise<boolean>;
    // 任务相关方法
    taskGetAll: (filters?: any) => Promise<any[]>;
    taskSetAll: (tasks: any[]) => Promise<boolean>;
    taskGet: (id: string) => Promise<any>;
    taskAdd: (task: any) => Promise<any>;
    taskUpdate: (id: string, updates: any) => Promise<any>;
    taskDelete: (id: string) => Promise<boolean>;
    taskToggleStatus: (id: string) => Promise<boolean>;
    taskSetPriority: (id: string, priority: string) => Promise<boolean>;
    taskCreateReminder: (taskId: string, reminderConfig?: any) => Promise<string | null>;
    taskGetReminder: (taskId: string) => Promise<any>;
    // 快速添加任务（桌宠侧）
    taskQuickAdd: (title: string) => Promise<any>;
    // 清空所有任务
    taskClearAll: () => Promise<boolean>;
    // 清空所有提醒
    reminderClearAll: () => Promise<boolean>;
    // 稍后提醒（snooze）
    reminderSnooze: (reminderId: string, minutes: number) => Promise<boolean>;
    // 打开任务管理窗口（独立窗口）
    openTodoWindow: () => Promise<boolean>;
    toggleTodoWindow: () => Promise<boolean>;
    openSettingsWindow: () => Promise<boolean>;
    toggleSettingsWindow: () => Promise<boolean>;
    openReminderWindow: () => Promise<boolean>;
    toggleReminderWindow: () => Promise<boolean>;
    openChatHistoryWindow: () => Promise<boolean>;
    toggleChatHistoryWindow: () => Promise<boolean>;
    relayToMain: (channel: string, ...args: any[]) => Promise<boolean>;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    // Microsoft To Do 同步
    msTodoStatus: () => Promise<{ authorized: boolean; configured: boolean }>;
    msTodoAuthorize: (clientId?: string) => Promise<{ success: boolean; error?: string; deviceCode?: string; verificationUri?: string }>;
    msTodoCompleteAuth: (deviceCode?: string, clientId?: string) => Promise<{ success: boolean; error?: string }>;
    msTodoLogout: () => Promise<boolean>;
    msTodoPull: () => Promise<{ lists?: any[]; tasks?: any[]; error?: string }>;
    msTodoPush: (task: any, msListId: string) => Promise<{ success: boolean; microsoftToDoId?: string; error?: string }>;
    msTodoDelete: (msListId: string, msTaskId: string) => Promise<{ success: boolean; error?: string }>;
    msTodoPushLocal: (localTasks: any[], msListId: string) => Promise<{ success: number; failed: number; results: any[]; error?: string }>;
    // Claude CLI
    claudeChat: (prompt: string, cliPath: string, onChunk?: (text: string) => void) => Promise<string>;
    onStateChange: (callback: (newState: string) => void) => () => void;
    onEmotionChange: (callback: (emotion: string) => void) => () => void;
    onShowBubble: (callback: (message: BubbleMessage) => void) => () => void;
    onHideBubble: (callback: () => void) => () => void;
    onPlayReaction: (callback: (reaction: string) => void) => () => void;
}

/** 扩展 Window 类型，声明 petAPI */
declare global {
    interface Window {
        petAPI: PetAPI;
    }
}

/**
 * AI 连接配置
 * 支持本地 Ollama 和第三方 OpenAI 兼容 API
 */
export type AIProvider = 'local' | 'third_party' | 'claude_cli';

export interface AIConfig {
    provider: AIProvider;
    // 本地 Ollama
    ollamaUrl: string;
    ollamaModel: string;
    // 第三方 OpenAI 兼容 API
    apiUrl: string;
    apiKey: string;
    model: string;
    // Claude CLI
    claudeCLIPath: string;
    // 通用
    enabled: boolean;
}

/** AI 配置默认值 */
export const DEFAULT_AI_CONFIG: AIConfig = {
    provider: 'local',
    ollamaUrl: 'http://192.168.2.132:11434',
    ollamaModel: 'qwen2.5:7b',
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    claudeCLIPath: 'claude',
    enabled: false,
};
