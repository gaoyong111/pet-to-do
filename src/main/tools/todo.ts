import { petEventBus } from '../eventBus';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { reminderSystem } from './reminder';
import { TodoTask, TaskStatus, TaskPriority, TaskFilter, TaskRecurrence, TaskEvent, Reminder } from '../../shared/types';

/**
 * 任务系统
 * 管理本地任务，与提醒系统集成
 */
class TodoSystem {
  /** 任务列表 */
  private tasks: TodoTask[] = [];

  /** 任务数据文件路径 */
  private dataFilePath: string;

  /** 事件监听器 */
  private eventListeners: Array<(event: TaskEvent) => void> = [];

  /**
   * 创建任务系统
   */
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataFilePath = join(userDataPath, 'tasks.json');
    this.loadTasks();
  }

  /**
   * 从文件加载任务
   */
  private loadTasks(): void {
    try {
      if (existsSync(this.dataFilePath)) {
        const content = readFileSync(this.dataFilePath, 'utf8');
        this.tasks = JSON.parse(content);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      this.tasks = [];
    }
  }

  /**
   * 保存任务到文件
   */
  private saveTasks(): void {
    try {
      const userDataPath = app.getPath('userData');
      if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
      }
      writeFileSync(this.dataFilePath, JSON.stringify(this.tasks, null, 2));
    } catch (error) {
      console.error('保存任务失败:', error);
    }
  }

  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 获取当前时间字符串
   * @returns ISO时间字符串
   */
  private getCurrentTime(): string {
    return new Date().toISOString();
  }

  /**
   * 获取任务列表
   * @param filters 过滤条件
   * @returns 任务列表
   */
  getTasks(filters?: TaskFilter): TodoTask[] {
    let filteredTasks = [...this.tasks];

    if (filters) {
      if (filters.status && filters.status.length > 0) {
        filteredTasks = filteredTasks.filter(task => filters.status!.includes(task.status));
      }

      if (filters.priority && filters.priority.length > 0) {
        filteredTasks = filteredTasks.filter(task => filters.priority!.includes(task.priority));
      }

      if (filters.tags && filters.tags.length > 0) {
        filteredTasks = filteredTasks.filter(task => {
          if (!task.tags) return false;
          return filters.tags!.some(tag => task.tags!.includes(tag));
        });
      }

      if (filters.dueDateFrom) {
        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;
          return task.dueDate >= filters.dueDateFrom!;
        });
      }

      if (filters.dueDateTo) {
        filteredTasks = filteredTasks.filter(task => {
          if (!task.dueDate) return false;
          return task.dueDate <= filters.dueDateTo!;
        });
      }
    }

    return filteredTasks;
  }

  /**
   * 获取任务
   * @param id 任务ID
   * @returns 任务对象，不存在返回null
   */
  getTask(id: string): TodoTask | null {
    return this.tasks.find(task => task.id === id) || null;
  }

  /**
   * 添加任务
   * @param task 任务对象（不含id、createdAt、updatedAt）
   * @returns 添加后的任务对象
   */
  addTask(task: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>): TodoTask {
    const newTask: TodoTask = {
      ...task,
      id: this.generateId(),
      createdAt: this.getCurrentTime(),
      updatedAt: this.getCurrentTime()
    };

    this.tasks.push(newTask);
    this.saveTasks();

    this.emitEvent({
      type: 'add',
      task: newTask,
      tasks: this.tasks
    });

    return newTask;
  }

  /**
   * 更新任务
   * @param id 任务ID
   * @param updates 更新内容
   * @returns 更新后的任务对象，不存在返回null
   */
  updateTask(id: string, updates: Partial<Omit<TodoTask, 'id' | 'createdAt'>>): TodoTask | null {
    const index = this.tasks.findIndex(task => task.id === id);
    if (index === -1) return null;

    const updatedTask: TodoTask = {
      ...this.tasks[index],
      ...updates,
      updatedAt: this.getCurrentTime()
    };

    this.tasks[index] = updatedTask;
    this.saveTasks();

    this.emitEvent({
      type: 'update',
      task: updatedTask,
      tasks: this.tasks
    });

    return updatedTask;
  }

  /**
   * 删除任务
   * @param id 任务ID
   * @returns 是否删除成功
   */
  deleteTask(id: string): boolean {
    const index = this.tasks.findIndex(task => task.id === id);
    if (index === -1) return false;

    const deletedTask = this.tasks.splice(index, 1)[0];
    
    // 如果任务关联了提醒，删除提醒
    if (deletedTask.reminderId) {
      reminderSystem.deleteReminder(deletedTask.reminderId);
    }

    this.saveTasks();

    this.emitEvent({
      type: 'delete',
      task: deletedTask,
      tasks: this.tasks
    });

    return true;
  }

  /**
   * 切换任务状态（两态：todo ↔ completed）
   * @param id 任务ID
   * @returns 是否切换成功
   */
  toggleTaskStatus(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    const newStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    const updates: Partial<Omit<TodoTask, 'id' | 'createdAt'>> = {
      status: newStatus,
      updatedAt: this.getCurrentTime()
    };

    if (newStatus === 'completed') {
      updates.completedAt = this.getCurrentTime();
      // 如果任务关联了提醒，标记提醒为已完成
      if (task.reminderId) {
        reminderSystem.updateReminder(task.reminderId, { enabled: false });
      }
    } else {
      updates.completedAt = undefined;
      // 如果任务关联了提醒，重新启用提醒
      if (task.reminderId) {
        reminderSystem.updateReminder(task.reminderId, { enabled: true });
      }
    }

    this.updateTask(id, updates);

    this.emitEvent({
      type: 'statusChange',
      task: { ...task, ...updates, status: newStatus },
      tasks: this.tasks
    });

    return true;
  }

  /**
   * 设置任务优先级
   * @param id 任务ID
   * @param priority 优先级
   * @returns 是否设置成功
   */
  setTaskPriority(id: string, priority: TaskPriority): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    this.updateTask(id, { priority, updatedAt: this.getCurrentTime() });
    return true;
  }

  /**
   * 为任务创建提醒
   * @param taskId 任务ID
   * @param reminderConfig 提醒配置
   * @returns 提醒ID，失败返回null
   */
  createReminderForTask(taskId: string, reminderConfig?: Partial<Reminder>): string | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    // 如果任务已有提醒，先删除
    if (task.reminderId) {
      reminderSystem.deleteReminder(task.reminderId);
    }

    // 创建提醒配置
    const reminder: Omit<Reminder, 'id' | 'lastTriggered'> = {
      title: task.title,
      description: task.description,
      type: task.dueDate ? 'once' : 'daily',
      time: task.dueTime || '09:00',
      date: task.dueDate,
      enabled: true,
      taskId: task.id,
      priority: task.priority,
      ...reminderConfig
    };

    const newReminder = reminderSystem.addReminder(reminder);
    
    // 更新任务关联
    this.updateTask(taskId, { reminderId: newReminder.id });

    return newReminder.id;
  }

  /**
   * 将任务关联到提醒
   * @param taskId 任务ID
   * @param reminderId 提醒ID
   * @returns 是否关联成功
   */
  linkTaskToReminder(taskId: string, reminderId: string): boolean {
    const task = this.getTask(taskId);
    const reminder = reminderSystem.getReminders().find(r => r.id === reminderId);

    if (!task || !reminder) return false;

    // 更新任务关联
    this.updateTask(taskId, { reminderId });

    // 更新提醒关联
    reminderSystem.updateReminder(reminderId, { taskId });

    return true;
  }

  /**
   * 解除任务与提醒的关联
   * @param taskId 任务ID
   * @returns 是否解除成功
   */
  unlinkTaskFromReminder(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task || !task.reminderId) return false;

    const reminderId = task.reminderId;

    // 更新任务
    this.updateTask(taskId, { reminderId: undefined });

    // 更新提醒
    reminderSystem.updateReminder(reminderId, { taskId: undefined });

    return true;
  }

  /**
   * 获取任务关联的提醒
   * @param taskId 任务ID
   * @returns 提醒对象，不存在返回null
   */
  getTaskReminder(taskId: string): Reminder | null {
    const task = this.getTask(taskId);
    if (!task || !task.reminderId) return null;

    return reminderSystem.getReminders().find(r => r.id === task.reminderId) || null;
  }

  /**
   * 注册事件监听器
   * @param listener 事件监听器
   * @returns 取消注册函数
   */
  onEvent(listener: (event: TaskEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /**
   * 触发事件
   * @param event 事件
   */
  private emitEvent(event: TaskEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('任务事件监听错误:', error);
      }
    });
  }
  /**
   * 清空所有任务
   */
  clearAllTasks(): void {
    // 先清空所有关联的提醒
    for (const task of this.tasks) {
      if (task.reminderId) {
        reminderSystem.deleteReminder(task.reminderId);
      }
    }
    
    this.tasks = [];
    this.saveTasks();
    
    this.emitEvent({
      type: 'delete',
      task: null as any,
      tasks: []
    });
  }
}

/** 任务系统实例 */
export const todoSystem = new TodoSystem();
