import { TodoList, TodoTask } from '../../../../shared/types';

export const mockLists: TodoList[] = [
  {
    id: 'default',
    name: '任务',
    icon: '📋',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const mockTasks: TodoTask[] = [
  {
    id: '1',
    listId: 'my-day',
    title: '完成项目设计文档',
    description: '需要完成项目的架构设计和技术选型',
    status: 'in-progress',
    priority: 'high',
    isImportant: true,
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '18:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    listId: 'tasks',
    title: 'Review代码',
    description: '检查团队成员的PR',
    status: 'todo',
    priority: 'medium',
    isImportant: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    listId: 'my-day',
    title: '准备周会材料',
    status: 'completed',
    priority: 'medium',
    isImportant: false,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
