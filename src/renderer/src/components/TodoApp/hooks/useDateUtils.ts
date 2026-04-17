import { useCallback } from 'react';
import { TodoTask } from '../../../../../shared/types';

export function useDateUtils() {
  const formatDueDate = useCallback((dueDate?: string): string | null => {
    if (!dueDate) return null;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    if (dueDate === today) return '今天';
    if (dueDate === tomorrow) return '明天';
    
    const date = new Date(dueDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }, []);

  const isOverdue = useCallback((task: TodoTask): boolean => {
    if (!task.dueDate || task.status === 'completed') return false;
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate < today;
  }, []);

  return {
    formatDueDate,
    isOverdue
  };
}
