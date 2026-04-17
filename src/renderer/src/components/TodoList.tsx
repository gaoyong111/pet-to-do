import { useState, useEffect } from 'react';
import { TodoTask, TaskStatus, TaskPriority } from '../../../../shared/types';

interface TodoListProps {
  onTaskSelect?: (task: TodoTask) => void;
}

function TodoList({ onTaskSelect }: TodoListProps) {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [filters, setFilters] = useState<{
    status?: TaskStatus[];
    priority?: TaskPriority[];
  }>({});
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    // 加载任务
    loadTasks();

    // 暂时不监听任务变化，后续可以添加事件监听
  }, [filters, showCompleted]);

  const loadTasks = async () => {
    try {
      const filteredTasks = await window.petAPI.taskGetAll({
        status: showCompleted ? undefined : ['todo', 'in-progress'],
        priority: filters.priority,
      });
      setTasks(filteredTasks);
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  };

  const handleToggleStatus = async (taskId: string) => {
    try {
      await window.petAPI.taskToggleStatus(taskId);
      loadTasks();
    } catch (error) {
      console.error('切换任务状态失败:', error);
    }
  };

  const handleSetPriority = async (taskId: string, priority: TaskPriority) => {
    try {
      await window.petAPI.taskSetPriority(taskId, priority);
      loadTasks();
    } catch (error) {
      console.error('设置任务优先级失败:', error);
    }
  };

  const handleCreateReminder = async (taskId: string) => {
    try {
      await window.petAPI.taskCreateReminder(taskId);
      loadTasks();
    } catch (error) {
      console.error('创建任务提醒失败:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      try {
        await window.petAPI.taskDelete(taskId);
        loadTasks();
      } catch (error) {
        console.error('删除任务失败:', error);
      }
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return '待办';
      case 'in-progress':
        return '进行中';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="todo-list">
      {/* 过滤器 */}
      <div className="filters">
        <button
          className={showCompleted ? 'active-filter high-priority' : 'filter-btn'}
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? '隐藏已完成' : '显示已完成'}
        </button>
        <button
          className={filters.priority?.includes('high') ? 'active-filter high-priority' : 'filter-btn'}
          onClick={() => setFilters(prev => ({
            ...prev,
            priority: prev.priority?.includes('high')
              ? prev.priority.filter(p => p !== 'high')
              : [...(prev.priority || []), 'high']
          }))}
        >
          高优先级
        </button>
        <button
          className={filters.priority?.includes('medium') ? 'active-filter medium-priority' : 'filter-btn'}
          onClick={() => setFilters(prev => ({
            ...prev,
            priority: prev.priority?.includes('medium')
              ? prev.priority.filter(p => p !== 'medium')
              : [...(prev.priority || []), 'medium']
          }))}
        >
          中优先级
        </button>
        <button
          className={filters.priority?.includes('low') ? 'active-filter low-priority' : 'filter-btn'}
          onClick={() => setFilters(prev => ({
            ...prev,
            priority: prev.priority?.includes('low')
              ? prev.priority.filter(p => p !== 'low')
              : [...(prev.priority || []), 'low']
          }))}
        >
          低优先级
        </button>
      </div>

      {/* 任务列表 */}
      <div>
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <span className="text-3xl">📋</span>
            </div>
            <h3>暂无任务</h3>
            <p>点击右上角的"创建任务"按钮添加新任务</p>
          </div>
        ) : (
          tasks.map(task => {
            return (
              <div
                key={task.id}
                className="task-item"
                onClick={() => onTaskSelect?.(task)}
              >
                <div className="task-content">
                  <div className="task-header">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(task.id);
                      }}
                    />
                    <h3 className={task.status === 'completed' ? 'completed' : ''}>
                      {task.title}
                    </h3>
                    <span className={`priority-badge ${task.priority}`}>
                      {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  {task.description && (
                    <p className="task-description">
                      {task.description}
                    </p>
                  )}
                  <div className="task-meta">
                    {task.dueDate && (
                      <span className="meta-item">
                        <span>📅</span>
                        <span>{task.dueDate} {task.dueTime || ''}</span>
                      </span>
                    )}
                    <span className={`status-badge ${task.status}`}>
                      <span>{task.status === 'todo' ? '⏳' : task.status === 'in-progress' ? '🔄' : '✅'}</span>
                      <span>{getStatusText(task.status)}</span>
                    </span>
                    {task.reminderId && (
                      <span className="reminder-badge">
                        <span>⏰</span>
                        <span>已设置提醒</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="task-actions">
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateReminder(task.id);
                    }}
                    title="设置提醒"
                  >
                    ⏰
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    title="删除任务"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TodoList;