import { create } from 'zustand';
import { TodoList, TodoTask, TaskStatus } from '../../../../shared/types';
import { filterTasksByList, getTaskCountForList } from '../utils/taskFilter';
import { mockLists } from '../mockData';
import { DEFAULT_LIST_ID, SPECIAL_LIST_IDS } from '../constants';

interface TodoState {
  // 状态
  lists: TodoList[];
  tasks: TodoTask[];
  selectedListId: string;
  showQuickAdd: boolean;
  newTaskTitle: string;
  editingTaskId: string | null;
  editingTask: TodoTask | null;
  showCompleted: boolean;
  showDeleteConfirm: string | null;
  showTaskDetail: boolean;
  selectedTaskId: string | null;
  searchQuery: string;
  // MS To Do 映射
  defaultMsListId: string | null;
  
  // 计算属性
  selectedList: TodoList | undefined;
  filteredTasks: TodoTask[];
  getTaskCount: (listId: string) => number;
  
  // 操作
  setLists: (lists: TodoList[]) => void;
  setTasks: (tasks: TodoTask[]) => void;
  setSelectedListId: (listId: string) => void;
  setShowQuickAdd: (show: boolean) => void;
  setNewTaskTitle: (title: string) => void;
  setEditingTaskId: (id: string | null) => void;
  setEditingTask: (task: TodoTask | null) => void;
  setShowCompleted: (show: boolean) => void;
  setShowDeleteConfirm: (taskId: string | null) => void;
  setShowTaskDetail: (show: boolean) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  openTaskDetail: (taskId: string) => void;
  setSearchQuery: (query: string) => void;
  setDefaultMsListId: (id: string) => void;
  
  // 任务操作
  toggleTaskStatus: (taskId: string) => void;
  toggleImportant: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  confirmDeleteTask: () => void;
  cancelDeleteTask: () => void;
  startEditTask: (taskId: string) => void;
  saveEditTask: () => void;
  cancelEditTask: () => void;
  updateEditingTask: <K extends keyof TodoTask>(field: K, value: TodoTask[K]) => void;
  addNewTask: () => void;
  
  // 存储操作
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  // 初始状态
  lists: mockLists,
  tasks: [],
  selectedListId: DEFAULT_LIST_ID,
  showQuickAdd: false,
  newTaskTitle: '',
  editingTaskId: null,
  editingTask: null,
  showCompleted: false,
  showDeleteConfirm: null,
  showTaskDetail: false,
  selectedTaskId: null,
  searchQuery: '',
  defaultMsListId: null,
  
  // 计算属性
  selectedList: undefined,
  filteredTasks: [],
  getTaskCount: (listId: string) => 0,
  
