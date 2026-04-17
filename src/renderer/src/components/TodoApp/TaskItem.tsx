import React from 'react';
import { TodoTask } from '../../../../shared/types';
import { TaskItemProps } from './types';

export const TaskItem = ({ 
  task, 
  onToggleStatus, 
  onToggleImportant, 
  onDelete, 
  onStartEdit,
  onOpenDetail,
  isEditing, 
  editingTask, 
  onUpdateEditingTask, 
  onSaveEdit, 
  onCancelEdit,
  formatDueDate,
  isOverdue
}: TaskItemProps) => {
  if (isEditing && editingTask?.id === task.id) {
    return (
      <div className="task-item editing">
        <div className="task-checkbox" onClick={onSaveEdit}></div>
        <div className="task-content">
          <input
            type="text"
            className="task-edit-input"
            value={editingTask.title || ''}
            onChange={(e) => onUpdateEditingTask('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            autoFocus
          />
        </div>
        <div className="task-actions">
          <button className="btn-primary" onClick={onSaveEdit} style={{ padding: '6px 12px', fontSize: '12px' }}>
            保存
          </button>
          <button className="btn-secondary" onClick={onCancelEdit} style={{ padding: '6px 12px', fontSize: '12px' }}>
            取消
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'completed';

  return (
    <div className={`task-item ${isCompleted ? 'completed' : ''}`}>
      <div 
        className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
        onClick={() => onToggleStatus(task.id)}
      />
      <div 
        className="task-content"
        onClick={(e) => onOpenDetail(task.id, e)}
      >
        <div className="task-title">
          {task.title}
        </div>
        <div className="task-meta">
          {task.dueDate && (
            <div className={`task-meta-item ${isOverdue(task) ? 'overdue' : ''}`}>
              <span>📅</span>
              <span>{formatDueDate(task.dueDate)}</span>
              {task.dueTime && <span>{task.dueTime}</span>}
            </div>
          )}
        </div>
      </div>
      <div 
        className={`task-important ${task.isImportant ? 'active' : ''}`}
        onClick={(e) => onToggleImportant(task.id, e)}
      >
        {task.isImportant ? '★' : '☆'}
      </div>
      <div 
        className="task-delete"
        onClick={(e) => onDelete(task.id, e)}
        title="删除任务"
      >
        ✕
      </div>
    </div>
  );
};

TaskItem.displayName = 'TaskItem';
