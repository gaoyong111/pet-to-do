import { useState, useEffect, useCallback } from 'react';
import { Reminder, ReminderType, WeekDay } from '../types';
import './Reminder.css';

/**
 * 提醒组件
 * 显示和管理自定义提醒
 */
function ReminderComponent(): JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
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

  /**
   * 加载所有提醒
   */
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

  /**
   * 初始化加载提醒
   */
  useEffect(() => {
    if (isVisible) {
      loadReminders();
    }
  }, [isVisible, loadReminders]);

  /**
   * 监听提醒系统更新事件
   */
  useEffect(() => {
    if (!window.petAPI) return;

    // 模拟监听提醒更新事件（实际需要在preload中添加对应的事件监听）
    // 这里通过定期检查来模拟实时更新
    const interval = setInterval(() => {
      if (isVisible) {
        loadReminders();
      }
    }, 60000); // 每1分钟检查一次

    return () => clearInterval(interval);
  }, [isVisible, loadReminders]);

  /**
   * 切换面板可见性
   */
  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
    if (!isVisible) {
      setShowAddForm(false);
      setEditingReminder(null);
    }
  }, [isVisible]);

  /**
   * 重置表单数据
   */
  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      type: 'daily',
      time: '09:00',
      enabled: true
    });
    setEditingReminder(null);
  }, []);

  /**
   * 处理表单输入变化
   */
  const handleFormChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * 处理周几选择
   */
  const handleWeekDayToggle = useCallback((day: WeekDay) => {
    setFormData(prev => {
      const weekDays = prev.weekDays || [];
      if (weekDays.includes(day)) {
        return {
          ...prev,
          weekDays: weekDays.filter(d => d !== day)
        };
      } else {
        return {
          ...prev,
          weekDays: [...weekDays, day]
        };
      }
    });
  }, []);

  /**
   * 提交表单
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.petAPI) return;

    try {
      if (editingReminder) {
        await window.petAPI.reminderUpdate(editingReminder.id, formData);
      } else {
        await window.petAPI.reminderAdd(formData);
      }
      resetForm();
      setShowAddForm(false);
      loadReminders();
    } catch (error) {
      console.error('保存提醒失败:', error);
    }
  }, [formData, editingReminder, resetForm, loadReminders]);

  /**
   * 编辑提醒
   */
  const handleEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      type: reminder.type,
      time: reminder.time,
      date: reminder.date,
      weekDays: reminder.weekDays,
      monthDay: reminder.monthDay,
      enabled: reminder.enabled
    });
    setShowAddForm(true);
  }, []);

  /**
   * 删除提醒
   */
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

  /**
   * 切换提醒启用状态
   */
  const handleToggle = useCallback(async (id: string) => {
    if (!window.petAPI) return;

    try {
      await window.petAPI.reminderToggle(id);
      loadReminders();
    } catch (error) {
      console.error('切换提醒状态失败:', error);
    }
  }, [loadReminders]);

  /**
   * 获取提醒类型标签
   */
  const getTypeLabel = useCallback((type: ReminderType): string => {
    switch (type) {
      case 'once':
        return '一次性';
      case 'daily':
        return '每天';
      case 'weekly':
        return '每周';
      case 'monthly':
        return '每月';
      default:
        return '';
    }
  }, []);

  return (
    <div className="reminder-container">
      <button 
        className="reminder-toggle" 
        onClick={toggleVisibility}
      >
        {isVisible ? '×' : '🔔'}
      </button>
      
      {isVisible && (
        <div className="reminder-panel">
          <div className="reminder-header">
            <h3>提醒</h3>
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
                  onChange={(e) => handleFormChange('type', e.target.value as ReminderType)}
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
                    value={formData.date}
                    onChange={(e) => handleFormChange('date', e.target.value)}
                    required
                  />
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
                reminders.map(reminder => (
                  <div key={reminder.id} className={`reminder-item ${!reminder.enabled ? 'disabled' : ''}`}>
                    <div className="reminder-info">
                      <div className="reminder-title">{reminder.title}</div>
                      <div className="reminder-meta">
                        <span className="reminder-type">{getTypeLabel(reminder.type)}</span>
                        <span className="reminder-time">{reminder.time}</span>
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
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReminderComponent;
