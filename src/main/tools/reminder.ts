import { petEventBus } from '../eventBus';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { Reminder, TaskPriority } from '../../shared/types';

/** 提醒类型 */
export type ReminderType = 'once' | 'daily' | 'weekly' | 'monthly';

/** 重复周期（周几） */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 提醒事件接口 */
export interface ReminderEvent {
  type: 'trigger' | 'add' | 'update' | 'delete';
  reminder?: Reminder;
  reminders?: Reminder[];
}

/**
 * 提醒系统
 * 管理自定义提醒
 */
class ReminderSystem {
  /** 提醒列表 */
  private reminders: Reminder[] = [];

  /** 定时器实例 */
  private timer: NodeJS.Timeout | null = null;

  /** 提醒数据文件路径 */
  private dataFilePath: string;

  /** 事件监听器 */
  private eventListeners: Array<(event: ReminderEvent) => void> = [];

  /**
   * 创建提醒系统
   */
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataFilePath = join(userDataPath, 'reminders.json');
    this.loadReminders();
    this.startTimer();
  }

  /**
   * 从文件加载提醒
   */
  private loadReminders(): void {
    try {
      if (existsSync(this.dataFilePath)) {
        const content = readFileSync(this.dataFilePath, 'utf8');
        this.reminders = JSON.parse(content);
      }
    } catch (error) {
      console.error('加载提醒失败:', error);
      this.reminders = [];
    }
  }

  /**
   * 保存提醒到文件
   */
  private saveReminders(): void {
    try {
      const userDataPath = app.getPath('userData');
      if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
      }
      writeFileSync(this.dataFilePath, JSON.stringify(this.reminders, null, 2));
    } catch (error) {
      console.error('保存提醒失败:', error);
    }
  }

  /**
   * 启动定时器检查提醒
   */
  private startTimer(): void {
    // 计算到下一个整点的时间差
    const now = new Date();
    const secondsUntilNextMinute = 60 - now.getSeconds();
    
    // 第一次检查在整点开始
    setTimeout(() => {
      this.checkReminders();
      
      // 之后每1分钟检查一次
      this.timer = setInterval(() => {
        this.checkReminders();
      }, 60000);
    }, secondsUntilNextMinute * 1000);
  }

  /**
   * 检查是否有需要触发的提醒
   */
  private checkReminders(): void {
    const now = new Date();
    const currentTime = this.formatTime(now);
    const currentDate = this.formatDate(now);
    const currentWeekDay = now.getDay() as WeekDay;
    const currentMonthDay = now.getDate();

    this.reminders.forEach(reminder => {
      if (!reminder.enabled) return;
      if (reminder.time !== this.normalizeTime(currentTime)) return;

      let shouldTrigger = false;

      switch (reminder.type) {
        case 'once':
          if (reminder.date === currentDate) {
            shouldTrigger = true;
          }
          break;

        case 'daily':
          shouldTrigger = true;
          break;

        case 'weekly':
          if (reminder.weekDays && reminder.weekDays.includes(currentWeekDay)) {
            shouldTrigger = true;
          }
          break;

        case 'monthly':
          if (reminder.monthDay === currentMonthDay) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        // 对于非一次性提醒，检查是否是今天第一次触发
        if (reminder.type !== 'once' && reminder.lastTriggered === currentDate) {
          return;
        }
        
        reminder.lastTriggered = currentDate;
        if (reminder.type === 'once') {
          reminder.enabled = false;
        }
        this.saveReminders();
        
        // 触发更新事件，通知前端界面更新
        this.emitEvent({
          type: 'update',
          reminder,
          reminders: this.reminders
        });
        
        this.triggerReminder(reminder);
      }
    });
  }

  /**
   * 触发提醒
   * @param reminder - 提醒对象
   */
  private triggerReminder(reminder: Reminder): void {
    // 通过气泡显示提醒，携带操作按钮
    const message = reminder.description 
      ? `${reminder.title}\n${reminder.description}`
      : reminder.title;
    
    // 使用带操作按钮的 reminder 类型气泡，传递 taskId 以便完成任务
    petEventBus.showReminderBubble(message, reminder.id, reminder.taskId);
    
    // 触发事件
    this.emitEvent({
      type: 'trigger',
      reminder
    });
  }

  /**
   * 格式化时间为 HH:mm
   * @param date - 日期对象
   * @returns 时间字符串
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** 统一为 HH:mm，避免 "9:05" 与 "09:05" 不匹配 */
  private normalizeTime(time: string): string {
    const parts = time.split(':');
    if (parts.length < 2) return time;
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   * @param date - 日期对象
   * @returns 日期字符串
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 获取所有提醒
   * @returns 提醒列表
   */
  getReminders(): Reminder[] {
    return [...this.reminders];
  }

  /**
   * 添加提醒
   * @param reminder - 提醒对象（不含 id）
   * @returns 添加后的提醒对象
   */
  addReminder(reminder: Omit<Reminder, 'id' | 'lastTriggered'>): Reminder {
    const normalizedTime = this.normalizeTime(reminder.time);
    const newReminder: Reminder = {
      ...reminder,
      time: normalizedTime,
      id: this.generateId(),
      priority: reminder.priority || 'medium' // 默认优先级为中等
    };

    if (newReminder.type === 'once' && !newReminder.date) {
      newReminder.date = this.formatDate(new Date());
    }
    
    this.reminders.push(newReminder);
    this.saveReminders();
    
    this.emitEvent({
      type: 'add',
      reminder: newReminder,
      reminders: this.reminders
    });
    
    return newReminder;
  }

  /**
   * 更新提醒
   * @param id - 提醒ID
   * @param updates - 更新内容
   * @returns 更新后的提醒对象，不存在返回 null
   */
  updateReminder(id: string, updates: Partial<Omit<Reminder, 'id'>>): Reminder | null {
    const index = this.reminders.findIndex(r => r.id === id);
    if (index === -1) return null;

    const prev = this.reminders[index];
    const nextType = updates.type ?? prev.type;
    const merged: Reminder = {
      ...prev,
      ...updates,
      time: updates.time ? this.normalizeTime(updates.time) : prev.time,
    };

    if (nextType === 'once') {
      if (!merged.date) {
        merged.date = this.formatDate(new Date());
      }
    } else {
      delete merged.date;
    }
    if (nextType !== 'weekly') delete merged.weekDays;
    if (nextType !== 'monthly') delete merged.monthDay;

    this.reminders[index] = merged;
    
    this.saveReminders();
    
    this.emitEvent({
      type: 'update',
      reminder: this.reminders[index],
      reminders: this.reminders
    });
    
    return this.reminders[index];
  }

  /**
   * 删除提醒
   * @param id - 提醒ID
   * @returns 是否删除成功
   */
  deleteReminder(id: string): boolean {
    const index = this.reminders.findIndex(r => r.id === id);
    if (index === -1) return false;

    const deleted = this.reminders.splice(index, 1)[0];
    this.saveReminders();
    
    this.emitEvent({
      type: 'delete',
      reminder: deleted,
      reminders: this.reminders
    });
    
    return true;
  }

  /**
   * 切换提醒启用状态
   * @param id - 提醒ID
   * @returns 是否切换成功
   */
  toggleReminder(id: string): boolean {
    const reminder = this.reminders.find(r => r.id === id);
    if (!reminder) return false;

    reminder.enabled = !reminder.enabled;
    this.saveReminders();
    
    this.emitEvent({
      type: 'update',
      reminder,
      reminders: this.reminders
    });
    
    return true;
  }

  /**
   * 通过任务ID获取提醒
   * @param taskId - 任务ID
   * @returns 提醒对象，不存在返回null
   */
  getReminderByTaskId(taskId: string): Reminder | null {
    return this.reminders.find(r => r.taskId === taskId) || null;
  }

  /**
   * 获取任务关联的提醒
   * @param taskId - 任务ID
   * @returns 提醒列表
   */
  getRemindersByTaskId(taskId: string): Reminder[] {
    return this.reminders.filter(r => r.taskId === taskId);
  }

  /**
   * 注册事件监听器
   * @param listener - 事件监听器
   * @returns 取消注册函数
   */
  onEvent(listener: (event: ReminderEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /**
   * 触发事件
   * @param event - 事件
   */
  private emitEvent(event: ReminderEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('提醒事件监听错误:', error);
      }
    });
  }
  /**
   * 清空所有提醒
   */
  clearAllReminders(): void {
    this.reminders = [];
    this.saveReminders();
    
    this.emitEvent({
      type: 'delete',
      reminders: []
    });
  }
}

/** 提醒系统实例 */
export const reminderSystem = new ReminderSystem();
