import { petEventBus } from '../eventBus';

/** 番茄钟状态 */
export type PomodoroState = 'idle' | 'work' | 'break' | 'longBreak';

/** 番茄钟配置接口 */
export interface PomodoroConfig {
  workDuration: number; // 工作时长（分钟）
  breakDuration: number; // 短休息时长（分钟）
  longBreakDuration: number; // 长休息时长（分钟）
  sessionsBeforeLongBreak: number; // 长休息前的工作次数
}

/** 番茄钟事件接口 */
export interface PomodoroEvent {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'complete' | 'stateChange';
  data?: any;
}

/**
 * 番茄钟工具类
 * 管理番茄钟的状态和计时
 */
class PomodoroTimer {
  /** 当前状态 */
  private state: PomodoroState = 'idle';
  
  /** 配置 */
  private config: PomodoroConfig = {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
  };
  
  /** 计时器实例 */
  private timer: NodeJS.Timeout | null = null;
  
  /** 剩余时间（秒） */
  private remainingTime: number = 0;
  
  /** 已完成的工作次数 */
  private completedSessions: number = 0;
  
  /** 事件监听器 */
  private eventListeners: Array<(event: PomodoroEvent) => void> = [];

  /**
   * 设置配置
   * @param config - 番茄钟配置
   */
  setConfig(config: Partial<PomodoroConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前状态
   * @returns 当前状态
   */
  getState(): PomodoroState {
    return this.state;
  }

  /**
   * 获取剩余时间（秒）
   * @returns 剩余时间
   */
  getRemainingTime(): number {
    return this.remainingTime;
  }

  /**
   * 开始番茄钟
   */
  start(): void {
    if (this.state !== 'idle' && this.state !== 'pause') {
      return;
    }

    if (this.state === 'idle') {
      // 确定下一个状态
      const isLongBreak = this.completedSessions > 0 && 
        this.completedSessions % this.config.sessionsBeforeLongBreak === 0;
      
      this.state = isLongBreak ? 'longBreak' : 'work';
      this.remainingTime = this.getDurationForState(this.state) * 60;
    } else if (this.state === 'pause') {
      // 从暂停状态恢复
      const previousState = (this as any).previousState;
      if (previousState) {
        this.state = previousState;
      }
    }

    this.timer = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.emitEvent({ type: 'stateChange' });
      } else {
        this.complete();
      }
    }, 1000);

    this.emitEvent({ type: 'start' });
    this.emitEvent({ type: 'stateChange' });

    // 通知宠物状态
    if (this.state === 'work') {
      petEventBus.forceSetState('working');
      petEventBus.showBubble('开始工作啦！', 2000, 'emotion');
    } else {
      petEventBus.forceSetState('idle');
      petEventBus.showBubble('休息时间到！', 2000, 'emotion');
    }
  }

  /**
   * 暂停番茄钟
   */
  pause(): void {
    if (this.state !== 'work' && this.state !== 'break' && this.state !== 'longBreak') {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const previousState = this.state;
    this.state = 'pause' as PomodoroState;
    (this as any).previousState = previousState; // 保存之前的状态

    this.emitEvent({ type: 'pause' });
    this.emitEvent({ type: 'stateChange' });

    // 通知宠物状态
    petEventBus.forceSetState('idle');
    petEventBus.showBubble('暂停了呢', 1500, 'emotion');
  }

  /**
   * 恢复番茄钟
   */
  resume(): void {
    if (this.state !== 'pause') {
      return;
    }

    // 恢复之前的状态
    const previousState = (this as any).previousState;
    if (previousState) {
      this.state = previousState;
    }

    this.timer = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.emitEvent({ type: 'stateChange' });
      } else {
        this.complete();
      }
    }, 1000);

    this.emitEvent({ type: 'resume' });
    this.emitEvent({ type: 'stateChange' });

    // 通知宠物状态
    if (this.state === 'work') {
      petEventBus.forceSetState('working');
      petEventBus.showBubble('继续工作！', 1500, 'emotion');
    }
  }

  /**
   * 停止番茄钟
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state = 'idle';
    this.remainingTime = 0;

    this.emitEvent({ type: 'stop' });
    this.emitEvent({ type: 'stateChange' });

    // 通知宠物状态
    petEventBus.forceSetState('idle');
    petEventBus.showBubble('番茄钟已停止', 1500, 'emotion');
  }

  /**
   * 完成当前番茄钟
   */
  private complete(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.state === 'work') {
      this.completedSessions++;
      petEventBus.showBubble('工作完成！休息一下吧', 2000, 'emotion');
    } else {
      petEventBus.showBubble('休息结束！', 2000, 'emotion');
    }

    this.emitEvent({ type: 'complete' });

    // 自动开始下一个番茄钟
    setTimeout(() => {
      this.start();
    }, 5000);
  }

  /**
   * 获取状态对应的时长（分钟）
   * @param state - 状态
   * @returns 时长（分钟）
   */
  private getDurationForState(state: PomodoroState): number {
    switch (state) {
      case 'work':
        return this.config.workDuration;
      case 'break':
        return this.config.breakDuration;
      case 'longBreak':
        return this.config.longBreakDuration;
      default:
        return 0;
    }
  }

  /**
   * 注册事件监听器
   * @param listener - 事件监听器
   * @returns 取消注册函数
   */
  onEvent(listener: (event: PomodoroEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /**
   * 触发事件
   * @param event - 事件
   */
  private emitEvent(event: PomodoroEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('番茄钟事件监听错误:', error);
      }
    });
  }
}

/** 番茄钟实例 */
export const pomodoroTimer = new PomodoroTimer();
