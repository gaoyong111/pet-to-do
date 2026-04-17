import React from 'react';
import { QuickAddProps } from './types';

export const QuickAdd = React.memo(({ 
  showQuickAdd, 
  newTaskTitle, 
  onToggleQuickAdd, 
  onUpdateNewTaskTitle, 
  onAddNewTask 
}: QuickAddProps) => {
  if (!showQuickAdd) {
    return (
      <div 
        className="quick-add"
        onClick={onToggleQuickAdd}
      >
        <div className="quick-add-icon">+</div>
        <div className="quick-add-text">添加任务</div>
      </div>
    );
  }

  return (
    <div className="quick-add-input-area">
      <input
        type="text"
        className="quick-add-input"
        value={newTaskTitle}
        onChange={(e) => onUpdateNewTaskTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAddNewTask();
          if (e.key === 'Escape') {
            onToggleQuickAdd();
            onUpdateNewTaskTitle('');
          }
        }}
        placeholder="输入任务标题..."
        autoFocus
      />
      <div className="quick-add-actions">
        <button 
          className="btn-secondary"
          onClick={() => {
            onToggleQuickAdd();
            onUpdateNewTaskTitle('');
          }}
        >
          取消
        </button>
        <button 
          className="btn-primary"
          onClick={onAddNewTask}
          disabled={!newTaskTitle.trim()}
        >
          添加任务
        </button>
      </div>
    </div>
  );
});

QuickAdd.displayName = 'QuickAdd';
