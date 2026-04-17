import { TodoTask } from '../../../../../shared/types';
import { SPECIAL_LIST_IDS } from '../constants';

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
        listMatch = task.inMyDay;
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
        return t.inMyDay;
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
