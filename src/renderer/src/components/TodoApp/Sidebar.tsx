import React, { useState, useEffect, useCallback } from 'react';
import { SidebarProps } from './types';
import { useTodoStore } from './store/useTodoStore';
import { mergeMsTasks } from './utils/msSync';

export const Sidebar = ({ 
  lists, 
  selectedListId, 
  onSelectList, 
  getTaskCount,
  onClose,
  showCompleted,
  onToggleShowCompleted,
  onAddTask
}: SidebarProps) => {
  const [msStatus, setMsStatus] = useState<{ authorized: boolean; configured: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [clientId, setClientId] = useState('');
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<{ userCode: string; deviceCode: string; verificationUri: string } | null>(null);

  // 添加任务输入框状态
  const [showAddInput, setShowAddInput] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState('');

  // 组件挂载时检查 MS 状态并自动同步
  useEffect(() => {
    const initMsSync = async () => {
      if (!window.petAPI?.msTodoStatus || !window.petAPI?.msTodoPull) return;
      
      const status = await window.petAPI.msTodoStatus();
      setMsStatus(status);
      
      // 如果已授权，自动同步
      if (status.authorized) {
        setSyncing(true);
        setSyncMsg('正在同步...');
        try {
          const result = await window.petAPI.msTodoPull();
          if (result.error) {
            setSyncMsg(`同步失败：${result.error}`);
          } else {
            const count = result.tasks?.length || 0;
            setSyncMsg(`同步成功，拉取 ${count} 条任务 ✅`);
            if (result.tasks && result.tasks.length > 0) {
              // 合并 MS 任务与本地任务，保护本地状态（如 isImportant）
              const mergedTasks = mergeMsTasks(useTodoStore.getState().tasks, result.tasks);
              useTodoStore.getState().setTasks(mergedTasks);
              // 持久化到主进程
              window.petAPI?.taskSetAll?.(mergedTasks);
            }
            if (result.lists && result.lists.length > 0) {
              useTodoStore.getState().setLists(result.lists);
              // 设置默认 MS 列表 ID（第一个 MS 列表）
              const msList = result.lists.find((l: any) => l.microsoftToDoId);
              if (msList) {
                useTodoStore.getState().setDefaultMsListId(msList.id);
              }
            }
          }
        } finally {
          setSyncing(false);
        }
      }
    };
    
    initMsSync();
  }, []);

  const handleMsAuthorize = useCallback(async () => {
    if (!window.petAPI?.msTodoAuthorize) return;
    const id = clientId.trim() || undefined;
    setSyncMsg('正在获取授权码，请稍候...');
    setDeviceCodeInfo(null);
    const result = await window.petAPI.msTodoAuthorize(id);
    if (result.success) {
      setSyncMsg('授权成功 ✅');
      setDeviceCodeInfo(null);
      const status = await window.petAPI.msTodoStatus();
      setMsStatus(status);
      setShowClientIdInput(false);
    } else if (result.deviceCode && result.verificationUri) {
      // Device Code Flow - 显示代码给用户
      // 注意：result.deviceCode 实际上是 userCode（短码），后端保存了真正的 deviceCode
      setDeviceCodeInfo({ userCode: result.deviceCode, deviceCode: result.deviceCode, verificationUri: result.verificationUri });
      setSyncMsg('请在浏览器中输入以下代码完成授权');
      // 自动打开浏览器（不自动填充，让用户手动输入更可靠）
      window.open(result.verificationUri, '_blank');
      // 开始轮询等待用户完成授权（不传 deviceCode，让后端用保存的）
      pollForAuthCompletion(id);
    } else {
      setSyncMsg(`授权失败：${result.error}`);
      setDeviceCodeInfo(null);
    }
  }, [clientId]);

  // 轮询等待用户完成 Device Code 授权
  const pollForAuthCompletion = useCallback(async (clientId?: string) => {
    if (!window.petAPI?.msTodoCompleteAuth) return;

    setSyncMsg('等待授权完成...');
    const maxAttempts = 60; // 最多轮询 5 分钟 (60 * 5s)

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 每 5 秒检查一次

      const result = await window.petAPI.msTodoCompleteAuth('', clientId);
      if (result.success) {
        setSyncMsg('授权成功 ✅');
        setDeviceCodeInfo(null);
        const status = await window.petAPI.msTodoStatus();
        setMsStatus(status);
        setShowClientIdInput(false);
        return;
      } else if (result.error?.includes('authorization_pending')) {
        // 用户还没授权，继续等待
        continue;
      } else {
        setSyncMsg(`授权失败：${result.error}`);
        setDeviceCodeInfo(null);
        return;
      }
    }

    setSyncMsg('授权超时，请重试');
    setDeviceCodeInfo(null);
  }, []);

  const handleMsSync = useCallback(async () => {
    if (!window.petAPI?.msTodoPull || !window.petAPI?.msTodoPushLocal) return;
    setSyncing(true);
    setSyncMsg('正在同步...');
    try {
      // 1. 先推送本地任务到 MS（反向同步）
      const currentTasks = useTodoStore.getState().tasks;
      const localTasks = currentTasks.filter(t => !t.microsoftToDoId && t.source !== 'microsoft');
      
      if (localTasks.length > 0) {
        const defaultMsListId = useTodoStore.getState().defaultMsListId;
        if (defaultMsListId) {
          // 获取 MS 列表 ID（去掉 ms- 前缀）
          const msListId = defaultMsListId.replace('ms-', '');
          const pushResult = await window.petAPI.msTodoPushLocal(localTasks, msListId);
          
          if (pushResult.success > 0) {
            // 更新本地任务，添加 MS ID
            const updatedTasks = [...currentTasks];
            for (const res of pushResult.results) {
              if (res.success && res.msId) {
                const taskIndex = updatedTasks.findIndex(t => t.id === res.taskId);
                if (taskIndex >= 0) {
                  updatedTasks[taskIndex] = {
                    ...updatedTasks[taskIndex],
                    microsoftToDoId: res.msId,
                    microsoftToDoListId: msListId
                  };
                }
              }
            }
            useTodoStore.getState().setTasks(updatedTasks);
            setSyncMsg(`反向同步成功：推送 ${pushResult.success} 个任务到 MS ✅`);
          }
        }
      }

      // 2. 从 MS 拉取任务
      const result = await window.petAPI.msTodoPull();
      if (result.error) {
        setSyncMsg(`同步失败：${result.error}`);
        return;
      }
      
      const count = result.tasks?.length || 0;
      setSyncMsg(`同步成功，拉取 ${count} 条任务 ✅`);
      
      // 3. 合并任务：保留本地 isImportant 等标志，不被 MS 数据覆盖
      if (result.tasks && result.tasks.length > 0) {
        const msTasks = result.tasks;
        
        // 合并：MS 任务与本地任务按 microsoftToDoId 匹配合并，保护本地 isImportant 等状态
        const mergedTasks = mergeMsTasks(useTodoStore.getState().tasks, msTasks);
        useTodoStore.getState().setTasks(mergedTasks);
        window.petAPI?.taskSetAll?.(mergedTasks);
        
        // 为有到期日期的任务创建提醒（仅当天）
        const today = new Date().toISOString().split('T')[0];
        for (const task of msTasks) {
          if (task.dueDate === today && window.petAPI?.reminderAdd) {
            const reminder = {
              title: task.title,
              message: `任务到期提醒: ${task.title}`,
              type: 'once' as const,
              time: task.dueTime || '09:00',
              date: task.dueDate,
              enabled: true,
              taskId: task.id,
              priority: task.priority || 'medium' as const
            };
            window.petAPI.reminderAdd(reminder).catch(() => {});
          }
        }
      }
      if (result.lists && result.lists.length > 0) {
        useTodoStore.getState().setLists(result.lists);
        // 设置默认 MS 列表 ID
        const msList = result.lists.find((l: any) => l.microsoftToDoId);
        if (msList) {
          useTodoStore.getState().setDefaultMsListId(msList.id);
        }
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleMsLogout = useCallback(async () => {
    if (!window.petAPI?.msTodoLogout) return;
    await window.petAPI.msTodoLogout();
    const status = await window.petAPI.msTodoStatus();
    setMsStatus(status);
    setSyncMsg('已退出登录');
  }, []);

  // 清空本地所有任务和提醒
  const handleClearAllData = useCallback(async () => {
    if (!confirm('⚠️ 确认清空所有本地任务和提醒数据？\n\n此操作不可恢复！')) {
      return;
    }
    
    try {
      // 先清空提醒
      if (window.petAPI?.reminderClearAll) {
        await window.petAPI.reminderClearAll();
      }
      // 再清空任务
      if (window.petAPI?.taskClearAll) {
        await window.petAPI.taskClearAll();
      }
      // 刷新 store
      useTodoStore.getState().setTasks([]);
      setSyncMsg('✅ 已清空所有本地数据');
    } catch (error) {
      console.error('清空数据失败:', error);
      setSyncMsg('❌ 清空失败');
    }
  }, []);

  // MS To Do 特殊列表（硬编码）
  const specialLists = [
    { id: 'my-day', name: '今日待办', icon: '📅', isMyDay: true },
    { id: 'important', name: '重要', icon: '⭐', isMyDay: false },
    { id: 'all', name: '所有任务', icon: '📋', isMyDay: false },
    { id: 'completed-list', name: '已完成', icon: '✓', isMyDay: false },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>任务</h2>
        <button
          className="sidebar-add-btn"
          onClick={() => setShowAddInput(!showAddInput)}
          title="添加任务"
        >
          +
        </button>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} title="关闭">
            ✕
          </button>
        )}
      </div>
      
      {/* 添加任务输入区 */}
      {showAddInput && (
        <div className="sidebar-add-task">
          <input
            type="text"
            className="sidebar-add-input"
            value={addTaskTitle}
            onChange={e => setAddTaskTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onAddTask(addTaskTitle);
                setAddTaskTitle('');
                setShowAddInput(false);
              }
              if (e.key === 'Escape') {
                setAddTaskTitle('');
                setShowAddInput(false);
              }
            }}
            placeholder="输入任务标题..."
            autoFocus
          />
          <div className="sidebar-add-actions">
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                setAddTaskTitle('');
                setShowAddInput(false);
              }}
            >
              取消
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                onAddTask(addTaskTitle);
                setAddTaskTitle('');
                setShowAddInput(false);
              }}
              disabled={!addTaskTitle.trim()}
            >
              添加
            </button>
          </div>
        </div>
      )}
      
      {/* 特殊列表 */}
      {specialLists.map(list => (
        <div
          key={list.id}
          className={`list-item ${list.isMyDay ? 'my-day' : ''} ${selectedListId === list.id ? 'active' : ''}`}
          onClick={() => onSelectList(list.id)}
        >
          <div className="list-item-icon">{list.icon}</div>
          <div className="list-item-name">{list.name}</div>
          {getTaskCount(list.id) > 0 && (
            <div className="list-item-count">{getTaskCount(list.id)}</div>
          )}
        </div>
      ))}

      {/* Microsoft To Do 同步区域 */}
      <div className="ms-sync-section">
        <div className="ms-sync-header">
          <span className="ms-sync-title">Microsoft To Do</span>
          <div className="ms-sync-status">
            <span className={`ms-sync-status-dot ${msStatus?.authorized ? 'connected' : ''}`} />
            {msStatus?.authorized ? '已连接' : '未连接'}
          </div>
        </div>

        <div className="ms-sync-actions">
          {msStatus?.authorized ? (
            <>
              <button
                className="ms-sync-btn primary"
                onClick={handleMsSync}
                disabled={syncing}
              >
                {syncing ? '同步中...' : '立即同步'}
              </button>
              <button className="ms-sync-btn" onClick={handleMsLogout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              {!showClientIdInput ? (
                <button
                  className="ms-sync-btn primary"
                  onClick={() => setShowClientIdInput(true)}
                >
                  连接账号
                </button>
              ) : (
                <>
                  <input
                    className="form-input"
                    placeholder="Azure Client ID（可选）"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <button className="ms-sync-btn primary" onClick={handleMsAuthorize}>
                    打开浏览器授权
                  </button>
                  <button className="ms-sync-btn" onClick={() => setShowClientIdInput(false)}>
                    取消
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {syncMsg && (
          <div className="ms-sync-message">{syncMsg}</div>
        )}

        {deviceCodeInfo && (
          <div className="ms-device-code-box">
            <div className="ms-device-code-label">请在浏览器中输入此代码：</div>
            <div className="ms-device-code">{deviceCodeInfo.userCode}</div>
            <div className="ms-device-code-hint">授权完成后会自动继续...</div>
          </div>
        )}
      </div>

      {/* 清空数据按钮（调试用） */}
      <div className="ms-sync-section" style={{ marginTop: 'auto', paddingTop: '12px' }}>
        <button
          className="ms-sync-btn"
          onClick={handleClearAllData}
          style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
          title="清空本地所有任务和提醒"
        >
          🗑️ 清空本地数据
        </button>
      </div>

      {/* 显示已完成滑块（左侧底部） */}
      <div className="show-completed-toggle">
        <span className="toggle-label">显示已完成</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={onToggleShowCompleted}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  );
};

Sidebar.displayName = 'Sidebar';
