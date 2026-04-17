import { app, BrowserWindow } from 'electron';
import fetch from 'node-fetch';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { reminderSystem, Reminder } from './reminder';

/** Microsoft To Do 认证配置 */
export interface MicrosoftToDoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  enabled: boolean;
  syncInterval: number; // 同步间隔（分钟）
  lastSync: string | null;
  token: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null;
}

/** Microsoft To Do 任务 */
export interface MicrosoftToDoTask {
  id: string;
  title: string;
  body: {
    content: string;
    contentType: string;
  };
  dueDateTime: {
    dateTime: string;
    timeZone: string;
  } | null;
  recurrence: {
    pattern: {
      type: string;
      interval: number;
      daysOfWeek?: string[];
      dayOfMonth?: number;
    };
    range: {
      type: string;
    };
  } | null;
  status: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

/** Microsoft To Do 任务列表 */
export interface MicrosoftToDoList {
  id: string;
  displayName: string;
  wellknownListName: string | null;
}

/**
 * Microsoft To Do 集成
 * 实现与 Microsoft To Do 的双向同步
 */
class MicrosoftToDoIntegration {
  /** 配置文件路径 */
  private configPath: string;
  /** 配置 */
  private config: MicrosoftToDoConfig;
  /** 同步定时器 */
  private syncTimer: NodeJS.Timeout | null = null;
  /** 正在同步标志 */
  private isSyncing = false;