  // 操作
  setLists: (lists: TodoList[]) => {
    // 自动设置默认 MS 列表 ID（第一个 MS 列表）
    const msList = lists.find(l => l.microsoftToDoId);
    const state = useTodoStore.getState();
    if (msList && !state.defaultMsListId) {
      set({ lists, defaultMsListId: msList.id });
    } else {
      set({ lists });
    }
  },
  setTasks: (tasks: TodoTask[]) => set({ tasks }),
  setSelectedListId: (selectedListId: string) => set({ selectedListId }),
  setShowQuickAdd: (showQuickAdd: boolean) => set({ showQuickAdd }),
  setNewTaskTitle: (newTaskTitle: string) => set({ newTaskTitle }),
  setEditingTaskId: (editingTaskId: string | null) => set({ editingTaskId }),
  setEditingTask: (editingTask: TodoTask | null) => set({ editingTask }),
  setShowCompleted: (showCompleted: boolean) => set({ showCompleted }),
  setShowDeleteConfirm: (showDeleteConfirm: string | null) => set({ showDeleteConfirm }),
  setShowTaskDetail: (showTaskDetail: boolean) => set({ showTaskDetail }),
  setSelectedTaskId: (selectedTaskId: string | null) => set({ selectedTaskId }),
  openTaskDetail: (taskId: string) => {
    const { tasks } = get();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      set({ 
        selectedTaskId: taskId, 
        showTaskDetail: true,
        editingTaskId: taskId,
        editingTask: { ...task }
      });
    }
  },
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setDefaultMsListId: (id: string) => set({ defaultMsListId: id }),
  
  // 任务操作
  toggleTaskStatus: (taskId: string) => {
    const { tasks, defaultMsListId, lists } = get();
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;
    
    const newStatus: TaskStatus = currentTask.status === 'completed' ? 'todo' : 'completed';
    const updatedTask = {
      ...currentTask,
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };
    
    // 乐观更新 UI
    set({ tasks: tasks.map(task => task.id === taskId ? updatedTask : task) });
    
    // 同步到主进程
    if (window.petAPI?.taskToggleStatus) {
      window.petAPI.taskToggleStatus(taskId).catch(console.error);
    }
    
    // 同步到 Microsoft To Do
    const msListId = currentTask.microsoftToDoListId || 
                      (defaultMsListId ? defaultMsListId.replace('ms-', '') : null) ||
                      lists.find(l => l.microsoftToDoId)?.microsoftToDoId;
    if (msListId && window.petAPI?.msTodoPush) {
      window.petAPI.msTodoPush(updatedTask, msListId).catch(console.error);
    }
  },

  toggleImportant: (taskId: string) => {
    const { tasks, defaultMsListId, lists } = get();
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;
    
    const updatedTask = {
      ...currentTask,
      isImportant: !currentTask.isImportant,
      updatedAt: new Date().toISOString()
    };
    
    set({ tasks: tasks.map(task => task.id === taskId ? updatedTask : task) });
    
    // 同步到主进程
    if (window.petAPI?.taskUpdate) {
      window.petAPI.taskUpdate(taskId, { isImportant: updatedTask.isImportant }).catch(console.error);
    }
    
    // 同步到 Microsoft To Do
    const msListId = currentTask.microsoftToDoListId || 
                      (defaultMsListId ? defaultMsListId.replace('ms-', '') : null) ||
                      lists.find(l => l.microsoftToDoId)?.microsoftToDoId;
    if (msListId && window.petAPI?.msTodoPush) {
      window.petAPI.msTodoPush(updatedTask, msListId).catch(console.error);
    }
  },

  deleteTask: (taskId: string) => {
    set({ showDeleteConfirm: taskId });
  },
  
  confirmDeleteTask: () => {
    const { showDeleteConfirm, tasks, defaultMsListId } = get();
    if (showDeleteConfirm) {
      const taskToDelete = tasks.find(t => t.id === showDeleteConfirm);
      
      // 删除前获取关联的提醒 ID
      if (window.petAPI?.taskGetReminder) {
        window.petAPI.taskGetReminder(showDeleteConfirm).then((reminder: any) => {
          if (reminder?.id && window.petAPI?.reminderDelete) {
            window.petAPI.reminderDelete(reminder.id).catch(console.error);
          }
        }).catch(() => {});
      }
      
      set({
        tasks: tasks.filter(task => task.id !== showDeleteConfirm),
        showDeleteConfirm: null
      });
      
      // 同步到主进程
      if (window.petAPI?.taskDelete) {
        window.petAPI.taskDelete(showDeleteConfirm).catch(console.error);
      }
      
      // 同步删除到 Microsoft To Do
      if (taskToDelete?.microsoftToDoId && taskToDelete?.microsoftToDoListId && window.petAPI?.msTodoDelete) {
        window.petAPI.msTodoDelete(taskToDelete.microsoftToDoListId, taskToDelete.microsoftToDoId).catch(console.error);
      }
    }
  },
  
  cancelDeleteTask: () => {
    set({ showDeleteConfirm: null });
  },
  
  startEditTask: (taskId: string) => {
    const { tasks } = get();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      set({
        editingTaskId: taskId,
        editingTask: { ...task }
      });
    }
  },
  
  saveEditTask: () => {
    const { editingTaskId, editingTask, tasks, defaultMsListId, lists } = get();
    if (!editingTaskId || !editingTask) {
      set({
        editingTaskId: null,
        editingTask: null
      });
      return;
    }

    // 检查是否有 dueDate 变化，需要更新提醒
    const oldTask = tasks.find(t => t.id === editingTaskId);
    const hasDueDateChanged = oldTask?.dueDate !== editingTask.dueDate || 
                              oldTask?.dueTime !== editingTask.dueTime;

    const updated = {
      ...editingTask,
      updatedAt: new Date().toISOString()
    };

    set({
      tasks: tasks.map(task => {
        if (task.id !== editingTaskId) return task;
        return updated;
      }),
      editingTaskId: null,
      editingTask: null
    });

    // 同步到主进程
    if (window.petAPI?.taskUpdate) {
      window.petAPI.taskUpdate(editingTaskId, updated).catch(console.error);
    }
    
    // 同步到 Microsoft To Do
    const msListId = updated.microsoftToDoListId || 
                      (defaultMsListId ? defaultMsListId.replace('ms-', '') : null) ||
                      lists.find(l => l.microsoftToDoId)?.microsoftToDoId;
    if (msListId && window.petAPI?.msTodoPush) {
      window.petAPI.msTodoPush(updated, msListId).catch(console.error);
    }

    // 任务-提醒联动：有 dueDate 时创建/更新提醒
    if (updated.dueDate && window.petAPI?.taskCreateReminder) {
      window.petAPI.taskCreateReminder(editingTaskId, {
        time: updated.dueTime || '09:00',
        date: updated.dueDate
      }).catch(console.error);
    }
  },
  
  cancelEditTask: () => {
    set({
      editingTaskId: null,
      editingTask: null
    });
  },
  
  updateEditingTask: <K extends keyof TodoTask>(field: K, value: TodoTask[K]) => {
    set((state) => ({
      editingTask: state.editingTask ? {
        ...state.editingTask,
        [field]: value
      } : null
    }));
  },
  
  addNewTask: () => {
    const { newTaskTitle, selectedListId, defaultMsListId, lists } = get();
    if (!newTaskTitle.trim()) return;

    // 所有新添加的任务都需要同步到 MS
    const needMsSync = true;

    // 找到实际的列表 ID
    let listIdForNewTask: string;
    if (selectedListId === SPECIAL_LIST_IDS.MY_DAY ||
        selectedListId === SPECIAL_LIST_IDS.IMPORTANT ||
        selectedListId === SPECIAL_LIST_IDS.PLANNED) {
      listIdForNewTask = SPECIAL_LIST_IDS.TASKS;
    } else {
      listIdForNewTask = selectedListId;
    }

    const newTask: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'> = {
      listId: listIdForNewTask,
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: 'medium',
      isImportant: selectedListId === SPECIAL_LIST_IDS.IMPORTANT,
      inMyDay: selectedListId === SPECIAL_LIST_IDS.MY_DAY,
      source: 'local'  // 标记为本地创建的任务
    };

    // 获取 MS 列表 ID（去掉 ms- 前缀）
    const getMsListId = (): string | null => {
      const listId = defaultMsListId;
      if (!listId) {
        // 尝试从 lists 中获取第一个 MS 列表的 ID
        const msList = lists.find(l => l.microsoftToDoId);
        return msList?.microsoftToDoId || null;
      }
      return listId.replace('ms-', '');
    };

    // 尝试走 IPC 写入主进程
    if (window.petAPI?.taskAdd) {
      window.petAPI.taskAdd(newTask).then((created: TodoTask) => {
        set(state => ({
          tasks: [created, ...state.tasks],
          newTaskTitle: '',
          showQuickAdd: false
        }));
        
        // 同步到 MS To Do（如果是"我的一天"或"重要"）
        const msListId = getMsListId();
        if (needMsSync && msListId && window.petAPI?.msTodoPush) {
          window.petAPI.msTodoPush(created, msListId).then(result => {
            if (result.success && result.microsoftToDoId) {
              // 更新本地任务，保存 MS ID
              set(state => ({
                tasks: state.tasks.map(t => t.id === created.id ? {
                  ...t,
                  microsoftToDoId: result.microsoftToDoId,
                  microsoftToDoListId: msListId
                } : t)
              }));
            }
          }).catch(console.error);
        }
      }).catch(() => {
        // IPC 失败时降级到纯前端（离线模式）
        const fallback: TodoTask = {
          ...newTask,
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        set(state => ({
          tasks: [fallback, ...state.tasks],
          newTaskTitle: '',
          showQuickAdd: false
        }));
      });
    } else {
      // 离线模式
      const fallback: TodoTask = {
        ...newTask,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      set(state => ({
        tasks: [fallback, ...state.tasks],
        newTaskTitle: '',
        showQuickAdd: false
      }));
    }
  },

  // 存储操作
  loadFromLocalStorage: () => {
    // lists 仍用 localStorage（主进程无 lists）
    try {
      const savedLists = localStorage.getItem('todoLists');
      set({ lists: savedLists ? JSON.parse(savedLists) : mockLists });
    } catch {
      set({ lists: mockLists });
    }
    // tasks 从主进程加载
    if (window.petAPI?.taskGetAll) {
      window.petAPI.taskGetAll().then((tasks: TodoTask[]) => {
        set({ tasks: tasks || [] });
      }).catch(() => {
        // 降级到 localStorage
        try {
          const savedTasks = localStorage.getItem('todoTasks');
          set({ tasks: savedTasks ? JSON.parse(savedTasks) : [] });
        } catch {
          set({ tasks: [] });
        }
      });
    } else {
      try {
        const savedTasks = localStorage.getItem('todoTasks');
        set({ tasks: savedTasks ? JSON.parse(savedTasks) : [] });
      } catch {
        set({ tasks: [] });
      }
    }
  },

  saveToLocalStorage: () => {
    const { lists } = get();
    try {
      localStorage.setItem('todoLists', JSON.stringify(lists));
      // tasks 不再写 localStorage，由主进程持久化
    } catch (error) {
      console.error('保存本地存储失败:', error);
    }
  }
}));

// 计算属性的getter
export const useTodoComputed = () => {
  const selectedList = useTodoStore(state => 
    state.lists.find(list => list.id === state.selectedListId)
  );
  
  const filteredTasks = useTodoStore(state => 
    filterTasksByList(state.tasks, state.selectedListId, state.showCompleted, state.searchQuery)
  );
  
  const getTaskCount = useTodoStore(state => {
    const { tasks, showCompleted } = state;
    return (listId: string) => getTaskCountForList(tasks, listId, showCompleted);
  });
  
  return {
    selectedList,
    filteredTasks,
    getTaskCount
  };
};
