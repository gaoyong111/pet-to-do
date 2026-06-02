import { TodoTask } from '../../../../../shared/types';
import { SPECIAL_LIST_IDS } from '../constants';

/**
 * 判断任务是否属于"今日待办"（纯本地自动计算）
 * 规则：未完成 且（创建/更新于今天 或 截止日期 >= 今天）
 */
export function isInTodayView(task: TodoTask): boolean {
  if (task.status === 'completed') return false;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 创建日期是今天
  if (task.createdAt?.startsWith(today)) return true;

  // 更新日期是今天
  if (task.updatedAt?.startsWith(today)) return true;

  // 截止日期 >= 今天（含未来和今天）
  if (task.dueDate && task.dueDate >= today) return true;

  return false;
}

export function filterTasksByList(
  tasks: TodoTask[],
  selectedListId: string,
  showCompleted: boolean,
  searchQuery: string = ''
): TodoTask[] {
  return tasks.filter(task => {
    let listMatch = false;
    
    switch (selectedListId) {
      case SPECIAL_LIST_IDS.MY_DAY:
        listMatch = isInTodayView(task);
        break;
      case SPECIAL_LIST_IDS.IMPORTANT:
        listMatch = task.isImportant;
        break;
      case SPECIAL_LIST_IDS.PLANNED:
        listMatch = !!task.dueDate;
        break;
      case SPECIAL_LIST_IDS.ALL:
        listMatch = true; // 显示所有任务
        break;
      case SPECIAL_LIST_IDS.COMPLETED:
        listMatch = task.status === 'completed';
        break;
      default:
        listMatch = task.listId === selectedListId;
    }

    if (!showCompleted && task.status === 'completed') {
      return false;
    }

    const listConditionResult = listMatch;

    if (!searchQuery) {
      return listConditionResult;
    }

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = task.title.toLowerCase().includes(searchLower);
    const descriptionMatch = (task.description || '').toLowerCase().includes(searchLower);
    const tagsMatch = (task.tags || []).some(tag => tag.toLowerCase().includes(searchLower));

    return listConditionResult && (titleMatch || descriptionMatch || tagsMatch);
  });
}

export function getTaskCountForList(
  tasks: TodoTask[],
  listId: string,
  showCompleted: boolean
): number {
  const filterCondition = (t: TodoTask) => {
    if (!showCompleted && t.status === 'completed') return false;
    
    switch (listId) {
      case SPECIAL_LIST_IDS.MY_DAY:
        return isInTodayView(t);
      case SPECIAL_LIST_IDS.IMPORTANT:
        return t.isImportant;
      case SPECIAL_LIST_IDS.PLANNED:
        return !!t.dueDate;
      case SPECIAL_LIST_IDS.ALL:
        return true;
      case SPECIAL_LIST_IDS.COMPLETED:
        return t.status === 'completed';
      default:
        return t.listId === listId;
    }
  };

  return tasks.filter(filterCondition).length;
}
