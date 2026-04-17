import { useCallback } from 'react';
import { TodoTask, TodoList } from '../../../../../shared/types';
import { STORAGE_KEYS } from '../constants';

interface StorageData {
  lists: TodoList[];
  tasks: TodoTask[];
}

export function useTodoStorage(mockLists: TodoList[], mockTasks: TodoTask[]) {
  const loadFromLocalStorage = useCallback((): StorageData => {
    try {
      const savedLists = localStorage.getItem(STORAGE_KEYS.LISTS);
      const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
      return {
        lists: savedLists ? JSON.parse(savedLists) : mockLists,
        tasks: savedTasks ? JSON.parse(savedTasks) : mockTasks
      };
    } catch (error) {
      console.error('加载本地存储失败:', error);
      return {
        lists: mockLists,
        tasks: mockTasks
      };
    }
  }, [mockLists, mockTasks]);

  const saveToLocalStorage = useCallback((lists: TodoList[], tasks: TodoTask[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (error) {
      console.error('保存本地存储失败:', error);
    }
  }, []);

  return {
    loadFromLocalStorage,
    saveToLocalStorage
  };
}
