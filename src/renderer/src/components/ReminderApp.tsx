import { useState, useEffect, useCallback } from 'react';
import { Reminder, ReminderType, WeekDay } from '../types';
import './Reminder.css';

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetDateString(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseOnceDateTime(date: string, time: string): Date {
  const [h, m] = time.split(':').map(v => parseInt(v, 10));
  const d = new Date(`${date}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function isOnceSchedulePast(date: string, time: string): boolean {
  return parseOnceDateTime(date, time).getTime() <= Date.now();
}

function formatReminderDateLabel(dateStr: string): string {
  const today = todayDateString();
  const tomorrowStr = offsetDateString(1);
  const yesterdayStr = offsetDateString(-1);

  if (dateStr === today) return '今天';
  if (dateStr === tomorrowStr) return '明天';
  if (dateStr === yesterdayStr) return '昨天';

  const [y, m, d] = dateStr.split('-');
  if (y && m && d) return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  return dateStr;
}

function formatReminderSchedule(reminder: Reminder, weekDayLabels: Record<WeekDay, string>): string {
  switch (reminder.type) {
    case 'once':
      if (reminder.date) {
        return `${formatReminderDateLabel(reminder.date)} ${reminder.time}`;
      }
      return `${reminder.time}（未设日期）`;
    case 'daily':
      return `每天 ${reminder.time}`;
    case 'weekly': {
      const days = (reminder.weekDays || [])
        .sort((a, b) => a - b)
        .map(d => weekDayLabels[d as WeekDay])
        .join('、');
      return days ? `每周 ${days} · ${reminder.time}` : `每周 · ${reminder.time}`;
    }
    case 'monthly':
      return reminder.monthDay
        ? `每月${reminder.monthDay}日 · ${reminder.time}`
        : `每月 · ${reminder.time}`;
    default:
      return reminder.time;
  }
}

/**
 * 提醒窗口组件（独立窗口模式）
 * 显示和管理自定义提醒，无折叠按钮，始终展示完整面板
 */
function ReminderApp(): JSX.Element {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showBadge, setShowBadge] = useState(() => {
    const saved = localStorage.getItem('pet-show-reminder-badge');
    return saved !== null ? saved === 'true' : true;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Reminder, 'id' | 'lastTriggered'>>({
    title: '',
    description: '',
    type: 'daily',
    time: '09:00',
    enabled: true
  });

  const weekDayLabels: Record<WeekDay, string> = {
    0: '周日',
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六'
  };

  const loadReminders = useCallback(async () => {
    if (window.petAPI) {
      try {
        const data = await window.petAPI.reminderGetAll();
        setReminders(data);
      } catch (error) {
        console.error('加载提醒失败:', error);
      }
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  useEffect(() => {
    if (!window.petAPI) return;
    const interval = setInterval(() => {
      loadReminders();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadReminders]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      type: 'daily',
      time: '09:00',
      enabled: true
    });
    setFormError(null);
    setEditingReminder(null);
  }, []);

  const handleTypeChange = useCallback((type: ReminderType) => {
    setFormData(prev => {
      const next = { ...prev, type };
      if (type === 'once') {
        next.date = prev.date || todayDateString();
      } else {
        delete next.date;
      }
      if (type !== 'weekly') delete next.weekDays;
      if (type !== 'monthly') delete next.monthDay;
      return next;
    });
    setFormError(null);
  }, []);

  const handleFormChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'date' || field === 'time') {
      setFormError(null);
    }
  }, []);

  const handleWeekDayToggle = useCallback((day: WeekDay) => {
    setFormData(prev => {
      const weekDays = prev.weekDays || [];
      if (weekDays.includes(day)) {
        return { ...prev, weekDays: weekDays.filter(d => d !== day) };
      } else {
        return { ...prev, weekDays: [...weekDays, day] };
      }
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.petAPI) return;

    if (formData.type === 'once') {
      if (!formData.date) {
        setFormError('请选择提醒日期');
        return;
      }
      if (isOnceSchedulePast(formData.date, formData.time)) {
        const ok = window.confirm(
          '所选日期和时间已过，保存后不会再触发提醒。确定仍要保存吗？'
        );
        if (!ok) return;
      }
    }

    if (formData.type === 'weekly' && (!formData.weekDays || formData.weekDays.length === 0)) {
      setFormError('请至少选择一个星期');
      return;
    }

    try {
      const payload = { ...formData };
      if (payload.type !== 'once') delete payload.date;
      if (payload.type !== 'weekly') delete payload.weekDays;
      if (payload.type !== 'monthly') delete payload.monthDay;

      if (editingReminder) {
        await window.petAPI.reminderUpdate(editingReminder.id, payload);
      } else {
        await window.petAPI.reminderAdd(payload);
      }
      resetForm();
      setShowAddForm(false);
      loadReminders();
    } catch (error) {
      console.error('保存提醒失败:', error);
      setFormError('保存失败，请重试');
    }
  }, [formData, editingReminder, resetForm, loadReminders]);

  const handleEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      type: reminder.type,
      time: reminder.time,
      date: reminder.type === 'once' ? (reminder.date || todayDateString()) : undefined,
      weekDays: reminder.weekDays,
      monthDay: reminder.monthDay,
      enabled: reminder.enabled
    });
    setFormError(null);
    setShowAddForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.petAPI) return;
    if (confirm('确定要删除这个提醒吗？')) {
      try {
        await window.petAPI.reminderDelete(id);
        loadReminders();
      } catch (error) {
        console.error('删除提醒失败:', error);
      }
    }
  }, [loadReminders]);

  const handleToggle = useCallback(async (id: string) => {
    if (!window.petAPI) return;
    try {
      await window.petAPI.reminderToggle(id);
      loadReminders();
    } catch (error) {
      console.error('切换提醒状态失败:', error);
    }
  }, [loadReminders]);

  const getTypeLabel = useCallback((type: ReminderType): string => {
    switch (type) {
      case 'once': return '一次性';
      case 'daily': return '每天';
      case 'weekly': return '每周';
      case 'monthly': return '每月';
      default: return '';
    }
  }, []);

  return (
    <div className="reminder-window">
      <h2 className="reminder-window-title">🔔 提醒</h2>
      <div className="reminder-window-panel">
        <div className="reminder-header">
          <h3>提醒列表</h3>
          <button 
            className="add-reminder-btn"
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
          >
            {showAddForm ? '取消' : '＋'}
          </button>
        </div>

        {/* 图标徽标开关 */}
        <label className="reminder-badge-toggle">
          <span>🔔 图标上显示数量</span>
          <input
            type="checkbox"
            checked={showBadge}
            onChange={(e) => {
              setShowBadge(e.target.checked);
              localStorage.setItem('pet-show-reminder-badge', String(e.target.checked));
              window.petAPI?.relayToMain('reminder-badge-visibility', e.target.checked);
            }}
          />
        </label>
        
        {showAddForm ? (
          <form className="reminder-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>标题</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="输入提醒标题"
                required
              />
            </div>
            
            <div className="form-group">
              <label>描述（可选）</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="输入提醒描述"
                rows={2}
              />
            </div>
            
            <div className="form-group">
              <label>提醒类型</label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as ReminderType)}
              >
                <option value="once">一次性</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>提醒时间</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => handleFormChange('time', e.target.value)}
                required
              />
            </div>
            
            {formData.type === 'once' && (
              <div className="form-group">
                <label>日期</label>
                <input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  required
                />
                {formData.date && isOnceSchedulePast(formData.date, formData.time) && (
                  <p className="form-hint form-hint--warn">
                    该日期时间已过，保存后不会触发（仍可留作记录）
                  </p>
                )}
              </div>
            )}
            
            {formData.type === 'weekly' && (
              <div className="form-group">
                <label>每周</label>
                <div className="week-days">
                  {([0, 1, 2, 3, 4, 5, 6] as WeekDay[]).map(day => (
                    <button
                      key={day}
                      type="button"
                      className={`week-day-btn ${(formData.weekDays || []).includes(day) ? 'active' : ''}`}
                      onClick={() => handleWeekDayToggle(day)}
                    >
                      {weekDayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {formData.type === 'monthly' && (
              <div className="form-group">
                <label>每月几号</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.monthDay}
                  onChange={(e) => handleFormChange('monthDay', parseInt(e.target.value))}
                  placeholder="1-31"
                  required
                />
              </div>
            )}
            
            {formError && <p className="form-error">{formError}</p>}

            <div className="form-actions">
              <button type="submit" className="save-btn">
                {editingReminder ? '更新' : '添加'}
              </button>
            </div>
          </form>
        ) : (
          <div className="reminder-list">
            {reminders.length === 0 ? (
              <div className="empty-state">
                <p>暂无提醒</p>
                <p className="hint">点击 ＋ 添加提醒</p>
              </div>
            ) : (
              reminders.map(reminder => {
                const scheduleText = formatReminderSchedule(reminder, weekDayLabels);
                const isExpiredOnce = reminder.type === 'once'
                  && !!reminder.date
                  && isOnceSchedulePast(reminder.date, reminder.time);

                return (
                <div key={reminder.id} className={`reminder-item ${!reminder.enabled ? 'disabled' : ''} ${isExpiredOnce ? 'expired' : ''}`}>
                  <div className="reminder-info">
                    <div className="reminder-title">{reminder.title}</div>
                    <div className="reminder-meta">
                      <span className="reminder-type">{getTypeLabel(reminder.type)}</span>
                      <span className={`reminder-schedule ${isExpiredOnce ? 'reminder-schedule--past' : ''}`}>
                        {scheduleText}
                      </span>
                      {isExpiredOnce && reminder.enabled && (
                        <span className="reminder-expired-tag">已过期</span>
                      )}
                    </div>
                  </div>
                  <div className="reminder-actions">
                    <button
                      className="toggle-btn"
                      onClick={() => handleToggle(reminder.id)}
                      title={reminder.enabled ? '禁用' : '启用'}
                    >
                      {reminder.enabled ? '✓' : '○'}
                    </button>
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(reminder)}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(reminder.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReminderApp;
