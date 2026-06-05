/**
 * 对话系统
 *
 * 不做随机闲聊；仅在关键点 / 预设时刻触发气泡：
 *   - 启动问候（App 调用 showGreeting）
 *   - 每日定时提醒（本文件 DAILY_SCHEDULE，每天每项最多一次）
 *   - 用户左键互动（petInteract，不走本模块）
 */
import { getRandomDialogue, getGreeting } from '../i18n';
import { PetState } from '../types';

/** 预设定时对话项 */
interface ScheduledDialogue {
  id: string;
  hour: number;
  minute: number;
  /** i18n dialogue 路径，如 health.drink */
  category: string;
  type: 'emotion' | 'info' | 'system';
  duration: number;
}

/** 每日定时触发表（可按需增删） */
const DAILY_SCHEDULE: ScheduledDialogue[] = [
  { id: 'hydrate-am', hour: 10, minute: 0, category: 'health.drink', type: 'info', duration: 6000 },
  { id: 'lunch', hour: 12, minute: 0, category: 'schedule.lunch', type: 'info', duration: 6000 },
  { id: 'hydrate-pm', hour: 15, minute: 0, category: 'health.drink', type: 'info', duration: 6000 },
  { id: 'stretch', hour: 15, minute: 30, category: 'health.stretch', type: 'info', duration: 6000 },
  { id: 'eye-rest', hour: 16, minute: 0, category: 'health.eye', type: 'info', duration: 6000 },
  { id: 'off-work', hour: 18, minute: 0, category: 'schedule.offWork', type: 'emotion', duration: 5000 },
  { id: 'sleep', hour: 23, minute: 0, category: 'health.sleep', type: 'info', duration: 6000 },
];

interface DialogueConfig {
  /** 是否启用每日定时对话 */
  scheduledEnabled: boolean;
}

const DEFAULT_CONFIG: DialogueConfig = {
  scheduledEnabled: true,
};

class DialogueManager {
  private config: DialogueConfig;
  private showBubbleCallback: ((text: string, type: 'emotion' | 'info' | 'system', duration: number) => void) | null = null;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  /** 记录每项定时对话上次触发的日期 YYYY-MM-DD */
  private lastFiredDate: Record<string, string> = {};
  private currentState: PetState = 'idle';

  constructor(config?: Partial<DialogueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setShowBubbleCallback(callback: (text: string, type: 'emotion' | 'info' | 'system', duration: number) => void): void {
    this.showBubbleCallback = callback;
  }

  setCurrentState(state: PetState): void {
    this.currentState = state;
  }

  showBubble(text: string, type: 'emotion' | 'info' | 'system' = 'emotion', duration: number = 5000): void {
    this.showBubbleCallback?.(text, type, duration);
  }

  /** 启动时问候（关键点） */
  showGreeting(): void {
    const greeting = getGreeting();
    if (greeting) {
      this.showBubble(greeting, 'emotion', 6000);
    }
  }

  /** 启动每日定时对话检查（每分钟看是否命中预设时刻） */
  startScheduledDialogues(): void {
    this.stopScheduledDialogues();
    if (!this.config.scheduledEnabled) return;

    this.checkScheduledDialogues();
    this.scheduleTimer = setInterval(() => {
      this.checkScheduledDialogues();
    }, 60_000);
  }

  stopScheduledDialogues(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  private checkScheduledDialogues(): void {
    const now = new Date();
    const today = this.formatDate(now);
    const hour = now.getHours();
    const minute = now.getMinutes();

    for (const item of DAILY_SCHEDULE) {
      if (item.hour !== hour || item.minute !== minute) continue;
      if (this.lastFiredDate[item.id] === today) continue;

      const text = getRandomDialogue(item.category);
      if (!text) continue;

      this.showBubble(text, item.type, item.duration);
      this.lastFiredDate[item.id] = today;
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  updateConfig(config: Partial<DialogueConfig>): void {
    this.config = { ...this.config, ...config };
    if (!this.config.scheduledEnabled) {
      this.stopScheduledDialogues();
    }
  }

  destroy(): void {
    this.stopScheduledDialogues();
    this.showBubbleCallback = null;
  }
}

let dialogueManagerInstance: DialogueManager | null = null;

export function getDialogueManager(): DialogueManager {
  if (!dialogueManagerInstance) {
    dialogueManagerInstance = new DialogueManager();
  }
  return dialogueManagerInstance;
}

/** 导出供文档 / 设置页查阅 */
export { DAILY_SCHEDULE };