  /**
   * 创建 Microsoft To Do 集成
   */
  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'microsoft-to-do-config.json');
    this.config = this.loadConfig();
    this.startSyncTimer();
  }

  /**
   * 加载配置
   */
  private loadConfig(): MicrosoftToDoConfig {
    try {
      if (existsSync(this.configPath)) {
        const content = readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('加载 Microsoft To Do 配置失败:', error);
    }

    return {
      clientId: '',
      clientSecret: '',
      redirectUri: 'http://localhost:3000/callback',
      enabled: false,
      syncInterval: 15, // 默认 15 分钟
      lastSync: null,
      token: null
    };
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    try {
      const userDataPath = app.getPath('userData');
      if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('保存 Microsoft To Do 配置失败:', error);
    }
  }

  /**
   * 启动同步定时器
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.config.enabled && this.config.token) {
      this.syncTimer = setInterval(() => {
        this.sync();
      }, this.config.syncInterval * 60 * 1000);
    }
  }

  /**
   * 开始认证流程
   * @param mainWindow - 主窗口
   * @returns Promise<string> - 认证 URL
   */
  async startAuth(mainWindow: BrowserWindow): Promise<string> {
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
      client_id=${this.config.clientId}&
      response_type=code&
      redirect_uri=${encodeURIComponent(this.config.redirectUri)}&
      scope=User.Read%20Tasks.ReadWrite%20Tasks.ReadWrite.Shared`;

    return authUrl;
  }

  /**
   * 处理认证回调
   * @param code - 授权码
   * @returns Promise<boolean> - 是否成功
   */
  async handleAuthCallback(code: string): Promise<boolean> {
    try {
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      if (!tokenResponse.ok) {
        throw new Error('Token request failed');
      }

      const tokenData = await tokenResponse.json();
      this.config.token = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      };

      this.saveConfig();
      this.startSyncTimer();
      return true;
    } catch (error) {
      console.error('认证回调处理失败:', error);
      return false;
    }
  }

  /**
   * 刷新访问令牌
   * @returns Promise<boolean> - 是否成功
   */
  private async refreshToken(): Promise<boolean> {
    if (!this.config.token?.refreshToken) {
      return false;
    }

    try {
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.token.refreshToken,
          grant_type: 'refresh_token'
        }).toString()
      });

      if (!tokenResponse.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await tokenResponse.json();
      this.config.token = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      };

      this.saveConfig();
      return true;
    } catch (error) {
      console.error('刷新令牌失败:', error);
      return false;
    }
  }

  /**
   * 确保令牌有效
   * @returns Promise<boolean> - 是否有效
   */
  private async ensureTokenValid(): Promise<boolean> {
    if (!this.config.token) {
      return false;
    }

    if (Date.now() >= this.config.token.expiresAt) {
      return await this.refreshToken();
    }

    return true;
  }

  /**
   * 调用 Microsoft Graph API
   * @param endpoint - API 端点
   * @param method - HTTP 方法
   * @param body - 请求体
   * @returns Promise<any> - 响应数据
   */
  private async callGraphApi(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!await this.ensureTokenValid()) {
      throw new Error('Token not valid');
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.token?.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 获取所有任务列表
   * @returns Promise<MicrosoftToDoList[]> - 任务列表
   */
  async getTaskLists(): Promise<MicrosoftToDoList[]> {
    const data = await this.callGraphApi('/me/todo/lists');
    return data.value;
  }

  /**
   * 获取任务列表中的任务
   * @param listId - 任务列表 ID
   * @returns Promise<MicrosoftToDoTask[]> - 任务列表
   */
  async getTasks(listId: string): Promise<MicrosoftToDoTask[]> {
    const data = await this.callGraphApi(`/me/todo/lists/${listId}/tasks`);
    return data.value;
  }

  /**
   * 同步数据
   */
  async sync(): Promise<void> {
    if (!this.config.enabled || !this.config.token || this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      // 获取所有任务列表
      const lists = await this.getTaskLists();
      const defaultList = lists.find(list => list.wellknownListName === 'defaultList') || lists[0];

      if (!defaultList) {
        throw new Error('No task lists found');
      }

      // 获取 Microsoft To Do 任务
      const tasks = await this.getTasks(defaultList.id);

      // 同步到本地提醒
      await this.syncToLocal(tasks);

      // 同步本地提醒到 Microsoft To Do
      await this.syncToMicrosoftToDo(defaultList.id);

      this.config.lastSync = new Date().toISOString();
      this.saveConfig();
    } catch (error) {
      console.error('同步失败:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步 Microsoft To Do 任务到本地提醒
   * @param tasks - Microsoft To Do 任务
   */
  private async syncToLocal(tasks: MicrosoftToDoTask[]): Promise<void> {
    const localReminders = reminderSystem.getReminders();
    const localIds = new Set(localReminders.map(r => r.id));

    for (const task of tasks) {
      if (task.status === 'completed') continue;

      // 检查是否已存在
      const existing = localReminders.find(r => r.id === `msft_${task.id}`);

      if (existing) {
        // 更新现有提醒
        await reminderSystem.updateReminder(existing.id, {
          title: task.title,
          description: task.body?.content || '',
          time: this.parseTimeFromDateTime(task.dueDateTime?.dateTime),
          enabled: true
        });
      } else {
        // 创建新提醒
        const reminder = this.mapTaskToReminder(task);
        if (reminder) {
          await reminderSystem.addReminder(reminder);
        }
      }

      localIds.delete(`msft_${task.id}`);
    }

    // 删除本地存在但 Microsoft To Do 中不存在的提醒
    for (const id of localIds) {
      if (id.startsWith('msft_')) {
        await reminderSystem.deleteReminder(id);
      }
    }
  }

  /**
   * 同步本地提醒到 Microsoft To Do
   * @param listId - 任务列表 ID
   */
  private async syncToMicrosoftToDo(listId: string): Promise<void> {
    const localReminders = reminderSystem.getReminders();
    const tasks = await this.getTasks(listId);
    const taskIds = new Set(tasks.map(t => t.id));

    for (const reminder of localReminders) {
      if (reminder.id.startsWith('msft_')) {
        // 已经从 Microsoft To Do 同步的提醒
        const taskId = reminder.id.replace('msft_', '');
        if (taskIds.has(taskId)) {
          // 更新现有任务
          await this.callGraphApi(`/me/todo/lists/${listId}/tasks/${taskId}`, 'PATCH', {
            title: reminder.title,
            body: {
              content: reminder.description || '',
              contentType: 'text'
            },
            dueDateTime: this.formatDateTimeFromReminder(reminder)
          });
        }
      } else {
        // 本地创建的提醒，同步到 Microsoft To Do
        const taskData = this.mapReminderToTask(reminder);
        if (taskData) {
          await this.callGraphApi(`/me/todo/lists/${listId}/tasks`, 'POST', taskData);
        }
      }
    }
  }

  /**
   * 将 Microsoft To Do 任务映射为本地提醒
   * @param task - Microsoft To Do 任务
   * @returns Omit<Reminder, 'id' | 'lastTriggered'> | null
   */
  private mapTaskToReminder(task: