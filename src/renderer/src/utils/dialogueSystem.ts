/**
 * 对话系统
 * 管理桌宠的对话、气泡显示和健康提醒
 */
import { getRandomDialogue, getGreeting } from '../i18n';
import { PetState } from '../types';

/** 对话类型 */
export type DialogueType = 'greeting' | 'state' | 'health' | 'interaction';

/** 对话配置 */
interface DialogueConfig {
    /** 是否启用自动对话 */
    enabled: boolean;
    /** 自动对话最小间隔（毫秒） */
    minInterval: number;
    /** 自动对话最大间隔（毫秒） */
    maxInterval: number;
    /** 健康提醒间隔（毫秒） */
    healthReminderInterval: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: DialogueConfig = {
    enabled: true,
    minInterval: 30000, // 30秒
    maxInterval: 120000, // 2分钟
    healthReminderInterval: 3600000 // 1小时
};

/**
 * 对话管理器
 */
class DialogueManager {
    private config: DialogueConfig;
    private showBubbleCallback: ((text: string, type: 'emotion' | 'info' | 'system', duration: number) => void) | null = null;
    private autoDialogueTimer: ReturnType<typeof setTimeout> | null = null;
    private healthReminderTimer: ReturnType<typeof setInterval> | null = null;
    private lastHealthReminder: Record<string, number> = {};
    private currentState: PetState = 'idle';

    constructor(config?: Partial<DialogueConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 设置气泡显示回调
     */
    setShowBubbleCallback(callback: (text: string, type: 'emotion' | 'info' | 'system', duration: number) => void): void {
        this.showBubbleCallback = callback;
    }

    /**
     * 设置当前状态
     */
    setCurrentState(state: PetState): void {
        this.currentState = state;
    }

    /**
     * 显示气泡消息
     */
    showBubble(text: string, type: 'emotion' | 'info' | 'system' = 'emotion', duration: number = 5000): void {
        if (this.showBubbleCallback) {
            this.showBubbleCallback(text, type, duration);
        }
    }

    /**
     * 显示问候语
     */
    showGreeting(): void {
        const greeting = getGreeting();
        if (greeting) {
            this.showBubble(greeting, 'emotion', 6000);
        }
    }

    /**
     * 显示状态相关对话
     */
    showStateDialogue(state?: PetState): void {
        const targetState = state || this.currentState;
        const dialogue = getRandomDialogue(targetState);
        if (dialogue) {
            this.showBubble(dialogue, 'emotion', 4000);
        }
    }

    /**
     * 显示点击互动对话
     */
    showTapDialogue(): void {
        const dialogue = getRandomDialogue('tap');
        if (dialogue) {
            this.showBubble(dialogue, 'emotion', 3000);
        }
    }

    /**
     * 显示健康提醒
     */
    showHealthReminder(type: 'drink' | 'stretch' | 'eye' | 'sleep'): void {
        const now = Date.now();
        const lastTime = this.lastHealthReminder[type] || 0;
        
        // 避免重复提醒（30分钟内）
        if (now - lastTime < 1800000) {
            return;
        }
        
        const dialogue = getRandomDialogue(`health.${type}`);
        if (dialogue) {
            this.showBubble(dialogue, 'info', 8000);
            this.lastHealthReminder[type] = now;
        }
    }

    /**
     * 启动自动对话
     */
    startAutoDialogue(): void {
        if (!this.config.enabled) return;
        
        this.stopAutoDialogue();
        
        const scheduleNext = () => {
            const interval = this.config.minInterval + 
                Math.random() * (this.config.maxInterval - this.config.minInterval);
            
            this.autoDialogueTimer = setTimeout(() => {
                this.showStateDialogue();
                scheduleNext();
            }, interval);
        };
        
        scheduleNext();
    }

    /**
     * 停止自动对话
     */
    stopAutoDialogue(): void {
        if (this.autoDialogueTimer) {
            clearTimeout(this.autoDialogueTimer);
            this.autoDialogueTimer = null;
        }
    }

    /**
     * 启动健康提醒
     */
    startHealthReminders(): void {
        this.stopHealthReminders();
        
        this.healthReminderTimer = setInterval(() => {
            const hour = new Date().getHours();
            
            // 每小时喝水提醒
            this.showHealthReminder('drink');
            
            // 工作时间（9-18点）的拉伸和眼睛休息提醒
            if (hour >= 9 && hour <= 18) {
                const minute = new Date().getMinutes();
                if (minute === 0 || minute === 30) {
                    this.showHealthReminder('stretch');
                }
                if (minute === 20 || minute === 50) {
                    this.showHealthReminder('eye');
                }
            }
            
            // 深夜提醒睡觉
            if (hour >= 23 || hour < 2) {
                this.showHealthReminder('sleep');
            }
        }, 60000); // 每分钟检查一次
    }

    /**
     * 停止健康提醒
     */
    stopHealthReminders(): void {
        if (this.healthReminderTimer) {
            clearInterval(this.healthReminderTimer);
            this.healthReminderTimer = null;
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<DialogueConfig>): void {
        this.config = { ...this.config, ...config };
        
        if (!this.config.enabled) {
            this.stopAutoDialogue();
        }
    }

    /**
     * 清理资源
     */
    destroy(): void {
        this.stopAutoDialogue();
        this.stopHealthReminders();
        this.showBubbleCallback = null;
    }
}

/** 单例实例 */
let dialogueManagerInstance: DialogueManager | null = null;

/**
 * 获取对话管理器单例
 */
export function getDialogueManager(): DialogueManager {
    if (!dialogueManagerInstance) {
        dialogueManagerInstance = new DialogueManager();
    }
    return dialogueManagerInstance;
}
