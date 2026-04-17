// 任务状态类型
export type TaskStatus = 'todo' | 'in-progress' | 'completed';

// 任务优先级类型
export type TaskPriority = 'low' | 'medium' | 'high';

// 任务过滤条件
export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  tags?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
}

// 任务重复规则
export interface TaskRecurrence {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weekDays?: number[]; // 周几 (0-6)
  monthDay?: number;   // 每月几号
}

// 任务列表接口
export interface TodoList {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  isMyDay?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 任务来源类型
export type TaskSource = 'local' | 'microsoft';

/// 任务接口
export interface TodoTask {
  id: string;
  listId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  isImportant: boolean; // 重要标记（类似星标）
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  reminderId?: string;
  tags?: string[];
  inMyDay: boolean; // 是否在"我的一天"中
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recurrence?: TaskRecurrence;
  // Microsoft To Do 同步相关
  microsoftToDoId?: string;
  microsoftToDoListId?: string;
  // 任务来源：local=本地创建，microsoft=从MS同步
  source?: TaskSource;
}

// 任务事件接口
export interface TaskEvent {
  type: 'add' | 'update' | 'delete' | 'statusChange' | 'listAdd' | 'listUpdate' | 'listDelete';
  task?: TodoTask;
  tasks?: TodoTask[];
  list?: TodoList;
  lists?: TodoList[];
}

// 提醒接口
export interface Reminder {
  id: string;
  title: string;
  message?: string;
  description?: string;
  type: 'once' | 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm 格式
  date?: string; // YYYY-MM-DD 格式（仅一次性提醒）
  weekDays?: number[]; // 每周几（仅周重复）
  monthDay?: number; // 每月几号（仅月重复）
  enabled: boolean;
  taskId?: string;
  priority: 'low' | 'medium' | 'high'; // 提醒优先级
  createdAt?: string;
  updatedAt?: string;
  lastTriggered?: string; // 最后触发时间
}
