import { describe, it, expect } from 'vitest';
import { filterTasksByList, getTaskCountForList, isInTodayView } from './taskFilter';
import { TodoTask } from '../../../../../shared/types';

const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const now = new Date().toISOString();

const mockTasks: TodoTask[] = [
  {
    id: '1',
    listId: 'tasks',
    title: '今天创建的任务',
    status: 'todo',
    priority: 'medium',
    isImportant: false,
    createdAt: now,
    updatedAt: now
  },
  {
    id: '2',
    listId: 'tasks',
    title: '已完成的任务',
    status: 'completed',
    priority: 'high',
    isImportant: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: '3',
    listId: 'tasks',
    title: '未来截止的任务',
    status: 'todo',
    priority: 'low',
    isImportant: false,
    dueDate: tomorrow,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: '4',
    listId: 'tasks',
    title: '过去的旧任务',
    status: 'todo',
    priority: 'medium',
    isImportant: false,
    dueDate: yesterday,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

describe('isInTodayView', () => {
  it('should include tasks created today', () => {
    expect(isInTodayView(mockTasks[0])).toBe(true);
  });

  it('should exclude completed tasks', () => {
    expect(isInTodayView(mockTasks[1])).toBe(false);
  });

  it('should include tasks with future dueDate', () => {
    expect(isInTodayView(mockTasks[2])).toBe(true);
  });

  it('should exclude old tasks with past dueDate', () => {
    expect(isInTodayView(mockTasks[3])).toBe(false);
  });
});

describe('filterTasksByList', () => {
  it('should filter tasks for "my-day" list (auto-calculated)', () => {
    const result = filterTasksByList(mockTasks, 'my-day', false);
    // 任务1(今天创建) + 任务3(未来截止) = 2
    expect(result.length).toBe(2);
    expect(result.map(t => t.id).sort()).toEqual(['1', '3']);
  });

  it('should filter tasks for "important" list', () => {
    const result = filterTasksByList(mockTasks, 'important', true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter tasks for "planned" list', () => {
    const result = filterTasksByList(mockTasks, 'planned', false);
    // 任务3(未来截止) + 任务4(过去截止) = 2
    expect(result.length).toBe(2);
    expect(result.map(t => t.id).sort()).toEqual(['3', '4']);
  });

  it('should filter completed tasks when showCompleted is false', () => {
    const result = filterTasksByList(mockTasks, 'important', false);
    expect(result.length).toBe(0);
  });
});

describe('getTaskCountForList', () => {
  it('should return correct count for "my-day" list', () => {
    const count = getTaskCountForList(mockTasks, 'my-day', false);
    expect(count).toBe(2);
  });

  it('should return 0 when no tasks match', () => {
    const count = getTaskCountForList(mockTasks, 'non-existent', false);
    expect(count).toBe(0);
  });
});
