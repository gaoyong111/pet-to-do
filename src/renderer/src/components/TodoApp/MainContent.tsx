import React from 'react';
import { MainContentProps } from './types';
import { EmptyState } from './EmptyState';
import { TaskItem } from './TaskItem';

export const MainContent = ({ 
  selectedList, 
  showCompleted, 
  filteredTasks, 
  onToggleTaskStatus, 
  onToggleImportant, 
  onDeleteTask, 
  onStartEditTask, 
  onOpenTaskDetail,
  editingTaskId, 
  editingTask, 
  onUpdateEditingTask, 
  onSaveEditTask, 
  onCancelEditTask,
  formatDueDate,
  isOverdue,
  searchQuery,
  onSearchQueryChange
}: MainContentProps) => {
  return (
    <div className="main-content">
      <div className="main-header">
        <h1>{selectedList?.name || ''}</h1>
        {selectedList?.isMyDay && (
          <p>{new Date().toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
          })}</p>
        )}
        <div className="main-header-tools">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="tasks-container">
        {filteredTasks.length === 0 ? (
          <EmptyState selectedList={selectedList} />
        ) : (
          <div className="task-list">
            {filteredTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleStatus={onToggleTaskStatus}
                onToggleImportant={onToggleImportant}
                onDelete={onDeleteTask}
                onStartEdit={onStartEditTask}
                onOpenDetail={onOpenTaskDetail}
                isEditing={editingTaskId === task.id}
                editingTask={editingTask}
                onUpdateEditingTask={onUpdateEditingTask}
                onSaveEdit={onSaveEditTask}
                onCancelEdit={onCancelEditTask}
                formatDueDate={formatDueDate}
                isOverdue={isOverdue}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

MainContent.displayName = 'MainContent';
