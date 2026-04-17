export const STORAGE_KEYS = {
  LISTS: 'todoLists',
  TASKS: 'todoTasks'
} as const;

export const DEFAULT_LIST_ID = 'my-day';

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed'
} as const;

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
} as const;

export const SPECIAL_LIST_IDS = {
  MY_DAY: 'my-day',
  IMPORTANT: 'important',
  PLANNED: 'planned',
  TASKS: 'tasks',
  ALL: 'all',
  COMPLETED: 'completed-list'
} as const;
