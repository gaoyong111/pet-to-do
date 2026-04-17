/**
 * Microsoft To Do 同步模块
 *
 * 使用 Microsoft Graph API (OAuth2 Device Flow / 本地 redirect) 实现双向同步。
 *
 * 授权流程：
 *   1. 主进程通过 shell.openExternal 打开浏览器 → Azure AD 授权页
 *   2. 用户同意后 redirect 到 http://localhost:PORT/ms-callback?code=...
 *   3. 主进程本地 http server 接收 code，换取 access_token + refresh_token
 *   4. token 存储在 userData/ms-todo-token.json
 *
 * 同步策略：
 *   - 拉取：Graph /me/todo/lists → /me/todo/lists/{listId}/tasks
 *   - 推送：本地新建/更新/删除 → Graph 对应 POST/PATCH/DELETE
 *   - 冲突：以 updatedAt 较新的为准
 */

import { app, shell, ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as http from 'http';
import * as url from 'url';

/* ===== Azure AD 应用配置 ===== */
// 用户需要在 Azure 门户注册应用后填入
const MS_CLIENT_ID = process.env.MS_TODO_CLIENT_ID || '';
// 本地回调端口
const REDIRECT_PORT = 54321;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/ms-callback`;
// 所需权限
const SCOPES = ['Tasks.ReadWrite', 'Tasks.ReadWrite.Shared', 'offline_access'];
const SCOPE_STR = SCOPES.join(' ');

interface MsToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  clientId: string;
}

interface MsTodoList {
  id: string;
  displayName: string;
}

interface MsTodoTask {
  id: string;
  title: string;
  status: 'notStarted' | 'inProgress' | 'completed';
  importance: 'low' | 'normal' | 'high';
  isReminderOn: boolean;
  reminderDateTime?: { dateTime: string; timeZone: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  lastModifiedDateTime: string;
  body?: { content: string; contentType: string };
  // 我的一天
  isMyDayEnabled?: boolean;
  isMyDaySuggested?: boolean;
}

/**
 * Microsoft To Do 同步服务
 */
class MsTodoSync {
  private tokenPath: string;
  private token: MsToken | null = null;
  private callbackServer: http.Server | null = null;
  private pendingAuthResolve: ((code: string) => void) | null = null;
  private pendingDeviceCode: { deviceCode: string; clientId: string; expiresAt: number } | null = null;

  constructor() {
    this.tokenPath = join(app.getPath('userData'), 'ms-todo-token.json');
    this.loadToken();
  }

  /* ===== Token 管理 ===== */

  private loadToken(): void {
    try {
      if (existsSync(this.tokenPath)) {
        const raw = readFileSync(this.tokenPath, 'utf8');
        this.token = JSON.parse(raw);
      }
    } catch { this.token = null; }
  }

  private saveToken(token: MsToken): void {
    this.token = token;
    writeFileSync(this.tokenPath, JSON.stringify(token, null, 2));
  }

  /** 是否已授权 */
  isAuthorized(): boolean {
    return !!this.token;
  }

  /** 是否配置了 clientId */
  isConfigured(): boolean {
    return !!MS_CLIENT_ID || !!(this.token?.clientId);
  }

  /** 清除授权（退出登录） */
  logout(): void {
    this.token = null;
    try {
      if (existsSync(this.tokenPath)) {
        writeFileSync(this.tokenPath, '');
      }
    } catch {}
  }

  /* ===== OAuth2 授权 ===== */

  /**
   * 启动授权流程
   * 打开浏览器 → 等待本地回调 → 换取 token
   */
  async authorize(clientId?: string): Promise<{ success: boolean; error?: string; deviceCode?: string; verificationUri?: string }> {
    const cid = clientId || MS_CLIENT_ID;
    if (!cid) {
      return { success: false, error: 'clientId 未配置，请先在 Azure 门户注册应用并填写 Client ID' };
    }

    try {
      // 使用 Device Code Flow（不需要 client_secret，适合桌面应用）
      // 1. 获取 device code
      const deviceCodeRes = await this.getDeviceCode(cid);
      
      // 保存 device code 信息，供后续轮询使用
      this.pendingDeviceCode = {
        deviceCode: deviceCodeRes.deviceCode,
        clientId: cid,
        expiresAt: Date.now() + deviceCodeRes.expiresIn * 1000
      };
      
      // 返回 user code 给前端显示，让用户在浏览器中输入
      return {
        success: false, // 还没真正成功，需要用户完成授权
        deviceCode: deviceCodeRes.userCode,
        verificationUri: deviceCodeRes.verificationUri
      };
    } catch (e: any) {
      return { success: false, error: e.message || '授权失败' };
    }
  }
  
  /**
   * 完成 Device Code Flow 授权（用户已在浏览器输入代码后调用）
   */
  async completeDeviceAuth(_userCode?: string, _clientId?: string): Promise<{ success: boolean; error?: string }> {
    // 使用之前保存的 device code 信息
    if (!this.pendingDeviceCode) {
      return { success: false, error: '没有待完成的授权请求，请先点击"打开浏览器授权"' };
    }

    if (Date.now() > this.pendingDeviceCode.expiresAt) {
      this.pendingDeviceCode = null;
      return { success: false, error: '授权码已过期，请重新获取' };
    }

    const cid = this.pendingDeviceCode.clientId;
    const deviceCode = this.pendingDeviceCode.deviceCode;

    try {
      // 轮询等待用户授权（最多 5 分钟）
      const tokenRes = await this.pollForToken(cid, deviceCode, 5, 300);

      this.pendingDeviceCode = null;
      this.saveToken({ ...tokenRes, clientId: cid });
      return { success: true };
    } catch (e: any) {
      // 检查是否是 authorization_pending 错误
      if (e.message?.includes('authorization_pending')) {
        return { success: false, error: 'authorization_pending' };
      }
      this.pendingDeviceCode = null;
      return { success: false, error: e.message || '授权失败' };
    }
  }

  private async getDeviceCode(clientId: string): Promise<{ deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresIn: number }> {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: SCOPE_STR
    });

    console.log('[MS To Do] Requesting device code with client_id:', clientId);
    console.log('[MS To Do] Scope:', SCOPE_STR);

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await res.json() as any;
    console.log('[MS To Do] Device code response:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      throw new Error(`获取 device code 失败: ${JSON.stringify(data)}`);
    }

    // 检查是否返回了必要的字段
    if (!data.device_code || !data.user_code || !data.verification_uri) {
      throw new Error(`返回数据格式错误: ${JSON.stringify(data)}`);
    }

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      interval: data.interval || 5,
      expiresIn: data.expires_in || 900
    };
  }

  private async pollForToken(clientId: string, deviceCode: string, interval: number, expiresIn: number): Promise<Omit<MsToken, 'clientId'>> {
    const startTime = Date.now();
    const params = new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });

    while (Date.now() - startTime < expiresIn * 1000) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000));

      console.log('[MS To Do] Polling for token...');
      const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (res.ok) {
        const data = await res.json() as any;
        console.log('[MS To Do] Token received successfully');
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000
        };
      }

      const errorData = await res.json().catch(() => ({}));
      console.log('[MS To Do] Poll error:', errorData);
      if (errorData.error === 'authorization_pending') {
        // 用户还没授权，继续等待
        continue;
      } else if (errorData.error === 'slow_down') {
        // 请求太频繁，增加间隔
        interval += 5;
        continue;
      } else {
        throw new Error(`授权失败: ${errorData.error_description || errorData.error}`);
      }
    }

    throw new Error('授权超时，请重试');
  }

  private startLocalCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      // 如果服务器已存在，先关闭
      if (this.callbackServer) {
        this.stopCallbackServer();
      }

      this.pendingAuthResolve = resolve;
      this.callbackServer = http.createServer((req, res) => {
        const parsed = url.parse(req.url || '', true);
        if (parsed.pathname === '/ms-callback') {
          const code = parsed.query.code as string;
          const error = parsed.query.error as string;
          res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
          if (code) {
            res.end('<h2>授权成功！请返回桌宠应用 🎉</h2><script>window.close()</script>');
            if (this.pendingAuthResolve) {
              this.pendingAuthResolve(code);
              this.pendingAuthResolve = null;
            }
          } else {
            res.end(`<h2>授权失败：${error}</h2>`);
            reject(new Error(error || '授权被拒绝'));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.callbackServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`端口 ${REDIRECT_PORT} 已被占用，请关闭其他实例后重试`));
        } else {
          reject(err);
        }
      });

      this.callbackServer.listen(REDIRECT_PORT, '127.0.0.1', () => {
        // 服务器已启动
      });
    });
  }

  private stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  private async exchangeCodeForToken(clientId: string, code: string): Promise<Omit<MsToken, 'clientId'>> {
    const params = new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPE_STR
    });

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`换取 token 失败: ${err}`);
    }

    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000
    };
  }

  /** 刷新过期 token */
  private async refreshAccessToken(): Promise<void> {
    if (!this.token) throw new Error('未授权');
    const params = new URLSearchParams({
      client_id: this.token.clientId,
      refresh_token: this.token.refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPE_STR
    });

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      this.token = null;
      throw new Error('Token 刷新失败，请重新授权');
    }

    const data = await res.json() as any;
    this.saveToken({
      ...this.token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000
    });
  }

  /** 获取有效 access token */
  private async getAccessToken(): Promise<string> {
    if (!this.token) throw new Error('未授权');
    // 提前 60 秒刷新
    if (this.token.expiresAt - Date.now() < 60000) {
      await this.refreshAccessToken();
    }
    return this.token!.accessToken;
  }

  /* ===== Graph API 请求 ===== */

  private async graphGet<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Graph GET ${path} 失败: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async graphPost<T>(path: string, body: any): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Graph POST ${path} 失败: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async graphPatch<T>(path: string, body: any): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Graph PATCH ${path} 失败: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async graphDelete(path: string): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok && res.status !== 404) throw new Error(`Graph DELETE ${path} 失败: ${res.status}`);
  }

  /* ===== 同步逻辑 ===== */

  /**
   * 拉取 MS To Do 所有列表和任务
   * 返回经过本地化的任务数组
   */
  async pullFromMsTodo(): Promise<{ lists: any[]; tasks: any[] }> {
    const listsRes = await this.graphGet<{ value: MsTodoList[] }>('/me/todo/lists');
    const msLists = listsRes.value;

    const allTasks: any[] = [];
    const localLists: any[] = msLists.map(l => ({
      id: `ms-${l.id}`,
      name: l.displayName,
      icon: '📌',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      microsoftToDoId: l.id
    }));

    // 找到"我的一天"列表（通常显示名称为 "我的一天" 或 "My Day"）
    const myDayList = msLists.find(l => 
      l.displayName === '我的一天' || 
      l.displayName === 'My Day' ||
      l.displayName.toLowerCase().includes('my day')
    );

    for (const list of msLists) {
      const isMyDayList = myDayList && list.id === myDayList.id;
      let nextLink = `/me/todo/lists/${list.id}/tasks?$top=100`;
      while (nextLink) {
        const res = await this.graphGet<{ value: MsTodoTask[]; '@odata.nextLink'?: string }>(
          nextLink.startsWith('https://') ? nextLink.replace('https://graph.microsoft.com/v1.0', '') : nextLink
        );
        for (const t of res.value) {
          const task = this.msTaskToLocal(t, `ms-${list.id}`, list.id, isMyDayList);
          
          // 如果不是"我的一天"列表，但任务已经在 allTasks 中且标记为 inMyDay，不要覆盖
          if (!isMyDayList) {
            const existingTask = allTasks.find(et => et.id === task.id);
            if (existingTask && existingTask.inMyDay) {
              continue;
            }
          }
          
          allTasks.push(task);
        }
        nextLink = res['@odata.nextLink']
          ? res['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
          : '';
      }
    }

    // 去重任务，保留 inMyDay 为 true 的版本
    const uniqueTasksMap = new Map();
    for (const task of allTasks) {
      const existingTask = uniqueTasksMap.get(task.id);
      if (!existingTask || (task.inMyDay && !existingTask.inMyDay)) {
        uniqueTasksMap.set(task.id, task);
      }
    }

    return { lists: localLists, tasks: Array.from(uniqueTasksMap.values()) };
  }

  /** 将 MS 任务转换为本地格式 */
  private msTaskToLocal(t: MsTodoTask, listId: string, msListId: string, isMyDayList: boolean = false): any {
    const priority = t.importance === 'high' ? 'high' : t.importance === 'low' ? 'low' : 'medium';
    const status = t.status === 'completed' ? 'completed' : 'todo';
    return {
      id: `ms-${t.id}`,
      listId,
      title: t.title,
      description: t.body?.content || '',
      status,
      priority,
      isImportant: t.importance === 'high',
      inMyDay: isMyDayList || false,  // 如果是"我的一天"列表，标记为 inMyDay
      dueDate: t.dueDateTime?.dateTime?.slice(0, 10),
      dueTime: t.dueDateTime?.dateTime?.slice(11, 16),
      createdAt: t.lastModifiedDateTime,
      updatedAt: t.lastModifiedDateTime,
      microsoftToDoId: t.id,
      microsoftToDoListId: msListId,
      source: 'microsoft' as const  // 标记为从 MS 同步的任务
    };
  }

  /**
   * 推送本地任务到 MS To Do（仅推送有 microsoftToDoId 的，或新建）
   * @param task 本地任务
   * @param msListId MS 列表 ID
   * @param syncMyDay 是否同步"我的一天"状态（默认为 true）
   */
  async pushTaskToMsTodo(task: any, msListId: string, syncMyDay: boolean = true): Promise<string | null> {
    const body: any = {
      title: task.title,
      importance: task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'normal',
      status: task.status === 'completed' ? 'completed' : 'notStarted'
    };
    if (task.description) {
      body.body = { content: task.description, contentType: 'text' };
    }
    if (task.dueDate) {
      body.dueDateTime = { dateTime: `${task.dueDate}T${task.dueTime || '09:00'}:00`, timeZone: 'Asia/Shanghai' };
    }
    // 同步"我的一天"状态
    if (syncMyDay) {
      body.isMyDayEnabled = task.inMyDay || false;
    }

    if (task.microsoftToDoId) {
      await this.graphPatch(`/me/todo/lists/${msListId}/tasks/${task.microsoftToDoId}`, body);
      return task.microsoftToDoId;
    } else {
      const created = await this.graphPost<MsTodoTask>(`/me/todo/lists/${msListId}/tasks`, body);
      return created.id;
    }
  }

  /** 删除 MS To Do 中的任务 */
  async deleteTaskFromMsTodo(msListId: string, msTaskId: string): Promise<void> {
    await this.graphDelete(`/me/todo/lists/${msListId}/tasks/${msTaskId}`);
  }

  /**
   * 反向同步：将本地任务推送到 MS To Do
   * @param localTasks 本地任务列表
   * @param msListId MS 列表 ID
   * @returns 推送结果
   */
  async pushLocalTasksToMsTodo(localTasks: any[], msListId: string): Promise<{ success: number; failed: number; results: any[] }> {
    const results: any[] = [];
    let success = 0;
    let failed = 0;

    for (const task of localTasks) {
      // 只推送本地创建的任务（没有 microsoftToDoId）
      if (task.microsoftToDoId) {
        continue; // 已有 MS ID 的任务不重复推送
      }

      try {
        const msId = await this.pushTaskToMsTodo(task, msListId);
        if (msId) {
          success++;
          results.push({ taskId: task.id, msId, success: true });
        } else {
          failed++;
          results.push({ taskId: task.id, success: false });
        }
      } catch (e: any) {
        failed++;
        results.push({ taskId: task.id, error: e.message, success: false });
      }
    }

    return { success, failed, results };
  }
}

export const msTodoSync = new MsTodoSync();

/**
 * 注册 MS To Do 相关 IPC handlers
 */
export function registerMsTodoIpc(): void {
  ipcMain.handle('ms-todo-status', () => ({
    authorized: msTodoSync.isAuthorized(),
    configured: msTodoSync.isConfigured()
  }));

  ipcMain.handle('ms-todo-authorize', async (_e, clientId?: string) => {
    return msTodoSync.authorize(clientId);
  });

  ipcMain.handle('ms-todo-complete-auth', async (_e, deviceCode: string, clientId?: string) => {
    return msTodoSync.completeDeviceAuth(deviceCode, clientId);
  });

  ipcMain.handle('ms-todo-logout', () => {
    msTodoSync.logout();
    return true;
  });

  ipcMain.handle('ms-todo-pull', async () => {
    try {
      return await msTodoSync.pullFromMsTodo();
    } catch (e: any) {
      return { error: e.message };
    }
  });

  ipcMain.handle('ms-todo-push', async (_e, task: any, msListId: string) => {
    try {
      const msId = await msTodoSync.pushTaskToMsTodo(task, msListId);
      return { success: true, microsoftToDoId: msId };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ms-todo-delete', async (_e, msListId: string, msTaskId: string) => {
    try {
      await msTodoSync.deleteTaskFromMsTodo(msListId, msTaskId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ms-todo-push-local', async (_e, localTasks: any[], msListId: string) => {
    try {
      return await msTodoSync.pushLocalTasksToMsTodo(localTasks, msListId);
    } catch (e: any) {
      return { success: 0, failed: localTasks.length, error: e.message, results: [] };
    }
  });
}
