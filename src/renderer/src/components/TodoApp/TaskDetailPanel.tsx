import React, { useState, useEffect, useCallback } from 'react';
import { TodoTask } from '../../../../shared/types';

interface TaskDetailPanelProps {
  task: TodoTask | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: <K extends keyof TodoTask>(field: K, value: TodoTask[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const TaskDetailPanel = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onSave,
  onCancel
}: TaskDetailPanelProps) => {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setReminderEnabled(!!task.reminderId);
    if (task.dueTime) {
      setReminderTime(task.dueTime);
    }
  }, [task?.id]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    setSaving(true);
    try {
      onSave();
      if (window.petAPI) {
        if (reminderEnabled && task.dueDate && task.dueTime) {
          // 创建/更新提醒，使用截止日期时间
          await window.petAPI.taskCreateReminder(task.id, {
            enabled: true,
            time: reminderTime,
            date: task.dueDate,
            type: 'once'
          } as any);
        } else if (!reminderEnabled && task.reminderId) {
          // 关闭提醒
          await window.petAPI.reminderUpdate(task.reminderId, { enabled: false });
        }
      }
    } finally {
      setSaving(false);
    }
  }, [task, reminderEnabled, reminderTime, onSave]);

  if (!isOpen || !task) return null;

  return (
    <>
      <div className="task-detail-overlay" onClick={onClose} />
      <div className="task-detail-panel">
        {/* Header */}
        <div className="task-detail-header">
          <h3>任务详情</h3>
          <button className="task-detail-close" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="task-detail-content">
          {/* 标题 */}
          <div className="form-group">
            <label className="form-label">任务标题</label>
            <input
              type="text"
              className="form-input"
              value={task.title}
              onChange={e => onUpdateTask('title', e.target.value)}
              placeholder="输入任务标题"
            />
          </div>

          {/* 描述 */}
          <div className="form-group">
            <label className="form-label">描述</label>
            <textarea
              className="form-textarea"
              value={task.description || ''}
              onChange={e => onUpdateTask('description', e.target.value)}
              placeholder="添加任务描述..."
            />
          </div>

          {/* 截止日期 */}
          <div className="form-group">
            <label className="form-label">截止日期</label>
            <input
              type="date"
              className="form-input"
              value={task.dueDate || ''}
              onChange={e => onUpdateTask('dueDate', e.target.value)}
            />
          </div>

          {/* 截止时间 */}
          {task.dueDate && (
            <div className="form-group">
              <label className="form-label">截止时间</label>
              <input
                type="time"
                className="form-input"
                value={task.dueTime || ''}
                onChange={e => onUpdateTask('dueTime', e.target.value)}
              />
            </div>
          )}

          {/* 快捷开关 */}
          <div className="form-group">
            <label className="toggle-switch" onClick={() => onUpdateTask('isImportant', !task.isImportant)}>
              <div className={`toggle-switch-track ${task.isImportant ? 'active' : ''}`}>
                <div className="toggle-switch-thumb" />
              </div>
              <span className="toggle-switch-label">标记为重要 ⭐</span>
            </label>
          </div>

          <div className="form-group">
            <label className="toggle-switch" onClick={() => onUpdateTask('inMyDay', !task.inMyDay)}>
              <div className={`toggle-switch-track ${task.inMyDay ? 'active' : ''}`}>
                <div className="toggle-switch-thumb" />
              </div>
              <span className="toggle-switch-label">添加到"我的一天" ☀️</span>
            </label>
          </div>

          {/* 提醒设置（仅在设置了截止日期时显示） */}
          {task.dueDate && (
            <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(229, 231, 235, 0.6)' }}>
              <label className="toggle-switch" onClick={() => setReminderEnabled(!reminderEnabled)}>
                <div className={`toggle-switch-track ${reminderEnabled ? 'active' : ''}`}>
                  <div className="toggle-switch-thumb" />
                </div>
                <span className="toggle-switch-label">到期提醒 🔔</span>
              </label>
            </div>
          )}

          {task.dueDate && reminderEnabled && (
            <div className="form-group">
              <label className="form-label">提醒时间</label>
              <input
                type="time"
                className="form-input"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                到期日 {task.dueDate} 的 {reminderTime} 提醒
              </small>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="task-detail-footer">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
};

TaskDetailPanel.displayName = 'TaskDetailPanel';
