import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { DeleteConfirm } from './DeleteConfirm';
import { TaskDetailPanel } from './TaskDetailPanel';
import ErrorBoundary from './ErrorBoundary';
import { useDateUtils } from './hooks/useDateUtils';
import { useTodoStore } from './store/useTodoStore';
import { filterTasksByList, getTaskCountForList } from './utils/taskFilter';
import './TodoApp.css';

interface TodoAppProps {
  onClose?: () => void;
}

function TodoApp({ onClose }: TodoAppProps) {
  const { formatDueDate, isOverdue } = useDateUtils();
  
  // 从store获取状态和操作
  const {
    lists,
    tasks,
    selectedListId,
    showQuickAdd,
    newTaskTitle,
    editingTaskId,
    editingTask,
    showCompleted,
    showDeleteConfirm,
    showTaskDetail,
    selectedTaskId,
    searchQuery,
    setSelectedListId,
    setShowQuickAdd,
    setNewTaskTitle,
    toggleTaskStatus,
    toggleImportant,
    deleteTask,
    confirmDeleteTask,
    cancelDeleteTask,
    startEditTask,
    saveEditTask,
    cancelEditTask,
    updateEditingTask,
    addNewTask,
    setShowTaskDetail,
    setSelectedTaskId,
    openTaskDetail,
    setSearchQuery,
    loadFromLocalStorage,
    saveToLocalStorage
  } = useTodoStore();
  
  // 直接计算需要的属性
  const selectedList = lists.find(list => list.id === selectedListId);
  const filteredTasks = filterTasksByList(tasks, selectedListId, showCompleted, searchQuery);
  const getTaskCount = (listId: string) => getTaskCountForList(tasks, listId, showCompleted);

  // 组件挂载时加载数据
  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  // 监听数据变化并保存到本地存储（防抖处理）
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage();
    }, 500);

    return () => clearTimeout(timer);
  }, [saveToLocalStorage, lists, selectedListId, showQuickAdd, newTaskTitle, editingTaskId, editingTask, showCompleted, showDeleteConfirm]);

  // 获取当前选中的任务
  const currentTask = tasks.find(task => task.id === selectedTaskId) || null;

  // 关闭任务详情面板
  const closeTaskDetail = () => {
    cancelEditTask();
    setShowTaskDetail(false);
    setSelectedTaskId(null);
  };

  // 保存任务详情
  const saveTaskDetail = () => {
    if (editingTask) {
      saveEditTask();
    }
    closeTaskDetail();
  };

  // 取消编辑任务详情
  const cancelTaskDetail = () => {
    cancelEditTask();
    closeTaskDetail();
  };

  // 稳定的回调函数
  const handleToggleShowCompleted = () => {
    useTodoStore.getState().setShowCompleted(!showCompleted);
  };

  const handleToggleImportant = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleImportant(taskId);
  };

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask(taskId);
  };

  const handleStartEditTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startEditTask(taskId);
  };

  const handleOpenTaskDetail = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openTaskDetail(taskId);
  };

  return (
    <div className="todo-app">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={setSelectedListId}
        getTaskCount={getTaskCount}
        showCompleted={showCompleted}
        onToggleShowCompleted={handleToggleShowCompleted}
      />
      <MainContent
        selectedList={selectedList}
        showCompleted={showCompleted}
        showQuickAdd={showQuickAdd}
        newTaskTitle={newTaskTitle}
        onToggleQuickAdd={() => setShowQuickAdd(!showQuickAdd)}
        onUpdateNewTaskTitle={setNewTaskTitle}
        onAddNewTask={addNewTask}
        filteredTasks={filteredTasks}
        onToggleTaskStatus={toggleTaskStatus}
        onToggleImportant={handleToggleImportant}
        onDeleteTask={handleDeleteTask}
        onStartEditTask={handleStartEditTask}
        onOpenTaskDetail={handleOpenTaskDetail}
        editingTaskId={editingTaskId}
        editingTask={editingTask}
        onUpdateEditingTask={updateEditingTask}
        onSaveEditTask={saveEditTask}
        onCancelEditTask={cancelEditTask}
        formatDueDate={formatDueDate}
        isOverdue={isOverdue}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
      <DeleteConfirm
        show={!!showDeleteConfirm}
        onConfirm={confirmDeleteTask}
        onCancel={cancelDeleteTask}
      />
      <TaskDetailPanel
        task={editingTask}
        isOpen={showTaskDetail}
        onClose={closeTaskDetail}
        onUpdateTask={updateEditingTask}
        onSave={saveTaskDetail}
        onCancel={cancelTaskDetail}
      />
    </div>
  );
}

export default TodoApp;
